'use strict';

const beameSDK    = require('beame-sdk');
const module_name = "RaspberryLight";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const Service     = require('../../constants').SetupServices.RaspberryLight;
const port = Service.port;
const host = 'localhost';


class Server {

	start() {
		var express = require('express');
		var app     = express();
		var http    = require('http').Server(app);

		app.use(express.static(__dirname + '/public'));

		app.post('/switch/:cmd',(req,res) =>{
			let cmd = req.params.cmd;

			let gpio;

			try {
				const Gpio = require('onoff').Gpio;
				gpio = Gpio;
			} catch (e) {
				logger.error(`Gpio not supported`);
			}

			if(!gpio){
				res.status(200).json({message:'GPIO not supported on current platform',status:500});
				return;
			}

			let led = new gpio(14, 'out');
			switch (cmd){
				case "on":
					led.writeSync(1);
					res.status(200).json({cmd,status:200});
					break;
				case "off":
					led.writeSync(0);
					res.status(200).json({cmd,status:200});
					break;
				default:
					res.status(200).json({message:'Hello? yes, this is pi!',status:201});
					break;
			}

		});

		http.listen(port, host, function () {
			logger.info(`Listening on ${host}:${port}`);
		});

		this._app = app;
	}
}

module.exports = Server;
