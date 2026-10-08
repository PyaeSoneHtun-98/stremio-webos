'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function size(target){if(!fs.existsSync(target))return 0;const stat=fs.statSync(target);if(stat.isFile())return stat.size;return fs.readdirSync(target).reduce((sum,name)=>sum+size(path.join(target,name)),0);}
function files(target,out){out=out||[];if(!fs.existsSync(target))return out;for(const name of fs.readdirSync(target)){const item=path.join(target,name),stat=fs.statSync(item);if(stat.isDirectory())files(item,out);else out.push({path:path.relative(root,item).replace(/\\/g,'/'),bytes:stat.size});}return out;}
const ipk=fs.readdirSync(root).find(name=>/_all\.ipk$/.test(name));
const frontend=files(path.join(root,'service','www')).sort((a,b)=>b.bytes-a.bytes);
const report={version:JSON.parse(fs.readFileSync(path.join(root,'app','appinfo.json'),'utf8')).version,
    generatedAt:new Date().toISOString(),packageBytes:ipk?size(path.join(root,ipk)):0,
    runtimeBytes:{app:size(path.join(root,'app')),serviceTotal:size(path.join(root,'service')),
        frontend:size(path.join(root,'service','www')),server:size(path.join(root,'service','server.js')),
        ffmpeg:size(path.join(root,'service','bin','ffmpeg')),ffprobe:size(path.join(root,'service','bin','ffprobe')),
        dictionary:size(path.join(root,'service','data','dictionary.json')),phrases:size(path.join(root,'service','data','phrases.json'))},
    largestFrontendFiles:frontend.slice(0,12)};
const output=path.resolve(process.argv[2]||path.join(root,'resource-report.json'));
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('PACKAGE_RESOURCE '+JSON.stringify(report));
