/**
 * Created by zenit1 on 13/11/2016.
 */

"use strict";
const async = require('async');


const path = require('path');

const utils = require('../../utils');


const Router     = require('../../routers/beame_auth');
const public_dir = path.join(__dirname, '..', '..', '..', 'public');

const beameSDK     = require('beame-sdk');
const module_name  = "BeameAuthServer";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const AuthServices = require('./authServices');

class BeameAuthServer {

	/**
	 *
	 * @param {String} fqdn
	 * @param {String} matchingServerFqdn
	 * @param {Router|null} [app]
	 */
	constructor(fqdn, matchingServerFqdn, app) {
		this._fqdn = fqdn;

		this._matchingServerFqdn = matchingServerFqdn;

		this._authServices = new AuthServices(this._fqdn);

		this._app = app || utils.setExpressApp((new Router(this._authServices)).router, public_dir);

		this._server = null;

		this._whisperereServer = null;
	}

	/**
	 * @param {Function|null} [cb]
	 */
	start(cb) {

		async.parallel([
			callback=> {
				beameSDK.BeameServer(this._fqdn, this._app, (data, app) => {
						logger.debug(`Beame authorization server started on ${this._fqdn} `);

						this._server = app;

						callback(null, true);
					}, error=> {
						callback(error, null)
					}
				);

			},
			callback => {
				const WhispererServer = require('BeameWhisperer').Server;
				const WhispererMode   = require('BeameWhisperer').WhispererMode;
				let whispererServer   = new WhispererServer(
					WhispererMode.PROVISION,
					this._fqdn,
					this._matchingServerFqdn,
					this._app,
					this._authServices,
					60000);

				whispererServer.start((err, whisperer)=> {
					if (!err) {
						this._whisperereServer = whisperer;
						callback();
						return;
					}

					callback(err);
				});
			}
		], error=> {
			if (error) {
				cb && cb(error, null);
				return;
			}

			cb && cb(null, this._server);
		});
	}


	//noinspection JSUnusedGlobalSymbols
	stop() {
		if (this._server) {
			this._server.close();
			this._server = null;
		}

		if (this._whisperereServer) {
			this._whisperereServer.close();
			this._whisperereServer = null;
		}
	}
}


module.exports = BeameAuthServer;