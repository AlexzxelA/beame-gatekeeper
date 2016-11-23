/**
 * Created by zenit1 on 13/11/2016.
 */

"use strict";


/**
 * @typedef {Object} MessagingCallbacks
 * @property {Function|null} [RegisterFqdn]
 * @property {Function|null} [DeleteSession]
 * @property {Function|null} [Login]
 */

const beameSDK    = require('beame-sdk');
const module_name = "BeameInstaSocketServer";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const Bootstrapper = require('./bootstrapper');
const bootstrapper = new Bootstrapper();

class BeameInstaSocketServer {

	/**
	 *
	 * @param {String} fqdn
	 * @param {String} matchingServerFqdn
	 * @param {Router|null} [srv]
	 * @param {String} mode
	 * @param {MessagingCallbacks} callbacks
	 * @param {Object|null} [socket_options]
	 */
	constructor(srv, fqdn, matchingServerFqdn, mode, callbacks, socket_options) {
		this._fqdn = fqdn;

		this._authMode = mode;

		this._matchingServerFqdn = matchingServerFqdn;

		this._callbacks = callbacks;

		this._options = socket_options || {};

		/** @type {Socket|null} */
		this._socketioServer = null;

		this._server = srv;

		this._whispererManager = null;

		this._qrMesaaging = null;

		this._serviceName = bootstrapper.serviceName;
	}


	start() {

		return new Promise((resolve, reject) => {
				this._initWhispererManager()
					.then(this._initQrMessaging.bind(this))
					.then(this._startSocketioServer.bind(this))
					.then(() => {
						logger.info(`Server started on ${this._fqdn}`);
						resolve(this._socketioServer);
					}).catch(reject);
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
	_startSocketioServer() {

		logger.info(`BeameInstaSocketServer started`);
		logger.debug(`BeameInstaSocketServer starting with options ${JSON.stringify(this._options)}`);

		this._socketioServer = require('socket.io')(this._server, this._options);
		//noinspection JSUnresolvedFunction
		this._socketioServer.of('whisperer').on('connection', this._onWhispererBrowserConnection.bind(this));
		//noinspection JSUnresolvedFunction
		this._socketioServer.of('mobile').on('connection', this._onMobileConnection.bind(this));
		//noinspection JSUnresolvedFunction
		this._socketioServer.of('qr').on('connection', this._onQrBrowserConnection.bind(this));

		return Promise.resolve();
	}

	_initWhispererManager() {

		const WhispererManager = require('./paring/whisperer_manager');


		this._whispererManager = new WhispererManager(
			this._authMode,
			this._fqdn,
			this._matchingServerFqdn,
			this._callbacks,
			this._options,
			bootstrapper.whispererSendPinInterval,
			bootstrapper.killSocketOnDisconnectTimeout,
			this._serviceName
		);

		return Promise.resolve();
	}

	_initQrMessaging() {
		const QrMessaging = require('./paring/qr_messaging');

		this._qrMesaaging = new QrMessaging(this._fqdn, this._matchingServerFqdn, this._callbacks, this._serviceName);

		return Promise.resolve();
	}

	//noinspection JSUnusedGlobalSymbols
	stop() {
		if (this._socketioServer) {
			this._socketioServer.close();
			this._socketioServer = null;
		}
	}
}

module.exports = BeameInstaSocketServer;