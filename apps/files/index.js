'use strict';

const beameSDK    = require('beame-sdk');
const module_name = "FilesApp";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const Service     = require('../../constants').SetupServices.SampleFileShare;
const host        = 'localhost';
const express     = require('express');
const app         = express();

class Server {

	start(cb) {

		let http    = require('http').Server(app);
		let io      = require('socket.io')(http);

		let serveIndex = require('serve-index');

		app.use(express.static(__dirname + '/public'));
		app.use('/', serveIndex(__dirname + '/public', {'icons': true}));

		http.listen(0, host,  () => {
			this._server = http;
			logger.info(`Listening on ${host}:${this._server.address().port}`);
			cb && cb(null,{code:Service.code, url:`http://${host}:${this._server.address().port}`})
		});

		this._app  = app;
		this._http = http;
	}
}

module.exports = Server;
