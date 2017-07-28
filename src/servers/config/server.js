/**
 * Created by zenit1 on 17/07/2017.
 */
"use strict";

const path       = require('path');

const utils     = require('../../utils');
const Router    = require('../../routers/config');
const public_dir = path.join(__dirname, '..', '..', '..', process.env.BEAME_INSTA_DOC_ROOT);

const beameSDK    = require('beame-sdk');
const module_name = "GatekeeperConfig";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const host        = 'localhost';

const BeameAdminServices = require('../../adminServices');

class ConfigServer {

	/**
	 *
	 * @param {ServiceManager} _serviceManager
	 */
	constructor(_serviceManager) {

		this._beameAdminServices = new BeameAdminServices(_serviceManager);

		this._app = utils.setExpressApp((new Router(this._beameAdminServices)).router, public_dir);

		this._server = null;

	}

	start(cb) {

		let http = require('http').Server(this._app);

		http.listen(0, host, () => {
			this._server = http;
			logger.info(`Listening on ${host}:${this._server.address().port}`);
			cb && cb(null, {url: `http://${host}:${this._server.address().port}`})
		});

	}
}

module.exports = ConfigServer;