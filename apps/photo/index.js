'use strict';

const beameSDK    = require('beame-sdk');
const module_name = "MobilePhotos";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const port = 65512;
const host = 'localhost';

// Hack attack!

class Server {

	start() {
		var express = require('express');
		var app     = express();
		var http    = require('http').Server(app);
		var io      = require('socket.io')(http);

		app.use(express.static(__dirname + '/public'));

		http.listen(port, host, function () {
			logger.info(`Listening on ${host}:${port}`);
		});

		this._app = app;
	}
}

module.exports = Server;
