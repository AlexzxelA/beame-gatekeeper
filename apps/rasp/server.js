/**
 * Created by zenit1 on 08/01/2017.
 */
"use strict";

var http = require('http');
var url = require('url');
var Gpio = require('onoff').Gpio;

var led = new Gpio(14, 'out');


http.createServer(function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	console.log(req.url);
	var command = url.parse(req.url).pathname.slice(1);
	command = command.replace('/','');
	console.log('command ' + command);
	switch(command) {
		case "on":
			led.writeSync(1);
			res.end("It's ON");
			break;
		case "off":
			led.writeSync(0);
			res.end("It's OFF");
			break;
		default:
			res.end('Hello? yes, this is pi!');
	}
}).listen(65516);