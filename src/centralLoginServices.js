/**
 * Created by zenit1 on 08/03/2017.
 */
"use strict";
const apiConfig                 = require('../config/api_config.json');
const beameSDK                  = require('beame-sdk');
const BeameLogger               = beameSDK.Logger;
const logger                    = new BeameLogger("CentralLoginServices");
const ProvisionApi              = beameSDK.ProvApi;
const CommonUtils               = beameSDK.CommonUtils;
const Constants                 = require('../constants');
const Bootstrapper              = require('./bootstrapper');
const bootstrapper              = Bootstrapper.getInstance();
const utils                     = require('./utils');
const nop                       = function () {
};
let centralLoginServiceInstance = null;

class CentralLoginServices {


	constructor() {
		this._dataService          = require('./dataServices').getInstance();
		this._onlineServers        = [];
		this._onlineServersFetched = false;
		this._gwFqdn               = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
	}

	//region server manager helpers
	sendACKToDelegatedCentralLogin(action) {
		return new Promise((resolve, reject) => {
			let externalLoginUrl = bootstrapper.externalLoginUrl,
			    data             = {
				    fqdn:   this._gwFqdn,
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

	notifyRegisteredLoginServers() {
		return new Promise((resolve, reject) => {

			let data = {
				action: Constants.DelegatedLoginNotificationAction.Register
			};

			this.getActiveGkLogins()
				.then(logins => {
					Promise.all(logins.map(login => {
							return this.sendACKToSlave(login.fqdn, data);
						}))
						.then(resolve)
						.catch(error => {
							logger.error(`Notify to slaves error ${BeameLogger.formatError(error)}`);
							resolve();
						});
				})
				.catch(reject);
		});

	}

	sendACKToSlave(fqdn, data) {
		return new Promise((resolve, reject) => {

				const _postToSlave = sign => {
					let provisionApi = new ProvisionApi();
					let srvPath      = 'https://' + fqdn + apiConfig.Actions.Login.RecoverServer.endpoint;
					provisionApi.postRequest(srvPath, data, (error) => {
						if (error) {
							reject(error);
						}
						else {
							resolve();
						}
					}, CommonUtils.stringify(sign), 3);
				};

				utils.signDataWithFqdn(this._gwFqdn, data)
					.then(_postToSlave)
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

	onlineServers() {

		return new Promise((resolve) => {
				if (this._onlineServersFetched) {
					resolve(this._onlineServers);
					return;
				}

				this._getOnlineGkLogins()
					.then(servers => {
						this._onlineServersFetched = true;
						this._onlineServers        = servers;
						resolve(this._onlineServers);
					})
					.catch(error => {
						logger.error('Get online GK servers', error);
						this._onlineServers = [];
						resolve(this._onlineServers);
					})

			}
		);
	}


	_getOnlineGkLogins() {

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

	setAllGkLoginOffline() {
		this._onlineServersFetched = false;
		return this._dataService.setAllGkLoginOffline();
	}

	saveGkLogin(login) {
		this._onlineServersFetched = false;
		return this._dataService.saveGkLogin(login);
	}

	updateGkLogin(login) {
		this._onlineServersFetched = false;
		return new Promise((resolve, reject) => {
				this._dataService.findLogin(login.fqdn).then(record => {
					if (!record) {
						reject(`record for ${login.fqdn} not found`);
						return;
					}

					this._dataService.updateGkLogin(login).then(updated => {
						let statusChanged = false,
						    action        = null;

						let isActive = login.isActive == "true";

						if (record.isActive != isActive) {
							action        = isActive ? Constants.DelegatedLoginNotificationAction.Register : Constants.DelegatedLoginNotificationAction.UnRegister;
							statusChanged = true;
						}

						if (statusChanged) {
							this.sendACKToSlave(login.fqdn, {action}).then(nop).catch(error => {
								logger.error(`Notify to ${login.fqdn} failed`, error);
							});
						}

						resolve(updated);
					});


				}).catch(reject);
			}
		);


	}

	updateGkLoginState(fqdn, serviceId, isOnline) {
		this._onlineServersFetched = false;
		return this._dataService.updateGkLoginState(fqdn, serviceId, isOnline);
	}

	deleteGkLogin(login) {
		this._onlineServersFetched = false;

		return new Promise((resolve, reject) => {
				this.sendACKToSlave(login.fqdn, {action: Constants.DelegatedLoginNotificationAction.UnRegister}).then(nop).catch(error => {
					logger.error(`Notify to ${login.fqdn} failed`, error);
				});

				this._dataService.deleteGkLogin(parseInt(login.id)).then(resolve).catch(reject);
			}
		);


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