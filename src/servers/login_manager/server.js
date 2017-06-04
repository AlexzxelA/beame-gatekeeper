/**
 * Created by zenit1 on 01/06/2017.
 */
"use strict";

const path = require('path');

const utils  = require('../../utils');
const Router = require('../../routers/login_manager');

const public_dir = path.join(__dirname, '..', '..', '..', process.env.BEAME_INSTA_DOC_ROOT);


const beameSDK    = require('beame-sdk');
const module_name = "LoginManagerServer";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

class LoginManagerServer {

	/**
	 *
	 * @param {String|undefined|null} [fqdn]
	 * @param {Router|undefined|null} [app]
	 */
	constructor(fqdn, app) {
		this._fqdn = fqdn;

		this._app = app || utils.setExpressApp(Router.router, public_dir);

		this._server = null;

	}

	get app() {
		return this._app;
	}

	/**
	 * @param {Function|null} [cb]
	 */
	start(cb) {

		if (!this._fqdn) {
			cb && cb(`Fqdn not defined for login manager server`, null);
			return;
		}

		beameSDK.BaseHttpsServer(this._fqdn, {
			requestCert:        true,
			rejectUnauthorized: false
		}, this._app, (data, app) => {
			logger.info(`Login manager server started on ${this._fqdn} `);

			this._server = app;

			cb && cb(null, this._server);

		}, error => {
			cb && cb(error, null);

		});


	}

	stop() {
		if (this._server) {
			this._server.close();
			this._server = null;
		}
	}
}

module.exports = LoginManagerServer;