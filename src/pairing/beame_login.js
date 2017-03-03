/**
 * Created by Alexz on 07/02/2017.
 */

"use strict";

//const uuid         = require('uuid');
const beameSDK     = require('beame-sdk');
const Constants    = require('../../constants');
const CommonUtils  = beameSDK.CommonUtils;
const authToken    = beameSDK.AuthToken;
const store        = new (beameSDK.BeameStore)();
const Bootstrapper = require('../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();

const PIN_refresh_rate = 1000 * 60;
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
				this._socket.emit('tokenVerified', JSON.stringify({success:true, target:targetFqdn, token:token}));
			}).catch(e=>{
				this._socket.emit('tokenVerified', JSON.stringify({success:false, error: e}));
			});
		});

		this._socket.on('notifyMobile', (data) => {
			const ProvisionApi     = beameSDK.ProvApi;
			const provisionApi     = new ProvisionApi();
			let parsed = JSON.parse(data);
			let target = JSON.parse(parsed.token).signedBy;
			console.log(`notifyMobile with: ${data} => ${target}`);
			provisionApi.postRequest('https://'+target+'/login/restart', data, (error) => {
				if(!error){
					this._socket.emit('mobileIsOnline', true);
				}
				else{
					console.log('Failed to notify Mobile:', error);
				}
			},null, 10, {rejectUnauthorized: false});
		});

		let lclPin = this._getRandomPin(15,0);
		this._socket.emit('startPairingSession', this._buildDataPack(lclPin));

	}

	_buildDataPack(pin){

		//bootstrapper._config.delegatedLoginServers
		let loginServers = [];
		let serversArr = [];
		try {
			serversArr = JSON.parse(bootstrapper._config.delegatedLoginServers);
		}
		catch (e){
			serversArr = [];
		}
		for(let i = 0 ; i < serversArr.length; i++){
			if(serversArr[i].id)
				loginServers.push(serversArr[i].id);
		}
		console.log(
			'serversArr:',serversArr
		);
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
				'refresh_rate': PIN_refresh_rate,
				'appId':'beame-login',
				'loginServers': loginServers.toString()
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