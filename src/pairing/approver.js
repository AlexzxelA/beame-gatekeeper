/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";

const uuid         = require('uuid');
const Constants    = require('../../constants');
const beameSDK     = require('beame-sdk');
const beameUtils   = beameSDK.BeameUtils;
const CommonUtils  = beameSDK.CommonUtils;
const store        = new (beameSDK.BeameStore)();
const module_name  = "Approver";
const BeameLogger  = beameSDK.Logger;
const authToken    = beameSDK.AuthToken;
const logger       = new BeameLogger(module_name);
const Bootstrapper = require('../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();

/**
 * @typedef {Object} SessionData
 * @property {String} sessionId
 * @property {Number} timeout
 * @property {String} approverFqdn
 */

class Approver {

	/**
	 * @param {AuthMode} mode
	 * @param {Object} socket
	 * @param {String} serverFqdn
	 * @param {String} matchingServerFqdn
	 * @param {MessagingCallbacks} callbacks
	 * @param {Number} socketDisconnectTimeout
	 * @param {Object} socket_options
	 * @param {String} serviceName
	 */
	constructor(mode, socket, serverFqdn, matchingServerFqdn, callbacks, socket_options, socketDisconnectTimeout, serviceName) {

		this._sessionId = uuid.v4();

		/** @type {AuthMode} */
		this._mode = mode;

		/** @type {Socket} */
		this._socket = socket;

		/** @type {Object} */
		this._options = socket_options;

		/** @type {Socket} */
		this._mobileSocket = null;

		//this.socketIsConnected = true;
		//this.runAudio          = true;

		//noinspection JSUnresolvedVariable
		this._fqdn                    = serverFqdn;
		this._edge = null;

		this._matchingServerFqdn      = matchingServerFqdn;
		this._callbacks               = callbacks;
		this._socketDisconnectTimeout = socketDisconnectTimeout;
		this._creds                   = store.getCredential(this._fqdn);
		this._serviceName             = serviceName;
		this._qrData                  = null;
		this._jsonQrData              = null;
		this._currentPin              = "none";
		this._userImage               = null;
		this._pairingUtils            = null;
	}

	get sessionId() {
		return this._sessionId;
	}

	initMatchingServerSocketClient() {

		return new Promise((resolve, reject) => {
				try {

					logger.debug(`[${this._sessionId}] connecting to matching server`);

					//for future use of client certificates
					let opts   = this._creds.getHttpsServerOptions();
					/** @type {Socket} */
					let socket = require('socket.io-client')(this._matchingServerFqdn + '/approve', opts);
					/** @type {Socket} */
					this.matchingServerSocketClient = socket;

					socket.on('mobile_matched', this.mobileConnected.bind(this));

					socket.on('connect', () => {
						let signature = this._creds.sign({fqdn: this._fqdn});
						socket.emit('id_approver', signature);
						logger.debug(`[${this._sessionId}] connected to matching server`);
						resolve();
					});


				} catch (e) {
					logger.info(`initMatchingServerSocketClient failure ${e.message}`);
					reject(e);
				}
			}
		);
	}

	mobileConnected(message) {
		logger.debug(`User identified!! Service stopped, ${this._qrData}`);
		this._socket.emit('connect_ok');
	}

	start() {
		logger.info('Starting approver');
		this._getEdgeEndpoint();
		const pairingUtils      = require('./pairing_utils');
		this._pairingUtils      = new pairingUtils(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer),
			this._socket, module_name);
		this._pairingUtils.setCommonHandlers();

		this._socket.on('browser_connected', (data) => {
			logger.debug('<< Approver browser_connected:', data);
			this._signBrowserHostname(this._socket, data);
			//var signature = crypto.sign(data.UID, authServices.getMyFqdn());
		});

		this._socket.on('init_mobile_session', qrData => {
			this._qrData = qrData;
			logger.info('init_mobile_session received:', qrData);
			this._jsonQrData              = JSON.parse(qrData);
			this._jsonQrData['sessionId'] = this._sessionId;
			this._jsonQrData['service']   = this._serviceName;
			this._jsonQrData['matching']  = this._matchingServerFqdn;
			this._jsonQrData['appId']     = bootstrapper.appId;
		});

		this.initMatchingServerSocketClient().then(() => {

			this.runApprover();

			this._socket.on('disconnect', () => {
				logger.debug(`approvers ${this._sessionId} session disconnected`);
				setTimeout(() => {
					logger.debug('Approver socket closing');

					this.disconnectFromMatchingServer();

				}, this._socketDisconnectTimeout);
			});

			this._socket.on('_disconnect', () => {
				//force disconnect event
				this.disconnectFromMatchingServer();
				this._socket.disconnect();
				this._socket = null;
			});


			this._socket.on('InfoPacketResponseError', (data) => {
				logger.error(`Approver Messaging InfoPacketResponseError`, data);
			});

			this._socket.on('close_session', () => {
				logger.debug('close_session received');

				this._socket.disconnect();
				setTimeout(() => {
					this.disconnectFromMatchingServer();
				}, 1000)
			});

		}).catch(error => {
			logger.error(`connection to matching failed`, error);
			this._socket.emit('match_not_found');
		});
	}

	_deleteSession(pin) {
		let deleteSessionFunc = this._callbacks["DeleteSession"];

		if (!deleteSessionFunc) {
			logger.error(`delete session callback not defined`);
			return;
		}

		deleteSessionFunc(pin);
	}

	onRestartFromMatching() {
		this._socket.emit("restartApprover");
	}

	disconnectFromMatchingServer() {
		logger.debug(`[${this._sessionId}] stop service on disconnect from matching`);

		this.stop();

		setTimeout(() => {
			if (this.matchingServerSocketClient) {
				logger.debug(`Approver [${this._sessionId}] disconnecting from MatchingServer`);
				this.matchingServerSocketClient.disconnect();
				this.matchingServerSocketClient = null;
			}
		}, 100)
	}

	runApprover() {

		logger.debug(`[${this._sessionId}] running approver`);

		/**  @type {SessionData} */
		let data = {
			sessionId:      this._sessionId,
			approverFqdn:   this._fqdn,
			mode:           this._mode,
			socket_options: this._options,
			matching:       this._matchingServerFqdn,
			service:        this._serviceName,
			appId:          bootstrapper.appId
		};

		logger.debug(`[${this._sessionId}] emitting create session with data`, data);
		this._socket.emit('init_mobile_session',
			{pin: this._sessionId, 'matching':this._matchingServerFqdn, 'service':this._serviceName, 'appId':bootstrapper.appId});
		this.matchingServerSocketClient.emit('create_session', data);

		this.matchingServerSocketClient.on('requestQrData', ()=>{
			let waitingForData = setInterval(() => {
				if(this._qrData){
					clearInterval(waitingForData);
					logger.debug('Sending qrData to matching');
					this.matchingServerSocketClient.emit('qrData', JSON.stringify(this._jsonQrData));
				}
			}, 200);
		});
	}

	stop() {
		if (!this.matchingServerSocketClient) {
			return;
		}
		//noinspection JSValidateTypes
		/**  @type {SessionData} */
		let data = {
			sessionId:     this._sessionId,
			approverFqdn: this._fqdn
		};
		this.matchingServerSocketClient.emit('stop_play', data);
	}

	_getEdgeEndpoint(){
		return new Promise((resolve, reject)=>{
			beameUtils.selectBestProxy(null, 100, 1000, (error, payload) => {
				if (!error) {
					this._edge = payload;
					resolve();
				}
				else {
					this._edge = null;
					reject();
				}
			});
		});

	}

	_signBrowserHostname(socket , data) {
		let waiting = false;
		let signTimer = setInterval(()=>{
			if (this._edge) {
				clearInterval(signTimer);
				let fqdn     = this._fqdn,
					cred     = store.getCredential(fqdn),
					token    = authToken.create(data, cred, 10),
					tokenStr = CommonUtils.stringify({
						'imageRequired': bootstrapper.registrationImageRequired,
						"data":          this._edge.endpoint,
						'signature':     token
					});

				socket.emit("relayEndpoint", tokenStr);
			} else {
				if(!waiting){
					waiting = true;
					this._getEdgeEndpoint().then(()=>{waiting = false;});
				}
			}
		}, 100);
	}
}


module.exports = Approver;