/**
 * Created by Alexz on 26/09/2016.
 */
"use strict";

const module_name      = "QrMessaging";
const beameSDK         = require('beame-sdk');
const CommonUtils      = beameSDK.CommonUtils;
const authToken        = beameSDK.AuthToken;
const BeameLogger      = beameSDK.Logger;
const store            = new beameSDK.BeameStore();
const crypto           = require('crypto');
const logger           = new BeameLogger(module_name);
const OTP_refresh_rate = 1000 * 30;
const Bootstrapper     = require('../bootstrapper');
const bootstrapper     = Bootstrapper.getInstance();
const Constants        = require('../../constants');


class QrMessaging {

	/**
	 * @param {String} fqdn
	 * @param {String} matchingServerFqdn
	 * @param {MessagingCallbacks} callbacks
	 * @param {String} serviceName
	 */
	constructor(fqdn, matchingServerFqdn, callbacks, serviceName) {

		this._edge = null;
<<<<<<< HEAD
=======
		// beameUtils.selectBestProxy(null, 100, 1000, (error, payload) => {
		// 	if (!error) {
		// 		this._edge = payload.endpoint;
		// 	}
		// 	else {
		// 		this._edge = null;
		// 	}
		// });
>>>>>>> ee1e348067e8622149f56bbe21a73ee8c980916e
		this._gwFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
		this._fqdn               = fqdn;
		this._callbacks          = callbacks;
		this._browserHost        = null;
		this._otp                = "";
		this._otp_prev           = "";
		this._renewOTP           = null;
		this._socketTimeout      = bootstrapper.killSocketOnDisconnectTimeout;
		this._pendingCommand     = {};
		this._lastCommand        = null;
		this._serviceName        = serviceName;
		this._matchingServerFqdn = matchingServerFqdn;
		this._pairingUtils       = null;
	}

	_sendWithAck(sock, type, msg) {
		this._pendingCommand[type] = msg;
		this._lastCommand          = type;
		console.log('QR Sending 0:', type);
		sock.emit(type, msg);
	}

	/**
	 * @param {Socket} socket
	 * @param {String} relay
	 */
	onQrBrowserConnection(socket, relay) {
		this._edge = relay || this._edge;
		const pairingUtils = require('./pairing_utils');
		this._pairingUtils = new pairingUtils(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer),
			socket, module_name);

		this._pairingUtils.setCommonHandlers();

		logger.info('<<< QR Browser just connected >>>');


		socket.on('ack', (data) => {
			logger.debug('QR Clearing for', data);
			this._pendingCommand[data] = 0;
		});

		socket.on('disconnect', () => {
			logger.debug('QR socket disconnected');

			setTimeout(() => {
				logger.debug('QR socket closing');

				clearInterval(this._renewOTP);

			}, this._socketTimeout);

		});

		socket.on('_disconnect', () => {
			//force disconnect event
			clearInterval(this._renewOTP);
			socket.disconnect();
			socket = null;
		});

		socket.on('reconnect', () => {
			logger.debug('QR socket reconnected');
			if (this._lastCommand && this._pendingCommand[this._lastCommand]) {
				console.log('Re-sending command after reconnect');
				this._sendWithAck(socket, this._lastCommand, this._pendingCommand[this._lastCommand]);
			}
		});

		socket.on('browser_connected', (data) => {
			logger.debug(`browser socket connected with:${data}`);
			this._browserHost = data;
			this._signBrowserHostname(socket, (sessionData)=>{
				if(sessionData)
					this._sendWithAck(socket, "relayEndpoint", sessionData);
				else
					this._sendWithAck(socket, "edgeError", "Network problems, please try again later");
			});
		});

