const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const redis = require('redis');

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
const m_args_options = parseArgs();

const m_app_config = Object.assign({
    offscreen : false,
    offscreen_enabled : false,//on/off
    debug : false,
}, require('config.js'));

if(m_args_options.offscreen){
    m_app_config.offscreen = true;
}
if(m_args_options.debug_enabled){
    m_app_config.debug = true;
}

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
        show: !m_app_config.offscreen,
        webPreferences: {
            devTools: m_app_config.debug,
            offscreen: m_app_config.offscreen,
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

    if(m_app_config.debug){
        win.webContents.openDevTools();
    }

    win.loadFile('www/index.html');

    if(m_app_config.offscreen){
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
                    if(m_app_config.offscreen_enabled){
                        win.webContents.capturePage().then(image => {
                            const image2 = image.resize({
                                width: 512,
                                height: 512,
                            });
                            // const png = image2.toPNG();
                            // const base64String = png.toString('base64');
                            // const dataURL = `data:image/png;base64,${base64String}`;
                            const dataURL = image2.toDataURL();
                            client.publish('pgis-offscreen', `{"enabled":true,"url":"${dataURL}"}`, (err, reply) => {
                                if (err) {
                                    console.error('Error publishing message:', err);
                                } else {
                                    //console.log(`Message published to ${reply} subscribers.`);
                                }
                            });
                        });
                    }else{
                        client.publish('pgis-offscreen', '{"enabled":false}', (err, reply) => {
                            if (err) {
                                console.error('Error publishing message:', err);
                            } else {
                                //console.log(`Message published to ${reply} subscribers.`);
                            }
                        });
                    }
                }, 1000);
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