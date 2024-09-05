#! /usr/bin/env node
process.chdir(__dirname);

const fs = require("fs");
const path = require('path');
const { execSync } = require('child_process');

try{
	if (fs.existsSync('pgis')) {
		fs.rmSync('pgis', {recursive:true, force:true});
	}
}catch(err){
	console.log("error on rm pgis:" + err);
}

try{
	//execSync('git clone --depth 1 https://github.com/picam360/pgis.git -b v0.1', {cwd : __dirname});
	execSync('git clone --depth 1 https://github.com/picam360/pgis.git', {cwd : __dirname});
}catch(err){
	console.log("error on git:" + err);
}

try{
	fs.copyFileSync('pgis/config.js.tmp', 'pgis/config.js');
}catch(err){
	console.log("error on copy config.json : " + err);
}