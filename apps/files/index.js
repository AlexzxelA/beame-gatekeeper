'use strict';

const beameSDK    = require('beame-sdk');
const module_name = "FilesApp";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const port = 65511;
const host = 'localhost';

// Hack attack!

class Server {

	start() {
		var express = require('express');
		var app = express();
		var http = require('http').Server(app);
		var io = require('socket.io')(http);

		var serveIndex = require('serve-index');

		app.use(express.static(__dirname + '/public'));
		app.use('/', serveIndex(__dirname + '/public', {'icons': true}));

		http.listen(port, host, function(){
			logger.info(`Listening on ${host}:${port}`);
		});

		this._app = app;
		this._http = http;
	}
}

module.exports = Server;
