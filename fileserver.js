const http = require('http');
const fs = require('fs');
const url = require('url');

const hostname = '127.0.0.1';
const port = 3000;
const home = "../html-save";
let origin = "";

fileWriter = {
    write: function(dir, file, req, res) {  // returns path as string
	fs.mkdirSync(home+"/"+dir);
	let filename = home+"/"+dir+"/"+file;
	let dst = fs.createWriteStream(filename);
	req.pipe(dst);
	dst.on('drain', function() {
	    console.log('drain:', filename, new Date());
	    req.resume();
	});
	req.on('end', function () {
	    dst.close();
	    res.statusCode = 200;
	    res.end("/"+filename);
	});
    }
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const reqURL = url.parse(req.url, true);
    console.log(">", req.url+'\n  file '+reqURL.query['file']+'\n  guid '+reqURL.query['guid']+';\n');
    try {
	fileWriter.write(reqURL.query['guid'], reqURL.query['file'], req, res);
    } catch(e) {
	res.statusCode = 405;
	res.end(e.toString());
    }
});

server.listen(port, hostname, () => {
    origin = `http://${hostname}:${port}/`;
    console.log('> Server running at', origin, "/"+home);
});
