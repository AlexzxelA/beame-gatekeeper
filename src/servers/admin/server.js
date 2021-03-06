/**
 * Created by zenit1 on 13/11/2016.
 */

"use strict";
const path       = require('path');

const utils     = require('../../utils');
const Router    = require('../../routers/admin');

const public_dir = path.join(__dirname, '..', '..', '..', process.env.BEAME_INSTA_DOC_ROOT);


const beameSDK          = require('beame-sdk');
const module_name       = "BeameAuthServer";
const BeameLogger       = beameSDK.Logger;
const logger            = new BeameLogger(module_name);
const BeameAdminServices = require('./admin_services');

class BeameAdminServer {

	/**
	 *
	 * @param {String|undefined|null} [fqdn]
	 * @param {Router|undefined|null} [app]
	 * @param {ServiceManager} _serviceManager
	 */
	constructor(fqdn, app, _serviceManager) {
		this._fqdn = fqdn;

		this._beameAdminServices = new BeameAdminServices(_serviceManager);

		this._app = app || utils.setExpressApp((new Router(this._beameAdminServices)).router, public_dir);

		this._server = null;

	}

	get app(){
		return this._app;
	}

	/**
	 * @param {Function|null} [cb]
	 */
	start(cb) {

		if(!this._fqdn){
			cb && cb(`Fqdn not defined for admin server`,null);
			return;
		}

		beameSDK.BaseHttpsServer(this._fqdn, {}, this._app, (data, app) => {
				logger.info(`Beame authorization server started on ${this._fqdn} `);

				this._server = app;

				cb && cb(null, this._server);

			}, error => {
				cb && cb(error, null);
			}
		);

	}

	stop() {
		if (this._server) {
			this._server.close();
			this._server = null;
		}
	}
}

module.exports = BeameAdminServer;