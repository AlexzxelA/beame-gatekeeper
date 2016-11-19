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
//const Credential   = new beameSDK.Credential(store);
const logger           = new BeameLogger(module_name);
const OTP_refresh_rate = 1000 * 30;
const Bootstrapper     = require('./bootstrapper');
const bootstrapper     = new Bootstrapper();

class QrMessaging {

	/**
	 * @param {String} fqdn
	 * @param {MessagingCallbacks} callbacks
	 */
	constructor(fqdn, callbacks) {

		beameUtils.selectBestProxy(null, 100, 1000, (error, payload) => {
			if (!error) {
				this._edge = payload;
			}
			else {
				this._edge = null;
			}
		});
		this._fqdn          = fqdn;
		this._callbacks     = callbacks;
		this._browserHost   = null;
		this._otp           = "";
		this._otp_prev      = "";
		this._renewOTP      = null;
		this._edge          = null;
		this._socketTimeout = bootstrapper.killSocketOnDisconnectTimeout;
		this._pendingCommand = {};
		this._lastCommand = null;
	}

	_sendWithAck(sock, type, msg){
		this._pendingCommand[type] = msg;
		this._lastCommand = type;
		console.log('QR Sending 0:',type);
		sock.emit(type, msg);
	}

	/**
	 * @param {Socket} socket
	 */
	onQrBrowserConnection(socket) {


		logger.info('<<< QR Browser just connected >>>');



		socket.on('ack',(data)=>{
			console.log('QR Clearing for', data);
			this._pendingCommand[data] = 0;
		});

		socket.on('disconnect', () => {
			logger.debug('QR socket disconnected');

			setTimeout(()=>{
				logger.debug('QR socket closing');

				clearInterval(this._renewOTP);

			},this._socketTimeout);

		});

		socket.on('reconnect', () => {
			logger.debug('QR socket reconnected');
			if(this._lastCommand && this._pendingCommand[this._lastCommand]){
				console.log('Re-sending command after reconnect');
				this._sendWithAck(socket, this._lastCommand, this._pendingCommand[this._lastCommand]);
			}
		});

		socket.on('browser_connected', (data) => {
			logger.debug(`browser socket connected with:${data}`);
			this._browserHost = data;
			this._signBrowserHostname(socket);
		});

		socket.on('InfoPacketResponseError', (data) => {
			logger.error(`Qr Messaging InfoPacketResponseError ${BeameLogger.formatError(error)}`, data);
		});

		socket.on('InfoPacketResponse', (data) => {
			logger.debug('QR InfoPacketResponse:', data);
			//createEntityWithAuthServer
			if (this._verifyOTP(data.otp)) {
				console.log('QR Cleared QR interval!', socket.id);
				clearInterval(this._renewOTP);
				 this._sendWithAck(socket,'resetQR');

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
					logger.info(`new fqdn ${payload.fqdn} registered, emitting mobileProv1 to socket ${socket.id}`);
					this._sendWithAck(socket,"mobileProv1", {'data': payload, 'type': 'mobileProv1'});
				}).catch(e=> {
					this._sendWithAck(socket,"mobileProv1", {'data': 'User data validation failed', 'type': 'mobileSessionFail'});
					logger.error(`authorizing mobile error  ${BeameLogger.formatError(e)}`);
				});
			}
			else {
				this._sendWithAck(socket,"mobilePinInvalid", {'data': `PIN:${data.otp}>${this._otp},${this._otp_prev}`});
			}
		});
		socket.on('pinRequest',()=>{
			console.log('QR pinRequest');
			this._setNewOTP(socket);
		});
		socket.on('virtSrvConfig', (data) => {
			logger.debug(`<< virtSrvConfig: ${this._browserHost}`, data);
			console.log('QR socket ID:',socket.id);

			this._sendWithAck(socket,'startQrSession',OTP_refresh_rate);
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
		this._sendWithAck(socket,"pinRenew", JSON.stringify({'data': this._otp, 'relay': relay, 'UID': UID}));
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
				    "data":      this._edge.endpoint,
				    'signature': token
			    });

			this._sendWithAck(socket,"relayEndpoint", tokenStr);
		} else {
			this._sendWithAck(socket,"edgeError", "Network problems, please try again later");
		}
	}


}


module.exports = QrMessaging;