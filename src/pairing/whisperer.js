/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";

const uuid         = require('uuid');
const Constants    = require('../../constants');
const beameSDK     = require('beame-sdk');
const beameUtils   = beameSDK.BeameUtils;
const CommonUtils  = beameSDK.CommonUtils;
const authToken    = beameSDK.AuthToken;
const store        = new (beameSDK.BeameStore)();
const module_name  = "Whisperer";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const Bootstrapper = require('../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();
const AudioPIN_refresh_rate = 1000 * 30;

const pairingShortcut = true;

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
						this._sendPindata(this._socket, randomNumbers);

						if (this._jsonQrData) {
							console.log('whisperer: sending qrData to matching:', this._jsonQrData);
							this._jsonQrData['currentPin'] = this._currentPin;
							socket.emit('qrData', JSON.stringify(this._jsonQrData));
						}
						else {
							this._socket.emit('requestQrData');
						}
					});

					socket.on('mobile_matched', this.mobileConnected.bind(this));
				} catch (e) {
					reject(e);
				}
			}
		);

	}

	start() {
		const pairingUtils = require('./pairing_utils');
		this._pairingUtils = new pairingUtils(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer),
			this._socket, module_name);
		this._pairingUtils.setCommonHandlers();

		this._socket.on('init_mobile_session', qrData => {
			this._qrData = qrData;
			logger.info('init_mobile_session received:', qrData);
			this._jsonQrData              = JSON.parse(qrData);
			this._jsonQrData['sessionId'] = this._sessionId;
			this._jsonQrData['service']   = this._serviceName;
			this._jsonQrData['matching']  = this._matchingServerFqdn;
			this._jsonQrData['appId']     = bootstrapper.appId;
		});

		this._socket.on('pinRequest', () => {
			let lclPin = this._getRandomPin(15,0);
			this._socket.emit('pindata', this._buildDataPack(lclPin));
		});

		if(!pairingShortcut){
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

				this._socket.on('_disconnect', () => {
					//force disconnect event
					this.disconnectFromMatchingServer();
					this._socket.disconnect();
					this._socket = null;
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
						hash:      data.hash
					};

					let registerFqdnFunc = this._callbacks["RegisterFqdn"];

					if (!registerFqdnFunc) {
						logger.error(`registration callback not defined`);
						return;
					}

					registerFqdnFunc(metadata).then(payload => {
						this._deleteSession(data.pin);
						//add service name and matching fqdn for use on mobile
						payload.imageRequired = bootstrapper.registrationImageRequired;
						payload.matching      = this._matchingServerFqdn;
						payload.service       = this._serviceName;
						this._socket.emit("mobileProv1", {'data': payload, 'type': 'mobileProv1'});
					}).catch(e => {
						logger.error(`authorizing mobile error ${BeameLogger.formatError(e)}`);
						this._socket.emit("mobileProv1", {
							'data': `User data validation failed ${BeameLogger.formatError(e)}`,
							'type': 'mobileSessionFail'
						});
					});
				});

				this._socket.on('regRecovery', (data) => {
					logger.debug('regRecovery:', data);
					//createEntityWithAuthServer

					let metadata = {
						name:      data.name,
						email:     data.email,
						edge_fqdn: data.edge_fqdn,
						pin:       data.pin,
						user_id:   data.user_id
					};

					let recoveryRegisterFunc = this._callbacks["RegRecovery"];

					if (!recoveryRegisterFunc) {
						logger.error(`recovery registration callback not defined`);
						return;
					}

					recoveryRegisterFunc(metadata).then(payload => {
						this._deleteSession(data.pin);


						switch (payload.type) {
							case 'token':
								//add service name and matching fqdn for use on mobile
								payload.imageRequired = bootstrapper.registrationImageRequired;
								payload.matching      = this._matchingServerFqdn;
								payload.service       = this._serviceName;
								this._socket.emit("mobileProv1", {'data': payload, 'type': 'mobileProv1'});
								break;
							case 'cert':
								//TODO add logic
								break;
						}

					}).catch(e => {
						logger.error(`authorizing mobile error ${BeameLogger.formatError(e)}`);
						this._socket.emit("mobileProv1", {
							'data': `User data validation failed ${BeameLogger.formatError(e)}`,
							'type': 'mobileSessionFail'
						});
					});
				});

				this._socket.on('InfoPacketResponseError', (data) => {
					logger.error(`Whisperer Messaging InfoPacketResponseError`, data);
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
		else{
			let lclPin = this._getRandomPin(15,0);
			this._socket.emit('startPairingSession', this._buildDataPack(lclPin));
		}

	}

	_buildDataPack(pin){
		this._currentPin = pin;
		let fqdn     = this._fqdn,
			cred     = store.getCredential(fqdn),
			name     = pin.toString().replace(/,/g,'-') + '.pin.virt.beameio.net',
			token    = authToken.create(name, cred, 10),
			tokenStr = CommonUtils.stringify({
				//'relay':      'https://qy1i7x14ul48efb9.tr9k0gta5imrufpf.v1.p.beameio.net/control',
				'relay':      'https://arn5e5bh1s9mkqwr.bqnp2d2beqol13qn.v1.d.beameio.net/control',
				'signature': token,
				'pin':pin,
				'name': name,
				'service':this._serviceName,
				'matching': this._matchingServerFqdn,
				'appId': bootstrapper.appId,
				'refresh_rate': AudioPIN_refresh_rate
			});
		return tokenStr;
	}


	_getRandomPin(high, low) {
		let i,
			dig = [9, 7, 4, 7, 11, 0];

		for (i = 0; i < 6; i++) {
			dig[i] = Math.round(Math.random() * (high - low) + low);
		}
		return dig;
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
		}, 100)
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
			service:        this._serviceName,
			appId:          bootstrapper.appId
		};

		logger.debug(`[${this._sessionId}] emitting create session with data`, data);
		this._socket.emit('init_mobile_session', {
			pin:        this._sessionId,
			'matching': this._matchingServerFqdn,
			'service':  this._serviceName,
			'appId':    bootstrapper.appId
		});
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
		logger.debug(`User identified!! Audio stopped, ${this._qrData}`);
		this._socket.emit('connect_ok', 'qrData ok:' + (this._qrData != null));
		let retryCount = 0;

		let sessionRetry = setInterval(() => {
			if (this._mobileSocket && this._qrData) {
				clearInterval(sessionRetry);
				//this.stop();
				let qrDataObj         = JSON.parse(this._qrData);
				qrDataObj['service']  = this._serviceName;
				qrDataObj['matching'] = this._matchingServerFqdn;
				qrDataObj['appId']    = bootstrapper.appId;
				logger.debug('Whisperer sending data to mobile:', JSON.stringify(qrDataObj));
				this._mobileSocket.emit('session_data', JSON.stringify(qrDataObj));
			}
			else {
				if (retryCount++ > 30) {
					logger.debug('Failed to send session data to mobile');
					clearInterval(sessionRetry);
					this._socket.emit('mobile_network_error');
				}
			}

		}, 100);
		//stop playing pincodes
	}
}


module.exports = Whisperer;