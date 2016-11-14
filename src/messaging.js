/**
 * Created by Alexz on 26/09/2016.
 */
"use strict";

const module_name  = "Messaging";
const config       = require('../config/config');
const beameSDK     = require('beame-sdk');
const CommonUtils  = beameSDK.CommonUtils;
const beameUtils   = beameSDK.BeameUtils;
const authToken    = beameSDK.AuthToken;
const BeameLogger  = beameSDK.Logger;
const store        = new beameSDK.BeameStore();
//const Credential   = new beameSDK.Credential(store);
const logger       = new BeameLogger(module_name);
const authServices = new (require('./authServices'))(config.CustomerServerFqdn);


class Messaging {
	constructor(server) {
		this._app             = server;
		// this._route           = "/";
		this._browserSocket   = null;
		//this._mobileSocket    = null;
		this._browserSocketID = null;
		this._mobileSocketID  = null;
		//this._otpUsed         = false;
		this._otp             = "";

	}

	openSocket() {
		/** @typedef {Socket} */
		var socketio = require('socket.io')(this._app);

		//noinspection JSUnresolvedFunction
		socketio.on('connection', (socket)=> {
			logger.debug('connection ???');
			if (socket.id != this._browserSocketID && socket.id != this._mobileSocketID) {
				this._onConnection(socket);
			}
		});
	}


	/**
	 * * @param {String} OTP
	 * * @returns {Boolean}
	 */
	_verifyOTP(OTP) {
		return (this._otp == OTP);
	}


	_generateOTP(size) {
		var OTP = "";
		for (var i = 0; i < size; i++) {
			OTP += Math.floor(Math.random() * 10);
		}
		this._otp = OTP;
	}

	/**
	 * @param {Socket} socket
	 * @private
	 */
	_onIdBrowser(socket) {
		this._generateOTP(24);

		socket.emit("pin", JSON.stringify({'data': this._otp}));
		logger.debug('browser reported');
		this._browserSocketID = socket.id;
		logger.debug('sending initial data to ', socket.id);
		//this._browserSocket = socket;
		socket.on('virtSrvConfig', function (data) {
			console.log('<< virtSrvConfig:', data);


			const onEdgeServerSelected = edge=> {

				let fqdn     = authServices.getMyFqdn(),
				    cred     = store.getCredential(fqdn),
				    token    = authToken.create(data.UID, cred, 10),
				    tokenStr = CommonUtils.stringify({
					    "data":      edge.endpoint,
					    'signature': token
				    });

				socket.emit("relayEndpoint", tokenStr);
			};

			beameUtils.selectBestProxy(config.LoadBalancerURL, 100, 1000, (error, payload) => {
				if (!error) {
					onEdgeServerSelected.call(this, payload);
				}
				else {
					this.gSocket.emit("network_problem", `Network pproblem: Relay server could not be found, try again later`);

				}
			});

		});
	}


	_onConnection(socket) {
		logger.debug(`socket connected`);

		socket.on('browser_connected', () => {
			logger.debug('browser reported');
			this._browserSocketID = socket.id;
			this._onIdBrowser(socket);
		});

		socket.on('InfoPacketResponse', function (data) {
			logger.debug('InfoPacketResponse:', data);
			//createEntityWithAuthServer
			if(this._verifyOTP(data.pin)){
				let metadata = {
					name:      data.name,
					email:     data.email,
					edge_fqdn: data.edge_fqdn,
					rand:      CommonUtils.randomBytes()
				};

				var token = authToken.create(CommonUtils.generateDigest(metadata), store.getCredential(authServices.getMyFqdn()), 300);

				authServices.authorizeEntity(metadata, CommonUtils.parse(token)).then(payload => {
					socket.emit("mobileProv1",{'data':payload,'type':'mobileProv1'});
				}).catch(e=> {
					console.log('error (authorizing mobile):', e)
				});
			}
			else{
				socket.emit("mobilePinInvalid",{'data':'Failed to verify session'});
			}


		}.bind(this));
	}
}


module.exports = Messaging;