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
const OTP_refresh_rate = 10000;
const Constants    = require('../constants');
const Bootstrapper = require('./bootstrapper');
const bootstrapper = new Bootstrapper();

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
		this._fqdn        = fqdn;
		this._callbacks   = callbacks;
		this._browserHost = null;
		this._otp         = "";
		this._otp_prev    = "";
		this._renewOTP    = null;
		this._edge        = null;
	}

	/**
	 * @param {Socket} socket
	 */
	onQrBrowserConnection(socket) {

		socket.on('disconnect',()=>{
			logger.debug('QR socket disconnected');
			clearInterval(this._renewOTP);
		});

		socket.on('browser_connected', (data) => {
			logger.debug(`browser socket connected with:${data}`);
			this._browserHost = data;
			this._signBrowserHostname(socket);
		});

		socket.on('InfoPacketResponseError',(data)=>{
			logger.error(`Qr Messaging InfoPacketResponseError`, error);
		});

		socket.on('InfoPacketResponse', (data) => {
			logger.debug('InfoPacketResponse:', data);
			//createEntityWithAuthServer
			if (this._verifyOTP(data.otp)) {
				clearInterval(this._renewOTP);
				socket.emit('resetQR');

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
					socket.emit("mobileProv1", {'data': payload, 'type': 'mobileProv1'});
				}).catch(e=> {
					socket.emit("mobileProv1", {'data': 'User data validation failed', 'type': 'mobileSessionFail'});
					logger.error('error (authorizing mobile):', e)
				});
			}
			else {
				socket.emit("mobilePinInvalid", {'data': `PIN:${data.otp}>${this._otp},${this._otp_prev}`});
			}
		});


		socket.on('virtSrvConfig', (data) => {
			logger.debug(`<< virtSrvConfig: ${this._browserHost}`, data);
			if (data == this._browserHost) {
				this._setNewOTP(socket);
			}
		});

		socket.on('close_session',() =>{
			clearInterval(this._renewOTP);
		});
	}

	_deleteSession(pin){
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
		socket.emit("pinRenew", JSON.stringify({'data': this._otp, 'relay': relay, 'UID': UID}));
		this._renewOTP = setInterval(()=> {
			this._generateOTP(24);
			logger.debug('QRdata:', relay, '..', UID);
			socket.emit("pinRenew", JSON.stringify({'data': this._otp, 'relay': relay, 'UID': UID}));
		}, OTP_refresh_rate);
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

			socket.emit("relayEndpoint", tokenStr);
		} else {
			socket.emit("edgeError", "Network problems, please try again later");
		}
	}


}


module.exports = QrMessaging;