		socket.on('xprs_browser_connected', (data) => {
			logger.debug(`browser socket connected with:${data}`);
			try {
				let parsed = (typeof data === 'object')? data: JSON.parse(data);
				this._browserHost = parsed.uid;
				let fqdn = (typeof parsed.token === 'object')?parsed.token.signedBy:(JSON.parse(parsed.token)).signedBy;
				store.find(fqdn).then(cred => {
					this._signBrowserHostname(socket, (sessionData)=>{
						if(sessionData) {
							let hdr = '-----BEGIN PUBLIC KEY-----',
								ftr = '-----END PUBLIC KEY-----',
								pk = cred.publicKeyStr.substring(hdr.length, cred.publicKeyStr.length - ftr.length);
							this._sendWithAck(socket, "relayEndpoint", {data:sessionData, pk: pk});
						}
						else
							this._sendWithAck(socket, "edgeError", "Network problems, please try again later");
					});
				}).catch(e => {
					logger.error(`xprs_browser_connected error`, BeameLogger.formatError(e));
					this._sendWithAck(socket, "edgeError", "Failed to fetch mobile host public key");
				});

			}
			catch (e){
				console.error(e);
				this._sendWithAck(socket, "edgeError", "Invalid data, please retry");
			}
		});
		// socket.on('userImage', (data) => {
		// 	logger.info('Got image data:', data);
		// 	store.find(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer)).then( selfCred => {
		// 		this._userImage = selfCred.sign(data);
		// 	}).catch(function (e) {
		// 		this._userImage = 'none';
		// 	});
		// });
		//
		// socket.on('userImageVerify', function (data) {
		// 	store.find(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer)).then( selfCred => {
		// 		if(selfCred.checkSignature(data)){
		// 			client.emit('userImageStatus','pass')
		// 		}
		// 		else{
		// 			client.emit('userImageStatus','fail');
		// 		}
		// 	}).catch(function (e) {
		// 		client.emit('userImageStatus','fail');
		// 	});
		//
		// });
		//
		// socket.on('userImageOK',()=>{
		// 	logger.info('user image verified:',this._userImage.signature);
		// 	socket.emit('userImageSign', {'data': {'imageSign': this._userImage.signature,
		// 		'imageSignedBy':this._userImage.signedBy},
		// 		'type': 'userImageSign'});
		// });

		socket.on('InfoPacketResponseError', (data) => {
			logger.error(`Qr Messaging InfoPacketResponseError:`, data);
		});

