#! /usr/bin/env node
process.chdir(__dirname);

const fs = require("fs");
const path = require('path');
const { execSync } = require('child_process');

function deleteFolderRecursiveSync(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const fullPath = path.join(folderPath, file);
            if (fs.lstatSync(fullPath).isDirectory()) {
                deleteFolderRecursiveSync(fullPath);
            } else {
                fs.unlinkSync(fullPath);
            }
        });
        fs.rmdirSync(folderPath);
        console.log(`${folderPath} deleted successfully`);
    }
}

try{
	deleteFolderRecursiveSync('www');
}catch(err){
	console.log("error on rm www:" + err);
}

try{
	//execSync('git clone --depth 1 https://github.com/picam360/pgis.git www -b v0.1', {cwd : __dirname});
	execSync('git clone --depth 1 https://github.com/picam360/pgis.git www', {cwd : __dirname});
}catch(err){
	console.log("error on git:" + err);
}

try{
	fs.copyFileSync('www/config.js.tmp', 'www/config.js');
}catch(err){
	console.log("error on copy config.json : " + err);
}