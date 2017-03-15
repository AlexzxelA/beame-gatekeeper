/**
 * Created by Alexz on 07/02/2017.
 */

"use strict";

//const uuid         = require('uuid');
const beameSDK     = require('beame-sdk');
const Constants    = require('../../constants');
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger("CBeameLoginServices");
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
		this._fqdn               = serverFqdn;
		this._matchingServerFqdn = matchingServerFqdn;
		this._serviceName        = serviceName;
	}


	start() {

		this._socket.on('pinRequest', () => {
			let lclPin = this._getRandomPin(15, 0);

			this._buildDataPack(lclPin).then(tokenStr => {
				this._socket.emit('pindata', tokenStr);
			}).catch(error => {
				logger.error(`Build data pack`, error);
			});


		});

		this._socket.on('verifyToken', (token) => {
			authToken.validate(token).then(() => {
				let parsed     = JSON.parse(token);
				let targetFqdn = (!(parsed.signedBy == parsed.signedData.data)) ? (parsed.signedData.data + '/beame-gw/xprs-signin') : 'none';

				let fqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
				fqdn && store.find(fqdn, true).then((cred) => {
					//let newToken    = (bootstrapper.delegatedLoginServers && bootstrapper.delegatedLoginServers.length > 1)? cred && authToken.create(token, cred, 10):token;
					let newToken = cred && authToken.create(token, cred, 10);
					this._socket.emit('tokenVerified', JSON.stringify({
						success: true,
						target:  targetFqdn,
						token:   newToken
					}));
				}).catch(e => {
					this._socket.emit('tokenVerified', JSON.stringify({success: false, error: e}));
				});

			}).catch(e => {
				this._socket.emit('tokenVerified', JSON.stringify({success: false, error: e}));
			});
		});

		this._socket.on('notifyMobile', (data) => {
			const ProvisionApi = beameSDK.ProvApi;
			const provisionApi = new ProvisionApi();
			let parsed         = JSON.parse(data);
			let target         = JSON.parse(parsed.token).signedBy;
			console.log(`notifyMobile with: ${data} => ${target}`);
			provisionApi.postRequest('https://' + target + '/login/restart', data, (error) => {
				if (!error) {
					this._socket.emit('mobileIsOnline', true);
				}
				else {
					console.log('Failed to notify Mobile:', error);
				}
			}, null, 10, {rejectUnauthorized: false});
		});

		let lclPin = this._getRandomPin(15, 0);

		this._buildDataPack(lclPin).then(tokenStr => {
			this._socket.emit('startPairingSession', tokenStr);
		}).catch(error => {
			logger.error(`Build data pack`, error);
		});


	}

	_buildDataPack(pin) {

		let loginServers = [];

		return new Promise((resolve, reject) => {
				const _fetchOnlineLogins = () => {
					const loginServices = require('../centralLoginServices').getInstance();
					return loginServices.onlineServers();
				};

				const _onLoginsInitiated = serversArr => {
					for (let i = 0; i < serversArr.length; i++) {
						if (serversArr[i].serviceId)
							loginServers.push(serversArr[i].serviceId);
					}

					return Promise.resolve();
				};

				const _buildPack = () => {
					try {
						let fqdn     = this._fqdn,
						    cred     = store.getCredential(fqdn),
						    name     = pin.toString().replace(/,/g, '-') + '.pin.virt.beameio.net',
						    token    = authToken.create(name, cred, 10),
						    tokenStr = CommonUtils.stringify({
							    'relay':          'https://' + this._relay + '/control',//'https://arn5e5bh1s9mkqwr.bqnp2d2beqol13qn.v1.d.beameio.net/control',
							    'signature':      token,
							    'pin':            pin,
							    'name':           name,
							    'service':        this._serviceName,
							    'matching':       this._matchingServerFqdn,
							    'refresh_rate':   PIN_refresh_rate,
							    'appId':          'beame-login',
							    'loginServers':   loginServers.toString(),
							    'delegatedLogin': bootstrapper.externalLoginUrl
						    });

						resolve(tokenStr);
					} catch (e) {
						reject(e);
					}
				};

				_fetchOnlineLogins()
					.then(_onLoginsInitiated)
					.then(_buildPack)
					.catch(error => {
						console.error(error);
						_buildPack();
					});
			}
		);


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
