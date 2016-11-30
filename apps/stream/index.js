'use strict';

const beameSDK    = require('beame-sdk');
const module_name = "MobileStream";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const Service     = require('../../constants').SetupServices.MobileStream;

const port = Service.port;
const host = 'localhost';

// Hack attack!

class Server {

	start() {
		var express = require('express');
		var app     = express();
		var http    = require('http').Server(app);

		app.use(express.static(__dirname + '/public'));

		http.listen(port, host, function () {
			logger.info(`Listening on ${host}:${port}`);
		});

		this._app = app;
	}
}

module.exports = Server;
