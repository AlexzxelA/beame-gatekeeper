/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";


/**
 * @typedef {Object} MessagingCallbacks
 * @property {Function|null} [RegisterFqdn]
 * @property {Function|null} [DeleteSession]
 * @property {Function|null} [Login]
 */

const beameSDK    = require('beame-sdk');
const module_name = "WhispererManager";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const Whisperer   = require('./whisperer');


class WhisperersManager {

	/**
	 * @param {String} mode
	 * @param {String} fqdn
	 * @param {String} [matchingServerFqdn]
	 * @param {MessagingCallbacks} callbacks
	 * @param {Number} [sendPinInterval]
	 * @param {Number} socketDisconnectTimeout
	 * @param {Object|null} [socket_options]
	 * @param {String} serviceName
	 */
	constructor(mode, fqdn, matchingServerFqdn, callbacks, socket_options, sendPinInterval, socketDisconnectTimeout, serviceName) {
		/** @type {String} */
		this._fqdn = fqdn;

		/** @type {Object} */
		this._options = socket_options || {};

		/** @type {AuthMode} */
		this._mode = mode;

		/** @type {String} */
		this._matchingServerFqdn = matchingServerFqdn;

		/** @type {Number} */
		this._sendPinInterval = sendPinInterval;

		this._socketDisconnectTimeout = socketDisconnectTimeout;

		this.whisperers = {};

		this._callbacks = callbacks;

		this._serviceName = serviceName;
	}


	//noinspection JSUnusedGlobalSymbols
	/**
	 * @param {Socket} socket
	 */
	onBrowserConnection(socket) {

		let whisperer = new Whisperer(this._mode, socket, this._fqdn, this._matchingServerFqdn, this._callbacks,  this._options, this._sendPinInterval, this._socketDisconnectTimeout,this._serviceName);

		this.whisperers[whisperer.sessionId] = whisperer;

		logger.debug(`[${whisperer.sessionId}] Session START on ${socket.id}`);

		whisperer.start();

		socket.on("restartFromMatching", whisperer.onRestartFromMatching.bind(whisperer, socket));

		socket.on('disconnect', () => {
			whisperer.disconnectFromMatchingServer.bind(whisperer, socket);
			delete this.whisperers[whisperer.sessionId];


		});

	}

	//noinspection JSMethodCanBeStatic
	//noinspection JSUnusedGlobalSymbols
	/**
	 * @param {Socket} socket
	 */
	onMobileConnection(socket) {
		logger.debug(`Client connection for ${socket.id}`);
		socket.emit('your_id');

		socket.on('register_mobile_provision', sessionId => {
			logger.debug(`Mobile register_mobile_provision for ${sessionId}`);
			let whisperer = this.whisperers[sessionId];
			if (!whisperer) {
				logger.debug(`whisperer_error for ${sessionId}!!!`);
				socket.emit('whisperer_error', `whisperer ${sessionId} not found`);
				socket.disconnect();
				return;
			}

			whisperer._mobileSocket = socket;

		});
	}
}


module.exports = WhisperersManager;