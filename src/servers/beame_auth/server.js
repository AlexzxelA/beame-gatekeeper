/**
 * Created by zenit1 on 13/11/2016.
 */

"use strict";
const async = require('async');
const path  = require('path');
const http  = require('http');
const utils = require('../../utils');


const Router    = require('../../routers/beame_auth');
const Constants = require('../../../constants');

const public_dir = path.join(__dirname, '..', '..', '..', process.env.BEAME_INSTA_DOC_ROOT);

const beameSDK               = require('beame-sdk');
const module_name            = "BeameAuthServer";
const BeameLogger            = beameSDK.Logger;
const logger                 = new BeameLogger(module_name);
const BeameAuthServices      = require('../../authServices');
const BeameInstaSocketServer = require('../../beameInstaSocketServer');

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

		this._beameAdminServices = BeameAuthServices.getInstance();

		/** @type {MessagingCallbacks} */
		this._callbacks = {
			RegisterFqdn:     this._beameAdminServices.getRegisterFqdn.bind(this._beameAdminServices),
			RegRecovery:      this._beameAdminServices.recoveryRegistration.bind(this._beameAdminServices),
			UserDataReceived: BeameAuthServices.onUserDataReceived,
			DeleteSession:    BeameAuthServices.deleteSession
		};

		this._app = app || utils.setExpressApp((new Router(this._beameAdminServices)).router, public_dir);

		this._server = null;

		this._socketServer = null;

		this._httpSocketServer = null;

	}

	/**
	 * @param {Function|null} [cb]
	 */
	start(cb) {

		async.parallel([
				callback => {
					const httpServer = http.createServer(this._app);

					httpServer.listen(Constants.BeameAuthServerLocalPort);

					let beameHttpInstaServer = new BeameInstaSocketServer(httpServer, this._fqdn, this._matchingServerFqdn, Constants.AuthMode.PROVISION, this._callbacks);

					beameHttpInstaServer.start().then(socketio_server => {
						this._httpSocketServer = socketio_server;
						callback(null);
					}).catch(error => {
						callback(error);
					})
				},
				callback => {
					beameSDK.BeameServer(this._fqdn, this._app, (data, app) => {
							logger.info(`Beame authorization server started on ${this._fqdn} `);

							this._server = app;

							let beameInstaServer = new BeameInstaSocketServer(this._server, this._fqdn, this._matchingServerFqdn, Constants.AuthMode.PROVISION, this._callbacks);

							beameInstaServer.start().then(socketio_server => {
								this._socketServer = socketio_server;
								callback(null);
							}).catch(error => {
								callback(error);
							})


						}, error => {
							cb && cb(error, null);
						}
					);
				}
			],
			error => {
				if (error) {

					logger.error(`Beame authorization server starting error: ${BeameLogger.formatError(error)}`);
					cb && cb(error, null);
				}
				else {
					cb && cb(null, this._server);
				}
			});
	}

	stop() {
		if (this._server) {
			this._server.close();
			this._server = null;
		}
		if (this._socketServer) {
			this._socketServer.stop();
			this._socketServer = null;
		}
		if (this._httpSocketServer) {
			for (let srvKey in this._httpSocketServer) {
				this._httpSocketServer[srvKey].stop();
				this._httpSocketServer[srvKey] = null;
			}
			// this._httpSocketServer.stop();
			// this._httpSocketServer = null;
		}
	}
}

module.exports = BeameAuthServer;