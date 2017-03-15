/**
 * Created by zenit1 on 08/03/2017.
 */
"use strict";
const apiConfig    = require('../config/api_config.json');
const beameSDK     = require('beame-sdk');
const BeameStore   = new beameSDK.BeameStore();
const Credential   = beameSDK.Credential;
const ProvisionApi = beameSDK.ProvApi;
const Constants    = require('../constants');
const Bootstrapper = require('./bootstrapper');
const bootstrapper = Bootstrapper.getInstance();

let centralLoginServiceInstance = null;

class CentralLoginServices {

	constructor() {
		this._dataService = require('./dataServices').getInstance();
	}

	//region server manager helpers
	sendACKToDelegatedCentralLogin(action) {
		return new Promise((resolve, reject) => {
			let externalLoginUrl = bootstrapper.externalLoginUrl,
			data                 = {
				fqdn:   Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer),
				id:     bootstrapper.appId,
				action: action
			};
			if (externalLoginUrl) {
				const
					BeameAuthServices = require('./authServices'),
					authServices      = BeameAuthServices.getInstance();

				let sign         = authServices.signData(data),
				    provisionApi = new ProvisionApi();


				let loginReg = externalLoginUrl + apiConfig.Actions.Login.RegisterServer.endpoint;
				provisionApi.postRequest(loginReg, data, (error) => {
					if (error) {
						reject(error);
					}
					else {
						resolve(externalLoginUrl);
					}
				}, sign);
			}
			else
				resolve(null);
		});
	}

	notifyRegisteredLoginServers(selfFqdn) {
		return new Promise((resolve, reject) => {

			let cred = new Credential(BeameStore),
			    sign = null;

			const _notifyAllSlaves = logins => {
				Promise.all(logins.map(login => {
						return this._sendACKToSlave(login.fqdn, selfFqdn, sign);
					}))
					.then(resolve);
			};

			const _setSignature = signature => {
				sign = signature;
				return Promise.resolve();
			};

			cred.signWithFqdn(selfFqdn)
				.then(_setSignature)
				.then(this.getActiveGkLogins.bind(this))
				.then(_notifyAllSlaves)
				.catch(reject);
		});

	}

	_sendACKToSlave(fqdn, gwFqdn, sign) {
		return new Promise((resolve, reject) => {
				let provisionApi = new ProvisionApi();
				let srvPath      = 'https://' + fqdn + apiConfig.Actions.Login.RecoverServer.endpoint;
				provisionApi.postRequest(srvPath, gwFqdn, (error) => {
					if (error) {
						reject(error);
					}
					else {
						resolve();
					}
				}, sign, 3);
			}
		);
	}

	//endregion


	//region Delegated logins manage

	getGkLogins() {
		return this._dataService.getGkLogins();
	}

	getActiveGkLogins() {
		return this._dataService.getActiveGkLogins();
	}

	getOnlineGkLogins() {
		return this._dataService.getOnlineGkLogins();
	}

	isFqdnRegistered(fqdn) {
		return new Promise((resolve, reject) => {
				this._dataService.findLogin(fqdn).then(login => {
					login && login.isActive ? resolve() : reject(login ? `Login ${fqdn} isInactive` : 'FQDN not registered');
				}).catch(reject);
			}
		);

	}

	// _notifySlaveStatus(login){
	// 	return new Promise((resolve, reject) => {
	//
	// 		}
	// 	);
	// }

	setAllGkLoginOffline() {
		return this._dbService.setAllGkLoginOffline();
	}

	saveGkLogin(login) {
		return this._dataService.saveGkLogin(login);
	}

	updateGkLogin(login) {

		return this._dataService.updateGkLogin(login);
	}

	updateGkLoginState(fqdn, serviceId,isOnline) {

		return this._dataService.updateGkLoginState(fqdn, serviceId,isOnline);
	}

	deleteGkLogin(id) {
		return this._dataService.deleteGkLogin(id);
	}

	//endregion

	/** @type {CentralLoginServices} */
	static getInstance() {

		if (!centralLoginServiceInstance) {
			centralLoginServiceInstance = new CentralLoginServices();
		}

		return centralLoginServiceInstance;

	}
}

module.exports = CentralLoginServices;