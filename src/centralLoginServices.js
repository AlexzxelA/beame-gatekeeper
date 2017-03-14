/**
 * Created by zenit1 on 08/03/2017.
 */
"use strict";
const apiConfig   = require('../config/api_config.json');
const beameSDK    = require('beame-sdk');

let centralLoginServiceInstance = null;

class CentralLoginServices {

	constructor() {
		this._dataService = require('./dataServices').getInstance();
	}

	//region server manager helpers
	registerServerOnDelegatedCentralLogin(externalLoginUrl, data) {
		return new Promise((resolve, reject) => {

			if(externalLoginUrl){
				const ProvisionApi      = beameSDK.ProvApi,
				      BeameAuthServices = require('./authServices'),
				      authServices      = BeameAuthServices.getInstance()
				      ;

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

	notifyRegisteredLoginServers(data, selfFqdn) {
		return new Promise((resolve,reject)=>{
			if(data){
				try{
					let savedRegisteredServers = JSON.parse(data);
					const ProvisionApi      = beameSDK.ProvApi,
					    BeameAuthServices = require('./authServices'),
					    authServices      = new BeameAuthServices(selfFqdn, "");

					let sign         = authServices.signData(selfFqdn),
					    provisionApi = new ProvisionApi();
					Promise.all(savedRegisteredServers.map(function (srv) {
						if(srv.fqdn && srv.id){
							let srvPath = 'https://' + srv.fqdn + apiConfig.Actions.Login.RecoverServer.endpoint;
							provisionApi.postRequest(srvPath, selfFqdn, (error) => {
								if (error) {
									reject(error);
								}
								else {
									resolve();
								}
							}, sign, 3);
						}
					})).then(resolve).catch((e)=>{reject(e)});

				}
				catch(e){
					reject(e);
				}
			}
			else resolve();
		});

	}
	//endregion


	//region Delegated logins manage

	getGkLogins() {
		return this._dataService.getGkLogins();
	}

	isFqdnRegistered(fqdn) {
		return new Promise((resolve, reject) => {
				this._dataService.findLogin(fqdn).then(login => {
					login && login.isActive ? resolve() : reject(login ? `Login ${fqdn} isInactive` : 'FQDN not registered');
				}).catch(reject);
			}
		);

	}

	saveGkLogin(login) {
		return this._dataService.saveGkLogin(login);
	}

	updateGkLogin(login) {

		return this._dataService.updateGkLogin(login);
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