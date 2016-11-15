/**
 * Created by zenit1 on 13/11/2016.
 */

"use strict";
const async = require('async');


const path = require('path');

const utils = require('../../utils');


const Router     = require('../../routers/beame_auth');
const public_dir = path.join(__dirname, '..', '..', '..', 'public');

const beameSDK          = require('beame-sdk');
const module_name       = "BeameAuthServer";
const BeameLogger       = beameSDK.Logger;
const logger            = new BeameLogger(module_name);
const BeameAuthServices = require('./authServices');

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

		this._whispererManager = null;

		this._qrMesaaging = null;
	}

	/**
	 * @param {Function|null} [cb]
	 */
	start(cb) {

		beameSDK.BeameServer(this._fqdn, this._app, (data, app) => {
				logger.info(`Beame authorization server started on ${this._fqdn} `);

				this._server = app;


				this._initWhispererManager()
					.then(this._initQrMessaging.bind(this))
					.then(this._startSocketioServer.bind(this))
					.then(()=>{
						cb && cb(null, this._server);
					});

			}, error=> {
				cb && cb(error, null);
			}
		);

	}

	/**
	 * @param {Socket} socket
	 * @private
	 */
	_onWhispererBrowserConnection(socket) {

		this._whispererManager.onBrowserConnection(socket);
	}

	/**
	 * @param {Socket} socket
	 * @private
	 */
	_onQrBrowserConnection(socket) {
		this._qrMesaaging.onQrBrowserConnection(socket);
	}

	/**
	 * @param {Socket} socket
	 * @private
	 */
	_onMobileConnection(socket) {
		this._whispererManager.onMobileConnection(socket);
	}

	/**
	 *
	 * @private
	 */
	_startSocketioServer(){
		/** @type {Socket} */
		let socketio = require('socket.io')(this._server);

		//noinspection JSUnresolvedFunction
		socketio.of('whisperer').on('connection', this._onWhispererBrowserConnection.bind(this));
		//noinspection JSUnresolvedFunction
		socketio.of('mobile').on('connection', this._onQrBrowserConnection.bind(this));
		//noinspection JSUnresolvedFunction
		socketio.of('qr').on('connection', this._onMobileConnection.bind(this));

		return Promise.resolve();
	}

	_initWhispererManager() {

		const WhispererManager = require('BeameWhisperer').Manager;
		const WhispererMode    = require('BeameWhisperer').WhispererMode;


		this._whispererManager = new WhispererManager(
			WhispererMode.PROVISION,
			this._fqdn,
			this._matchingServerFqdn,
			this._callbacks,
			60000);

		return Promise.resolve();
	}

	_initQrMessaging() {
		const QrMessaging = require('../../qrMessaging');

		this._qrMesaaging = new QrMessaging(this._callbacks);

		return Promise.resolve();
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