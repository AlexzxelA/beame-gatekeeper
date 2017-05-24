'use strict';

const beameSDK    = require('beame-sdk');
const module_name = "RaspberryLight";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const Service     = require('../../constants').SetupServices.RaspberryLight;
const port        = Service.port;
const host        = 'localhost';
const http        = require('http');
const express     = require('express');
const app         = express();
const path = require('path');


class Server {

	constructor() {
		this._server   = null;
		this._gpio     = null;
		this._led      = null;
		this._ledState = 0;

		try {
			this._gpio = require('onoff').Gpio;
		} catch (e) {
			logger.error(`Gpio not supported`);
		}

		try {
			this._led      = new this._gpio(14, 'out');
			this._ledState = this._led.readSync();
		} catch (e) {
			logger.error(`Led not connected`);
		}

	}

	start(cb) {

		let server = http.createServer(app);

		app.use(express.static(__dirname + '/public'));

		app.get('/', (req, res) =>{
			res.cookie('beame_led_state', this._ledState);
			res.sendFile(path.join(__dirname + '/public','rasp.html'));
		});

		app.post('/switch/:cmd', (req, res) => {
			let cmd = req.params.cmd;

			if (!this._gpio) {
				res.status(200).json({message: 'GPIO not supported on current platform', status: 500});
				return;
			}

			if (!this._led) {
				res.status(200).json({message: 'Led not connected', status: 500});
				return;
			}

			switch (cmd) {
				case "on":
					this._led.writeSync(1);
					this._ledState = 1;
					res.status(200).json({cmd, status: 200});
					this._socketioServer.sockets.emit('switch', {cmd});
					break;
				case "off":
					this._led.writeSync(0);
					this._ledState = 0;
					res.status(200).json({cmd, status: 200});
					this._socketioServer.sockets.emit('switch', {cmd});
					break;
				default:
					res.status(200).json({message: 'Hello? yes, this is pi!', status: 201});
					break;
			}

		});

		server.listen(0, host, () => {

			this._server = server;

			logger.info(`Listening on ${host}:${this._server.address().port}`);

			cb && cb(null, {code: Service.code, url: `http://${host}:${this._server.address().port}`})

		});

		this._app = app;

		this._socketioServer = require('socket.io')(server);
		//noinspection JSUnresolvedFunction
		this._socketioServer.of('light').on('connection', (socket) => {
			socket.on('switch', (data) => {
				socket.broadcast.emit('switch', data);
			})
		});

	}

	stop() {
		if (this._server) {
			this._server.close();
			this._server = null;
		}
	}

}

module.exports = Server;
