const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const redis = require('redis');

const app_config = {
    offscreen : true,
    tileserver_enabled : true,
};

const createWindow = () => {
    let appIcon;
    if (fs.existsSync(`${__dirname}/img/app.png`)) {
        appIcon = `${__dirname}/img/app.png`;
    } else if (fs.existsSync(`${__dirname}/img/icon.png`)) {
        appIcon = `${__dirname}/img/icon.png`;
    } else {
        appIcon = `${__dirname}/img/logo.png`;
    }
    console.log(appIcon);

    const win = new BrowserWindow({
        width: 800,
        height: 600,
        icon: appIcon,
        show: !app_config.offscreen,
        webPreferences: {
            //devTools: true,
            offscreen: app_config.offscreen,
            nodeIntegration: false,
            contextIsolation: false,
            enableRemoteModule: true,
            //preload: path.join(__dirname, 'preload.js'),
        },
        hasShadow: false,
        transparent: true,
        backgroundColor: "#01000000",
        fullscreen: false,
        frame: false,
    });

    //win.webContents.openDevTools();

    win.loadFile('www/index.html');

    if(app_config.offscreen){
        win.setSize(512, 512);
        win.webContents.on('did-finish-load', () => {
            let m_redis_client = null;
    
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
            
                setInterval(() => {
                    win.webContents.capturePage().then(image => {
                        const image2 = image.resize({
                            width: 512,
                            height: 512,
                        });
                        // const png = image2.toPNG();
                        // const base64String = png.toString('base64');
                        // const dataURL = `data:image/png;base64,${base64String}`;
                        const dataURL = image2.toDataURL();
                        client.publish('pgis-offscreen', dataURL, (err, reply) => {
                            if (err) {
                                console.error('Error publishing message:', err);
                            } else {
                                //console.log(`Message published to ${reply} subscribers.`);
                            }
                        });
                    });
                }, 1000);
            });
        });
    }
    if(app_config.tileserver_enabled){
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
};

app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('disable-gpu');

app.whenReady().then(() => {
    setTimeout(() => {
        createWindow();
    }, 3000);//avoid ubuntu transparent issue
});