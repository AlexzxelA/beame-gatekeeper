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
const module_name = "ApproverManager";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const Approver   = require('./approver');


class ApproverManager {

	/**
	 * @param {String} mode
	 * @param {String} fqdn
	 * @param {String} [matchingServerFqdn]
	 * @param {MessagingCallbacks} callbacks
	 * @param {Number} socketDisconnectTimeout
	 * @param {Object|null} [socket_options]
	 * @param {String} serviceName
	 */
	constructor(mode, fqdn, matchingServerFqdn, callbacks, socket_options, socketDisconnectTimeout, serviceName) {
		/** @type {String} */
		this._fqdn = fqdn;

		/** @type {Object} */
		this._options = socket_options || {};

		/** @type {AuthMode} */
		this._mode = mode;

		/** @type {String} */
		this._matchingServerFqdn = matchingServerFqdn;

		this._socketDisconnectTimeout = socketDisconnectTimeout;

		this.approvers = {};

		this._callbacks = callbacks;

		this._serviceName = serviceName;
	}


	//noinspection JSUnusedGlobalSymbols
	/**
	 * @param {Socket} socket
	 */
	onApproverBrowserConnection(socket) {

		let approver = new Approver(this._mode, socket, this._fqdn, this._matchingServerFqdn, this._callbacks,  this._options, this._socketDisconnectTimeout,this._serviceName);

		this.approvers[approver.sessionId] = approver;

		logger.debug(`[${approver.sessionId}] Session START on ${socket.id}`);

		approver.start();

		socket.on("restartFromMatching", approver.onRestartFromMatching.bind(approver, socket));

		socket.on('disconnect', () => {
			approver.disconnectFromMatchingServer.bind(approver, socket);
			delete this.approvers[approver.sessionId];
		});

	}
}


module.exports = ApproverManager;