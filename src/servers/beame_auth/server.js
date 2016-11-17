/**
 * Created by zenit1 on 13/11/2016.
 */

"use strict";
const path = require('path');

const utils = require('../../utils');


const Router     = require('../../routers/beame_auth');
const public_dir = path.join(__dirname, '..', '..', '..', 'public');

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

		this._authServices = new BeameAuthServices(this._fqdn);

		/** @type {MessagingCallbacks} */
		this._callbacks = {
			RegisterFqdn:  this._authServices.getRegisterFqdn.bind(this._authServices),
			DeleteSession: BeameAuthServices.deleteSession
		};

		this._app = app || utils.setExpressApp((new Router(this._authServices)).router, public_dir);

		this._server = null;

		this._socketServer = null;

	}

	/**
	 * @param {Function|null} [cb]
	 */
	start(cb) {

		beameSDK.BeameServer(this._fqdn, this._app, (data, app) => {
				logger.info(`Beame authorization server started on ${this._fqdn} `);

				this._server = app;

				/** @type {MessagingCallbacks} */
				let callbacks = {
					RegisterFqdn:  this._authServices.getRegisterFqdn.bind(this._authServices),
					DeleteSession: BeameAuthServices.deleteSession
				};

				let beameInstaServer = new BeameInstaSocketServer(this._server, this._fqdn, this._matchingServerFqdn, (require('BeameWhisperer').WhispererMode).PROVISION, callbacks);

				beameInstaServer.start().then(socketio_server=> {
					this._socketServer = socketio_server;
					cb && cb(null, this._server);
				}).catch(error=> {
					this.stop();
					cb && cb(error, null);
				})


			}, error=> {
				cb && cb(error, null);
			}
		);

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
	}
}

module.exports = BeameAuthServer;