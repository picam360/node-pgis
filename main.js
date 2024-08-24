const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const redis = require('redis');

const app_config = {
    offscreen : true,
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
                        const pixels = image.toBitmap(); // RGBA形式のバッファを取得
                        const channels = 4;
                        const width = image.getSize().width;
                        const height = image.getSize().height;
                        client.publish('pgis-offscreen-pixels', pixels, (err, reply) => {
                            if (err) {
                                console.error('Error publishing message:', err);
                            } else {
                                //console.log(`Message published to ${reply} subscribers.`);
                            }
                        });
                        client.publish('pgis-offscreen-channels', channels.toString(), (err, reply) => {
                            if (err) {
                                console.error('Error publishing message:', err);
                            } else {
                                //console.log(`Message published to ${reply} subscribers.`);
                            }
                        });
                        client.publish('pgis-offscreen-width', width.toString(), (err, reply) => {
                            if (err) {
                                console.error('Error publishing message:', err);
                            } else {
                                //console.log(`Message published to ${reply} subscribers.`);
                            }
                        });
                        client.publish('pgis-offscreen-height', height.toString(), (err, reply) => {
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
};

app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('disable-gpu');

app.whenReady().then(() => {
    setTimeout(() => {
        createWindow();
    }, 3000);//avoid ubuntu transparent issue
});