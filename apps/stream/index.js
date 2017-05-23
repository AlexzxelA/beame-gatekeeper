'use strict';

const beameSDK    = require('beame-sdk');
const module_name = "MobileStream";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const Service     = require('../../constants').SetupServices.MobileStream;
const host        = 'localhost';
const express     = require('express');
const app         = express();

class Server {

	start(cb) {

		let http = require('http').Server(app);

		app.use(express.static(__dirname + '/public'));

		http.listen(0, host, function () {
			this._server = http;

			logger.info(`Listening on ${host}:${this._server.address().port}`);

			cb && cb(null, {code: Service.code, url: `http://${host}:${this._server.address().port}`})
		});

		this._app = app;
	}
}

module.exports = Server;
