const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const redis = require('redis');
const express = require('express');
const cors = require('cors');

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};

    args.forEach(arg => {
        const [key, value] = arg.split('=');
        if (key.startsWith('--')) {
        options[key.replace('--', '')] = value;
        }
    });

    return options;
}

let express_app = null;
let http = null;
let https = null;
let m_redis_client = null;

const m_args_options = parseArgs();

const m_app_config = Object.assign({
    offscreen : false,
    debug : false,
}, require('config.js'));

if(m_args_options.debug_enabled){
    m_app_config.debug = true;
}

function start_tileserver() { // start up tile server
    const options = {
        port: 9101,
        mbtiles: path.join(__dirname, 'data/japan-latest.mbtiles'), 
    };

    //npm install -g tileserver-gl-light
    const tileserver = spawn(
        'tileserver-gl-light',
        ['--mbtiles', options.mbtiles, '-p', '9101']
    );
  
    tileserver.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });
  
    tileserver.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });
  
    tileserver.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
    });
}

function start_webserver() { // start up websocket server
    console.log("websocket server starting up");
    express_app = express();
	express_app.use(cors());
	express_app.use(express.json());
    http = require('http').Server(express_app);

	var https_key_filepath = 'certs/https/localhost-key.pem';
	var https_cert_filepath = 'certs/https/localhost.pem';
	if(options['https_key_filepath'] &&
	   options['https_cert_filepath']){
		if(fs.existsSync(options['https_key_filepath']) &&
		   fs.existsSync(options['https_cert_filepath'])){
			https_key_filepath = options['https_key_filepath'];
			https_cert_filepath = options['https_cert_filepath'];
		}else{
			console.log("https key cert file not found.");
		}
	}
	var https_options = {
		key: fs.readFileSync(https_key_filepath),
		cert: fs.readFileSync(https_cert_filepath)
	};
	https = require('https').Server(https_options, express_app);

    express_app.use(express.static('www')); // this need be set
	var http_port = 9101;
	if(options['http_port']){
		http_port = options['http_port'];
	}
    http.listen(http_port, function() {
        console.log('listening http on *:' + http_port);
    });

	var https_port = 9102;
	if(options['https_port']){
		https_port = options['https_port'];
	}
    https.listen(https_port, function() {
        console.log('listening https on *:' + https_port);
    });
}

{    
    const client = redis.createClient({
        host: 'localhost',
        port: 6379,
    });
    client.on('error', (err) => {
        console.error('redis error:', err);
        m_redis_client = null;
    });
    client.connect().then(() => {
        console.log('redis connected:');
        m_redis_client = client;
    });
}

start_tileserver();
start_webserver();

if(m_app_config.offscreen){
    //if chromium version is 112 then install puppeteer@20.0.0
    const puppeteer = require('puppeteer');
    (async () => {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-first-run',
          '--no-sandbox',
          '--no-zygote',
          '--single-process'
        ],
        executablePath: '/usr/bin/chromium-browser'
      });
    
      const page = await browser.newPage();
    
      const url = 'http://localhost:9101/index.html';
      await page.goto(url);
    
      setInterval(async () => {
        const screenshot = await page.screenshot({ encoding: 'base64' });
        const dataUrl = `data:image/png;base64,${screenshot}`;
    
        if(m_redis_client){
            client.publish('pgis-offscreen', dataUrl, (err, reply) => {
                if (err) {
                    console.error('Error publishing message:', err);
                } else {
                    //console.log(`Message published to ${reply} subscribers.`);
                }
            });
        }

      }, 1000)
    
      // Puppeteerを終了
      //await browser.close();
    })();    
}