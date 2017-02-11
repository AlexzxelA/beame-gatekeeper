/**
 * Created by Alexz on 07/02/2017.
 */

"use strict";

//const uuid         = require('uuid');
const beameSDK     = require('beame-sdk');

const CommonUtils  = beameSDK.CommonUtils;
const authToken    = beameSDK.AuthToken;
const store        = new (beameSDK.BeameStore)();

const AudioPIN_refresh_rate = 1000 * 30;
/**
 * @typedef {Object} SessionData
 * @property {String} sessionId
 * @property {String} whispererFqdn
 */

class BeameLogin {

	/**
	 * @param {Object} socket
	 * @param {String} serverFqdn
	 * @param {String} matchingServerFqdn
	 * @param {String} relayFqdn
	 * @param {Object} socket_options
	 * @param {String} serviceName
	 */
	constructor(socket, serverFqdn, matchingServerFqdn, relayFqdn, socket_options, serviceName) {

		this._relay = relayFqdn;

		/** @type {Socket} */
		this._socket = socket;

		/** @type {Object} */
		this._options = socket_options;


		//noinspection JSUnresolvedVariable
		this._fqdn                    = serverFqdn;
		this._matchingServerFqdn      = matchingServerFqdn;
		this._serviceName             = serviceName;
	}


	start() {

		this._socket.on('pinRequest', () => {
			let lclPin = this._getRandomPin(15,0);
			this._socket.emit('pindata', this._buildDataPack(lclPin));
		});

		this._socket.on('verifyToken', (token) => {
			authToken.validate(token).then(()=>{
				let parsed = JSON.parse(token);
				var targetFqdn = (!(parsed.signedBy == parsed.signedData.data))?(parsed.signedData.data+'/beame-gw/signin'):'none';
				this._socket.emit('tokenVerified', JSON.stringify({success:true, target:targetFqdn, pin:parsed.signedData.valid_till}));
			}).catch(e=>{
				this._socket.emit('tokenVerified', JSON.stringify({success:false, error: e}));
			});
		});

		let lclPin = this._getRandomPin(15,0);
		this._socket.emit('startPairingSession', this._buildDataPack(lclPin));

	}

	_buildDataPack(pin){

		let fqdn     = this._fqdn,
			cred     = store.getCredential(fqdn),
			name     = pin.toString().replace(/,/g,'-') + '.pin.virt.beameio.net',
			token    = authToken.create(name, cred, 10),
			tokenStr = CommonUtils.stringify({
				//'relay':      'https://qy1i7x14ul48efb9.tr9k0gta5imrufpf.v1.p.beameio.net/control',
				'relay':     'https://'+ this._relay + '/control',//'https://arn5e5bh1s9mkqwr.bqnp2d2beqol13qn.v1.d.beameio.net/control',
				'signature': token,
				'pin':pin,
				'name': name,
				'service':this._serviceName,
				'matching': this._matchingServerFqdn,
				'refresh_rate': AudioPIN_refresh_rate,
				'appId':'beame-login'
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

}


module.exports = BeameLogin;