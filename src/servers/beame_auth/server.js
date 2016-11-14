/**
 * Created by zenit1 on 13/11/2016.
 */

"use strict";

const path = require('path');

const utils = require('../../utils');


const router     = require('../../routers/beame_auth');
const public_dir = path.join(__dirname, '..', '..', '..', 'public');

const beameSDK    = require('beame-sdk');
const module_name = "BeameAuthServer";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

class BeameAuthServer {

	/**
	 *
	 * @param {String} fqdn
	 * @param {Router|null} [app]
	 */
	constructor(fqdn, app) {
		this._fqdn   = fqdn;
		this._app    = app || utils.setExpressApp(router, public_dir);
		this._server = null;
	}

	/**
	 * @param {Function|null} [cb]
	 */
	start(cb) {
		beameSDK.BeameServer(this._fqdn, this._app, (data, app) => {
			logger.debug(`Beame authorization server started on ${this._fqdn} `);

			this._server = app;

			cb && cb(app);
		});
	}


	//noinspection JSUnusedGlobalSymbols
	stop() {
		if (this._server) {
			this._server.close();
			this._server = null;
		}
	}
}


module.exports = BeameAuthServer;