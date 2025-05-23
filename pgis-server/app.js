const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const redis = require('redis');
const express = require('express');
const cors = require('cors');
//if chromium version is 112 then install puppeteer@20.0.0
const puppeteer = require('puppeteer');

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
let m_offscreen_enabled_ts = 0;

const m_args_options = parseArgs();

const m_app_config = Object.assign({
    offscreen_enabled : false,//on/off
    offscreen_headless : true,
    offscreen_interval_ms : 1000,
    offscreen_enabled_timeout_ms : 10000,
    debug : false,
}, require('./config.js'));

if(m_args_options.debug_enabled){
    m_app_config.debug = true;
}

function start_webserver() { // start up websocket server
    const options = {
    };
    console.log("websocket server starting up");
    express_app = express();
	express_app.use(cors());
	express_app.use(express.json());
    http = require('http').Server(express_app);
	http.keepAliveTimeout = 60000;

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
	https.keepAliveTimeout = 60000;

    express_app.use(express.static('../pgis')); // this need be set
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
    const subscriber = client.duplicate();
    subscriber.connect().then(() => {
        console.log('redis subscriber connected:');

        subscriber.subscribe('pgis-server', (data, key) => {
            const params = data.trim().split(' ');
            switch (params[0]) {
                case "CMD":
                    switch (params[1]) {
                        case "ENABLE_OFFSCREEN":
                            m_app_config.offscreen_enabled = true;
                            m_offscreen_enabled_ts = Date.now();
                            break;
                        case "DISABLE_OFFSCREEN":
                            m_app_config.offscreen_enabled = false;
                            break;
                    }

                    console.log(`"${data}" subscribed.`);
                    break;
            }
        });
    });
}

start_webserver();

//offscreen
{
    let m_browser = null;
    let m_page = null;
    let m_page_loading = false;
    let m_page_closing = false;
    setInterval(async () => {
        if(!m_redis_client){
            return;
        }
        if(m_app_config.offscreen_enabled){
            if(m_app_config.offscreen_enabled_timeout_ms > 0 && Date.now() - m_offscreen_enabled_ts > m_app_config.offscreen_enabled_timeout_ms){
                m_app_config.offscreen_enabled = false;
                return;
            }
            if(!m_page){
                if(m_page_loading){
                    console.log("puppeteer page loading...");
                    return;
                }
                m_page_loading = true;
                const browser = await puppeteer.launch({
                    headless: !(m_app_config.offscreen_headless === false),
                    args: [
                        '--disable-gpu',
                        '--disable-dev-shm-usage',
                        '--disable-setuid-sandbox',
                        '--no-first-run',
                        '--no-sandbox',
                        '--no-zygote',
                        '--single-process',
                    ],
                    executablePath: '/usr/bin/chromium-browser'
                });
            
                const page = await browser.newPage();
            
                page.setViewport({
                    width: 1280,
                    height: 640,
                });
            
                const url = 'http://localhost:9101/index.html';
                await page.goto(url);
            
                m_browser = browser;
                m_page = page;
                m_page_loading = false;
    
                console.log("puppeteer browser launched");
            }
            const screenshot = await m_page.screenshot({ encoding: 'base64' });
            const dataUrl = `data:image/png;base64,${screenshot}`;
        
            m_redis_client.publish('pgis-offscreen', `{"enabled":true,"url":"${dataUrl}"}`, (err, reply) => {
                if (err) {
                    console.error('Error publishing message:', err);
                } else {
                    //console.log(`Message published to ${reply} subscribers.`);
                }
            });
        }else{
            if(m_page){
                const browser = m_browser;
                const page = m_page;

                m_browser = null;
                m_page = null;

                await page.close();
                await browser.close();
    
                console.log("puppeteer browser closed");
            }
            m_redis_client.publish('pgis-offscreen', '{"enabled":false}', (err, reply) => {
                if (err) {
                    console.error('Error publishing message:', err);
                } else {
                    //console.log(`Message published to ${reply} subscribers.`);
                }
            });
        }
    }, m_app_config.offscreen_interval_ms || 1000);
}