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
const utils       = require('./utils');
const Constants   = require('../constants');
const Bootstrapper = require('./bootstrapper');
const bootstrapper = Bootstrapper.getInstance();

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

		this._optionsApprover = Object.assign({},socket_options || {});

		/** @type {Socket|null} */
		this._socketioServer = null;

		this._socketioServerAtPath = null;

		this._server = srv;

		this._whispererManager = null;

		this.qrMessaging = null;

		this._approverManager = null;

		this._serviceName = bootstrapper.serviceName;

		this._relayFqdn = null;

		this._loginRelayFqdn = null;
	}


	start() {

		return new Promise((resolve, reject) => {
				this._initWhispererManager()
					.then(this._initQrMessaging.bind(this))
					.then(this._initApproverManager.bind(this))
					.then(this._initLoginManager(this))
					.then(this._getLocalRelay.bind(this))
					.then(this._getLoginRelay.bind(this))
					.then(this._startSocketioServer.bind(this))
					.then(() => {
						logger.info(`Socket Server started on ${this._fqdn}`);
						resolve({srv1:this._socketioServer, srv2:this._socketioServerAtPath});
					}).catch(reject);
			}
		);
	}

	_getLoginRelay(){
		return new Promise((resolve, reject) => {
			let tmp = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
			console.log('Constants.BeameLoginURL:',Constants.BeameLoginURL,',tmp:',tmp);
			if(Constants.BeameLoginURL.indexOf(tmp) >= 0){
				this._loginRelayFqdn = this._relayFqdn;resolve(this._loginRelayFqdn);
			}
			else
			utils.getRelayFqdn(Constants.BeameLoginURL + '/beame-gw/config-data').then((relayFqdn)=> {
				this._loginRelayFqdn = relayFqdn;// || this._relayFqdn;
				resolve(relayFqdn);
			}).catch((e)=>{this._loginRelayFqdn = this._relayFqdn; resolve(this._loginRelayFqdn);});
		});
	}

	_getLocalRelay(){
		return new Promise((resolve, reject) => {
			utils.getLocalRelayFqdn().then((relay)=>{this._relayFqdn = relay; resolve();}).catch((e)=>{reject(e);});
		});
	}

	/*_getLocalRelay(){
		const apiConfig   = require('../config/api_config.json');
		const ProvisionApi     = beameSDK.ProvApi;
		const authToken    = beameSDK.AuthToken;
		const store        = new (beameSDK.BeameStore)();
		return new Promise((resolve, reject) => {
			try {
				let fqdn     = this._fqdn,
				    cred     = store.getCredential(fqdn),
				    token    = authToken.create(fqdn, cred, 10),
				    provisionApi = new ProvisionApi();

				provisionApi.makeGetRequest(`https://${this._matchingServerFqdn}${apiConfig.Actions.Matching.GetRelay.endpoint}`, null, (error, payload) => {
					if (error) {
						reject(error);
					}
					else {
						this._relayFqdn = payload.relay;
						resolve();
					}
				}, token);
			} catch (e) {
				reject(e);
			}
		});
	};*/

	/**
	 * @param {Socket} socket
	 * @private
	 */
	_onWhispererBrowserConnection(socket) {

		this._whispererManager.onBrowserConnection(socket,this._relayFqdn);
	}

	/**
	 * @param {Socket} socket
	 * @private
	 */
	_onApproverBrowserConnection(socket) {
		this._approverManager.onApproverBrowserConnection(socket);
	}

	/**
	 * @param {Socket} socket
	 * @private
	 */
	_onQrBrowserConnection(socket) {
		this.qrMessaging.onQrBrowserConnection(socket);
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
		this._socketioServer.of('beame_login').on('connection', this._onLoginBrowserConnection.bind(this));

		this._socketioServerAtPath = require('socket.io')(this._server,
			Object.assign(this._optionsApprover, {'path':'/customer-approve/socket.io'}));
		this._socketioServerAtPath.of('approver').on('connection', this._onApproverBrowserConnection.bind(this));

		return Promise.resolve();
	}

	_initApproverManager() {

		const ApproverManager = require('./pairing/approver_manager');


		this._approverManager = new ApproverManager(
			this._authMode,
			this._fqdn,
			this._matchingServerFqdn,
			this._callbacks,
			this._optionsApprover,
			bootstrapper.killSocketOnDisconnectTimeout,
			this._serviceName
		);

		return Promise.resolve();
	}

	_initWhispererManager() {

		const WhispererManager = require('./pairing/whisperer_manager');


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
		const QrMessaging = require('./pairing/qr_messaging');

		this.qrMessaging = new QrMessaging(this._fqdn, this._matchingServerFqdn, this._callbacks, this._serviceName);

		return Promise.resolve();
	}

	_initLoginManager() {
		const LoginManager = require('./pairing/beame_login_manager');

		this._loginManager = new LoginManager(
			this._fqdn,
			this._matchingServerFqdn,
			this._callbacks,
			this._options,
			this._serviceName
		);

		return Promise.resolve();
	}
	_onLoginBrowserConnection(socket) {
		this._getLoginRelay().then((relay)=>{
			this._loginManager.onBrowserConnection(socket, relay);
		}).catch(()=>{this._loginManager.onBrowserConnection(socket,this._loginRelayFqdn);});

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