		socket.on('InfoPacketResponse', (data) => {
			logger.debug('QR InfoPacketResponse:', data);
			//createEntityWithAuthServer
			if (this._verifyOTP(data.otp)) {
				console.log('QR Cleared QR interval!', socket.id);
				clearInterval(this._renewOTP);
				this._sendWithAck(socket, 'resetQR');

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
					logger.info(`new fqdn ${payload.fqdn} registered, emitting mobileProv1 to socket ${socket.id}`);
					//add service name and matching fqdn for use on mobile

					payload.imageRequired = bootstrapper.registrationImageRequired;
					payload.matching      = this._matchingServerFqdn;
					payload.service       = this._serviceName;
					payload.gwFqdn        = this._gwFqdn;
					payload.version       = bootstrapper.version;
					payload.pairing       = bootstrapper.pairingRequired;
					this._sendWithAck(socket, "mobileProv1", {'data': payload, 'type': 'mobileProv1'});
				}).catch(e => {
					this._sendWithAck(socket, "mobileProv1", {
						'data': `User data validation failed ${BeameLogger.formatError(e)}`,
						'type': 'mobileSessionFail'
					});
					logger.error(`authorizing mobile error  ${BeameLogger.formatError(e)}`);
				});
			}
			else {
				this._sendWithAck(socket, "mobilePinInvalid", {'data': `PIN:${data.otp}>${this._otp},${this._otp_prev}`});
			}
		});

		socket.on('regRecovery', (data) => {
			logger.debug('QR regRecovery:', data);
			//createEntityWithAuthServer
			if (this._verifyOTP(data.otp)) {
				console.log('QR Cleared QR interval!', socket.id);
				clearInterval(this._renewOTP);
				this._sendWithAck(socket, 'resetQR');

				let metadata = {
					name:      data.name,
					email:     data.email,
					edge_fqdn: data.edge_fqdn,
					pin:       data.pin,
					user_id:   data.user_id
				};

				let recoveryRegisterFunc = this._callbacks["RegRecovery"];

				if (!recoveryRegisterFunc) {
					logger.error(`registration callback not defined`);
					return;
				}

				recoveryRegisterFunc(metadata).then(payload => {
					this._deleteSession(data.pin);

					switch (payload.type) {
						case 'token':
							logger.info(`new fqdn ${payload.fqdn} registered, emitting mobileProv1 to socket ${socket.id}`);
							//add service name and matching fqdn for use on mobile
							payload.imageRequired = bootstrapper.registrationImageRequired;
							payload.matching      = this._matchingServerFqdn;
							payload.service       = this._serviceName;
							payload.gwFqdn        = this._gwFqdn;
							payload.version       = bootstrapper.version;
							payload.pairing       = bootstrapper.pairingRequired;
							this._sendWithAck(socket, "mobileProv1", {'data': payload, 'type': 'mobileProv1'});
							break;
						case 'cert':
							//TODO add logic
							break;
					}

				}).catch(e => {
					this._sendWithAck(socket, "mobileProv1", {
						'data': `User data validation failed ${BeameLogger.formatError(e)}`,
						'type': 'mobileSessionFail'
					});
					logger.error(`authorizing mobile error  ${BeameLogger.formatError(e)}`);
				});
			}
			else {
				this._sendWithAck(socket, "mobilePinInvalid", {'data': `PIN:${data.otp}>${this._otp},${this._otp_prev}`});
			}
		});

		socket.on('beamePing', function () {
			setTimeout(function () {
				socket.emit('beamePong');
			}, 1000);
		});

		socket.on('pinRequest', () => {
			console.log('QR pinRequest');
			this._setNewOTP(socket);
		});

		socket.on('virtSrvConfig', (data) => {
			logger.debug(`<< virtSrvConfig: ${this._browserHost}`, data);
			console.log('QR socket ID:', socket.id);

			this._sendWithAck(socket, 'startQrSession', {
				refresh_rate: OTP_refresh_rate,
				matching:     this._matchingServerFqdn,
				service:      this._serviceName,
				appId:        bootstrapper.appId
			});
		});

		socket.on('close_session', () => {
			clearInterval(this._renewOTP);
			socket.disconnect();
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

	/**
	 * * @param {String} OTP
	 * * @returns {Boolean}
	 */
	_verifyOTP(OTP) {
		return (this._otp == OTP || this._otp_prev == OTP);
	}

	_generateOTP(size) {
		this._otp_prev = this._otp;
		let OTP        = "";
		for (let i = 0; i < size; i++) {
			OTP += Math.floor(Math.random() * 10);
		}
		this._otp = OTP;
	}

	_setNewOTP(socket) {

		let counter = 0;

		let waitEdge = setInterval(() => {
			counter++;

			if (this._edge) {

				clearInterval(waitEdge);

				this._generateOTP(24);
				let relay = this._edge,
				    UID   = this._browserHost;
				this._sendWithAck(socket, "pinRenew", JSON.stringify({'data': this._otp, 'relay': relay, 'UID': UID}));
			}

			if (counter >= 20) {
				clearInterval(waitEdge);
			}

		}, 1000);

	}

	//noinspection JSUnusedLocalSymbols
	_signBrowserHostname(socket, cb) {
		if (this._edge) {
			let fqdn     = this._fqdn,
			    cred     = store.getCredential(fqdn),
			    token    = authToken.create(this._browserHost, cred, 60),
			    tokenStr = CommonUtils.stringify({
				    'imageRequired': bootstrapper.registrationImageRequired,
				    'data':          this._edge,
				    'signature':     token,
					'refresh_rate': OTP_refresh_rate,
					'matching':     this._matchingServerFqdn,
					'service':      this._serviceName,
					'appId':        bootstrapper.appId,
				    'delegatedLogin': bootstrapper.delegatedLoginUrl
			    });
				cb(tokenStr);
		} else {
			cb(null);
		}
	}

}


module.exports = QrMessaging;
