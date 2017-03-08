/**
 * Created by Alexz on 07/02/2017.
 */
"use strict";


/**
 * @typedef {Object} MessagingCallbacks
 * @property {Function|null} [RegisterFqdn]
 * @property {Function|null} [DeleteSession]
 * @property {Function|null} [Login]
 */
const BeameLogin   = require('./beame_login');

class BeameLoginManager {

	/**
	 * @param {String} fqdn
	 * @param {String} [matchingServerFqdn]
	 * @param {MessagingCallbacks} callbacks
	 * @param {Object|null} [socket_options]
	 * @param {String} serviceName
	 */
	constructor(fqdn, matchingServerFqdn, callbacks, socket_options, serviceName) {
		/** @type {String} */
		this._fqdn = fqdn;

		/** @type {Object} */
		this._options = socket_options || {};

		/** @type {String} */
		this._matchingServerFqdn = matchingServerFqdn;


		this.logins = {};

		this._callbacks = callbacks;

		this._serviceName = serviceName;

	}


	//noinspection JSUnusedGlobalSymbols
	/**
	 * @param {Socket} socket
	 * @param {String} relayFqdn
	 */
	onBrowserConnection(socket,relayFqdn) {

		let beameLogin = new BeameLogin(socket, this._fqdn, this._matchingServerFqdn, relayFqdn,
			this._options, this._serviceName, this._loginServers);

		this.logins[beameLogin.sessionId] = beameLogin;

		logger.debug(`[${beameLogin.sessionId}] Session START on ${socket.id}`);

		beameLogin.start();

		socket.on('disconnect', () => {
			delete this.logins[beameLogin.sessionId];
		});

	}
}


module.exports = BeameLoginManager;
