/**
 * Created by Alexz on 26/09/2016.
 */
"use strict";

const module_name      = "QrMessaging";
const beameSDK         = require('beame-sdk');
const CommonUtils      = beameSDK.CommonUtils;
const beameUtils       = beameSDK.BeameUtils;
const authToken        = beameSDK.AuthToken;
const BeameLogger      = beameSDK.Logger;
const store            = new beameSDK.BeameStore();
const crypto           = require('crypto');
const logger           = new BeameLogger(module_name);
const OTP_refresh_rate = 1000 * 30;
const Bootstrapper     = require('../bootstrapper');
const bootstrapper     = Bootstrapper.getInstance();
const Constants    = require('../../constants');

class QrMessaging {

	/**
	 * @param {String} fqdn
	 * @param {String} matchingServerFqdn
	 * @param {MessagingCallbacks} callbacks
	 * @param {String} serviceName
	 */
	constructor(fqdn, matchingServerFqdn, callbacks, serviceName) {

		this._edge = null;
		beameUtils.selectBestProxy(null, 100, 1000, (error, payload) => {
			if (!error) {
				this._edge = payload;
			}
			else {
				this._edge = null;
			}
		});
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
		this._userImage          = null;
	}

	_sendWithAck(sock, type, msg) {
		this._pendingCommand[type] = msg;
		this._lastCommand          = type;
		console.log('QR Sending 0:', type);
		sock.emit(type, msg);
	}

	/**
	 * @param {Socket} socket
	 */
	onQrBrowserConnection(socket) {


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
			this._signBrowserHostname(socket);
		});

		socket.on('userImage', (data) => {
			store.find(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer)).then( selfCred => {
				this._userImage = selfCred.sign(data);
			}).catch(function (e) {
				this._userImage = 'none';
			});
		});

		socket.on('userImageOK',()=>{
			logger.info('user image verified');
			socket.emit('userImageSign', {'data': {'imageSign': this._userImage.signature}, 'type': 'userImageSign'});
		});

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
					user_id:   data.user_id
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

					payload.imageRequired = Constants.registrationImageRequired;
					payload.matching = this._matchingServerFqdn;
					payload.service  = this._serviceName;
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
							payload.imageRequired = Constants.registrationImageRequired;
							payload.matching = this._matchingServerFqdn;
							payload.service  = this._serviceName;
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
		var OTP        = "";
		for (var i = 0; i < size; i++) {
			OTP += Math.floor(Math.random() * 10);
		}
		this._otp = OTP;
	}

	_setNewOTP(socket) {
		this._generateOTP(24);
		let relay = this._edge.endpoint,
		    UID   = this._browserHost;
		this._sendWithAck(socket, "pinRenew", JSON.stringify({'data': this._otp, 'relay': relay, 'UID': UID}));
		/*this._renewOTP = setInterval(()=> {
		 this._generateOTP(24);
		 logger.debug('>>> this._otp:', this._otp);
		 console.log('QR..ID:', socket.id);
		 this._sendWithAck(socket,"pinRenew", JSON.stringify({'data': this._otp, 'relay': relay, 'UID': UID}));
		 }, OTP_refresh_rate);*/
	}

	_signBrowserHostname(socket) {
		if (this._edge) {
			let fqdn     = this._fqdn,
			    cred     = store.getCredential(fqdn),
			    token    = authToken.create(this._browserHost, cred, 10),
			    tokenStr = CommonUtils.stringify({
				    'imageRequired': Constants.registrationImageRequired,
				    "data":      this._edge.endpoint,
				    'signature': token
			    });

			this._sendWithAck(socket, "relayEndpoint", tokenStr);
		} else {
			this._sendWithAck(socket, "edgeError", "Network problems, please try again later");
		}
	}

}


module.exports = QrMessaging;
