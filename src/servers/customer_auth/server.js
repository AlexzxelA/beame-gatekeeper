/**
 * Created by zenit1 on 14/11/2016.
 */

"use strict";

const path = require('path');

const utils = require('../../utils');

const router     = require('../../routers/customer_auth');
const public_dir = path.join(__dirname, '..', '..', '..', 'public');

const beameSDK    = require('beame-sdk');
const module_name = "CustomerAuthServer";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

class CustomerAuthServer {

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

	start() {
		beameSDK.BeameServer(this._fqdn, this._app, (data, app) => {
			logger.debug(`Customer authorization server started on ${this._fqdn} `);

			this._server = app;

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


module.exports = CustomerAuthServer;
