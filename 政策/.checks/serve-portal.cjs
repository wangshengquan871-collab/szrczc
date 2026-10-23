const path = require('path');
const fs = require('fs');
const liveServer = require('C:/Users/11811/.vscode/extensions/ritwickdey.liveserver-5.7.10/node_modules/live-server');
const root = path.resolve(__dirname, '../全市政策/苏州人才政策');
const server = liveServer.start({root,port:5527,host:'127.0.0.1',open:false,logLevel:1,wait:100});
server.on('listening',()=>fs.writeFileSync(path.join(__dirname,'portal-live-server.pid'),String(process.pid)));
console.log('Live Server root: '+root);
process.on('SIGINT',()=>{liveServer.shutdown();process.exit(0);});
