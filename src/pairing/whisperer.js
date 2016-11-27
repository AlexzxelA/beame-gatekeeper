/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";

const uuid        = require('node-uuid');
const Constants   = require('../../constants');
const beameSDK    = require('beame-sdk');
const beameUtils  = beameSDK.BeameUtils;
const CommonUtils = beameSDK.CommonUtils;
const authToken   = beameSDK.AuthToken;
const store       = new (beameSDK.BeameStore)();
const module_name = "Whisperer";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

/**
 * @typedef {Object} SessionData
 * @property {String} sessionId
 * @property {Number} timeout
 * @property {String} whispererFqdn
 */

class Whisperer {

	/**
	 * @param {AuthMode} mode
	 * @param {Object} socket
	 * @param {String} serverFqdn
	 * @param {String} matchingServerFqdn
	 * @param {MessagingCallbacks} callbacks
	 * @param {Number} sendPinInterval
	 * @param {Number} socketDisconnectTimeout
	 * @param {Object} socket_options
	 * @param {String} serviceName
	 */
	constructor(mode, socket, serverFqdn, matchingServerFqdn, callbacks, socket_options, sendPinInterval, socketDisconnectTimeout, serviceName) {

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
		this._matchingServerFqdn      = matchingServerFqdn;
		this._callbacks               = callbacks;
		this._sendPinInterval         = sendPinInterval;
		this._socketDisconnectTimeout = socketDisconnectTimeout;
		this._creds                   = store.getCredential(this._fqdn);
		this._serviceName             = serviceName;
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
					let socket = require('socket.io-client')(this._matchingServerFqdn + '/whisperer', opts);
					/** @type {Socket} */
					this.matchingServerSocketClient = socket;

					socket.on('connect', () => {
						let signature = this._creds.sign({fqdn: this._fqdn});
						socket.emit('id_whisperer', signature);
						logger.debug(`[${this._sessionId}] connected to matching server`);
						resolve();
					});

					socket.on('new_pin', (randomNumbers) => {
						this._socket.emit('pindata', randomNumbers);
					} );

					socket.on('mobile_matched', this.mobileConnected.bind(this));
				} catch (e) {
					reject(e);
				}
			}
		);

	}

	start() {
		this.initMatchingServerSocketClient().then(() => {

			this.runWhisperer();

			this._socket.emit('wh_timeout', this._sendPinInterval);

			this._socket.on('disconnect', () => {
				logger.debug(`whisperers ${this._sessionId} session disconnected`);
				setTimeout(() => {
					logger.debug('Whisperer socket closing');

					this.disconnectFromMatchingServer();

				}, this._socketDisconnectTimeout);
			});

			this._socket.on('init_mobile_session', qrData => {

				let retryCount   = 0;
				let sessionRetry = setInterval(() => {
					if (this._mobileSocket) {
						this.stop();
						clearInterval(sessionRetry);
						let qrDataObj = JSON.parse(qrData);
						qrDataObj['service'] = this._serviceName;
						qrDataObj['matching'] = this._matchingServerFqdn;
						this._mobileSocket.emit('session_data', JSON.stringify(qrDataObj));
					}
					else {
						if (retryCount++ > 30) {
							clearInterval(sessionRetry);
							this._socket.emit('mobile_network_error');
						}
					}

				}, 150);
				//stop playing pincodes


			});

			this._socket.on('virtSrvConfig', (data) => {
				logger.debug('<< virtSrvConfig:', data);
				//var signature = crypto.sign(data.UID, authServices.getMyFqdn());

				const onEdgeServerSelected = edge => {

					let fqdn     = this._fqdn,
					    cred     = store.getCredential(fqdn),
					    token    = authToken.create(data.UID, cred, 10),
					    tokenStr = CommonUtils.stringify({
						    "data":      edge.endpoint,
						    'signature': token
					    });

					this._socket.emit("relayEndpoint", tokenStr);
				};

				beameUtils.selectBestProxy(Constants.LoadBalancerURL, 100, 1000, (error, payload) => {
					if (!error) {
						onEdgeServerSelected.call(this, payload);
					}
					else {
						this._socket.emit("network_problem", `Network problem: Relay server could not be found, try again later`);

					}
				});

			});

			this._socket.on('play_please', () => {
				logger.debug(`[${this._sessionId}] play audio received`);
				this.play();
			});

			this._socket.on('stop_please', () => {
				logger.debug(`[${this._sessionId}] stop audio received`);
				this.stop();
			});

			this._socket.on('InfoPacketResponse', (data) => {
				logger.debug('InfoPacketResponse:', data);
				//createEntityWithAuthServer

				let metadata = {
					name:      data.name,
					email:     data.email,
					edge_fqdn: data.edge_fqdn,
					pin:       data.pin,
					user_id:   data.user_id,
					rand:      CommonUtils.randomBytes()
				};

				let registerFqdnFunc = this._callbacks["RegisterFqdn"];

				if (!registerFqdnFunc) {
					logger.error(`registration callback not defined`);
					return;
				}

				registerFqdnFunc(metadata).then(payload => {
					this._deleteSession(data.pin);
					//add service name and matching fqdn for use on mobile
					payload.matching = this._matchingServerFqdn;
					payload.service  = this._serviceName;
					this._socket.emit("mobileProv1", {'data': payload, 'type': 'mobileProv1'});
				}).catch(e => {
					logger.error(`authorizing mobile error  ${BeameLogger.formatError(e)}`);
					this._socket.emit("mobileProv1", {
						'data': 'User data validation failed',
						'type': 'mobileSessionFail'
					});
				});
			});

			this._socket.on('InfoPacketResponseError', (data) => {
				logger.error(`Whisperer Messaging InfoPacketResponseError`, data);
			});

			this._socket.on('close_session', () => {
				this.stop();
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
		this._socket.emit("restartWhisperer");
	}

	disconnectFromMatchingServer() {
		logger.debug(`[${this._sessionId}] stop service on disconnect from matching`);

		this.stop();

		setTimeout(() => {
			if (this.matchingServerSocketClient) {
				logger.debug(`[${this._sessionId}] disconnecting from MatchingServer`);
				this.matchingServerSocketClient.disconnect();
				this.matchingServerSocketClient = null;
			}
		}, 1000)

	}

	runWhisperer() {

		logger.debug(`[${this._sessionId}] running whisperer`);

		/**  @type {SessionData} */
		let data = {
			sessionId:      this._sessionId,
			timeout:        this._sendPinInterval,
			whispererFqdn:  this._fqdn,
			mode:           this._mode,
			socket_options: this._options,
			matching:       this._matchingServerFqdn,
			service:        this._serviceName
		};

		logger.debug(`[${this._sessionId}] emitting create session with data`, data);

		this.matchingServerSocketClient.emit('create_session', data);

	}

	play() {
		//	this.runAudio = true;
		this.runWhisperer();
	}

	stop() {
		if (!this.matchingServerSocketClient) {
			return;
		}
		//noinspection JSValidateTypes
		/**  @type {SessionData} */
		let data = {
			sessionId:     this._sessionId,
			whispererFqdn: this._fqdn
		};
		this.matchingServerSocketClient.emit('stop_play', data);
	}

	mobileConnected(message) {
		logger.debug(`User identified!! Audio stopped, ${message}`);
		this._socket.emit('init_mobile_session', {pin: this._sessionId});
	}
}


module.exports = Whisperer;