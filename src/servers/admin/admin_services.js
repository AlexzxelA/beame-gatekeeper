/**
 * Created by zenit1 on 23/11/2016.
 */

"use strict";
const async        = require('async');
const beameSDK     = require('beame-sdk');
const module_name  = "BeameAdminServices";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const CommonUtils  = beameSDK.CommonUtils;
const Constants    = require('../../../constants');
const Bootstrapper = require('../../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();
let dataService    = null;

class AdminServices {

	/**
	 * @param {ServiceManager} _serviceManager
	 */
	constructor(_serviceManager) {
		this._serviceManager = _serviceManager;
		dataService          = require('../../dataServices').getInstance();
	}

	//region settings
	saveAppConfig(req) {
		return new Promise((resolve) => {

				let old = bootstrapper.appConfig;

				bootstrapper.setAppConfig = CommonUtils.parse(req.data).AppConfig;

				bootstrapper.setOcspCachePeriod();

				bootstrapper.saveAppConfigFile()
					.then(resolve)
					.catch(error => {
						logger.error(`update app config error ${BeameLogger.formatError(error)}`);

						bootstrapper.setAppConfig = old;

						return bootstrapper.saveAppConfigFile();
					});
			}
		);
	}

	saveDbConfig(req) {
		return new Promise((resolve) => {

				let old = bootstrapper.appConfig;

				bootstrapper.setDbProvider = CommonUtils.parse(req.data);

				bootstrapper.saveAppConfigFile()
					.then(resolve)
					.catch(error => {
						logger.error(`update app config error ${BeameLogger.formatError(error)}`);

						bootstrapper.setAppConfig = old;

						return bootstrapper.saveAppConfigFile();
					});
			}
		);
	}

	saveProxyConfig(data) {
		return new Promise((resolve, reject) => {

				if (CommonUtils.isObjectEmpty(data)) {
					reject('Empty data');
					return
				}

				let old = bootstrapper.appConfig;

				bootstrapper.setProxySettings = CommonUtils.parse(data);

				bootstrapper.saveAppConfigFile()
					.then(resolve)
					.catch(error => {
						logger.error(`update app config error ${BeameLogger.formatError(error)}`);

						bootstrapper.setAppConfig = old;

						return bootstrapper.saveAppConfigFile();
					});
			}
		);
	}

	getSettings() {
		return new Promise((resolve, reject) => {
				let data = {
					"AppConfig":  null,
					"DbConfig":   null,
					"Creds":      null,
					"RegMethods": null,
					"EnvModes":   null,
					"Version":    Bootstrapper.version
				};

				try {
					async.parallel([
							callback => {
								data.AppConfig = bootstrapper.appConfig;
								callback();
							},
							callback => {

								let lovDs = [], supportedDs = [];

								Object.keys(Constants.DbProviders).forEach(key => {
									lovDs.push({name: Constants.DbProviders[key]})
								});

								Object.keys(Constants.DbSupportedProviders).forEach(key => {
									supportedDs.push(Constants.DbProviders[key])
								});

								data.DbConfig = {
									provider:  bootstrapper.dbProvider,
									storage:   Bootstrapper.neDbRootPath,
									lov:       lovDs,
									supported: supportedDs.toString()
								};
								callback();
							},
							callback => {
								data.Creds = Bootstrapper.creds;
								callback();
							},
							callback => {

								const options = Constants.RegistrationMethod;

								let ds = [];

								Object.keys(options).forEach(key => {
									ds.push({name: options[key]})
								});

								data.RegMethods = ds;

								callback();
							},
							callback => {

								const options = Constants.EnvMode;

								let ds = [];

								Object.keys(options).forEach(key => {
									ds.push({name: options[key]})
								});

								data.EnvModes = ds;

								callback();
							},
							callback => {

								const options = Constants.HtmlEnvMode;

								let ds = [];

								Object.keys(options).forEach(key => {
									ds.push({name: options[key]})
								});

								data.HtmlEnvModes = ds;

								callback();
							},
							callback => {
								const utils = require('../../utils');

								data.CustomLoginProviders = utils.hashToArray(Constants.CustomLoginProviders);

								callback();
							}
						],
						() => {


							resolve(data);
						});
				} catch (e) {
					logger.error(`get settings error ${BeameLogger.formatError(e)}`);
					reject(e);
				}
			}
		);
	}

	//endregion

	static getProvisionSettings(activeOnly = false) {

		let config              = bootstrapper.provisionConfig.Fields,
		    fields2Return       = [],
		    customLoginProvider = bootstrapper.customLoginProvider;

		for (let i = 0; i < config.length; i++) {
			let c = config[i];

			if (c.LoginProvider == null || (c.LoginProvider != null && customLoginProvider != null && customLoginProvider == c.LoginProvider)) {
				fields2Return.push(c);
			}
		}

		return Promise.resolve(activeOnly ? fields2Return.filter(x => x.IsActive) : fields2Return);
	}


	saveProvisionSettings(data) {
		return new Promise((resolve, reject) => {
				try {
					let models = CommonUtils.parse(data);

					if (models.length) {
						let config = bootstrapper.provisionConfig;

						for (let i = 0; i < models.length; i++) {
							let m = models[i];

							for (let j = 0; j < config.Fields.length; j++) {
								if (config.Fields[j].FiledName == m.FiledName) {
									config.Fields[j].Label    = m.Label;
									config.Fields[j].IsActive = m.IsActive;
									config.Fields[j].Required = m.Required;
									config.Fields[j].Order    = m.Order;
									break;
								}
							}

						}

						bootstrapper.updateProvisionConfig(config).then(() => {
							bootstrapper.provisionConfig = config;
							resolve(models);
						}).catch(reject);
					}
					else {
						resolve([]);
					}

				} catch (e) {
					reject(e);
				}
			}
		);
	}

	//region users
	//noinspection JSMethodCanBeStatic
	getUsers() {
		return dataService.getUsers();
	}

	//noinspection JSMethodCanBeStatic
	updateUser(user) {
		return dataService.updateUser(user);
	}

	//endregion

	//region registrations
	//noinspection JSMethodCanBeStatic
	getRegistrations() {
		return dataService.getRegistrations();
	}

	//noinspection JSMethodCanBeStatic
	/**
	 *
	 * @param {Number} id
	 * @returns {Promise}
	 */
	deleteRegistration(id) {
		return dataService.deleteRegistration(id);
	}

	//endregion

	//region services
	//noinspection JSMethodCanBeStatic
	getServices() {
		return dataService.getServices();
	}

	saveService(service) {
		return new Promise((resolve, reject) => {
				dataService.saveService(service).then(entity => {
					this._serviceManager.evaluateAppList().then(() => {
						resolve(entity);
					}).catch(reject)
				}).catch(reject);
			}
		);

	}

	updateService(service) {

		return new Promise((resolve, reject) => {
				dataService.updateService(service).then(entity => {
					this._serviceManager.evaluateAppList().then(() => {
						resolve(entity);
					}).catch(reject)
				}).catch(reject);
			}
		);

	}

	deleteService(id) {
		return new Promise((resolve, reject) => {
				dataService.deleteService(id).then(this._serviceManager.evaluateAppList.bind(this._serviceManager)).then(resolve).catch(reject);
			}
		);

	}

	//endregion

	// region roles
	//noinspection JSMethodCanBeStatic
	getRoles() {
		return dataService.getRoles();
	}

	_updateRoles() {
		this.getRoles().then(roles => {
			bootstrapper.setRoles = roles;
		}).catch(e => {
			logger.error(`Update roles error ${BeameLogger.formatError(e)}`);
		});
	}

	saveRole(role) {
		return new Promise((resolve, reject) => {
				dataService.saveRole(role).then(entity => {
					this._updateRoles();
					resolve(entity);
				}).catch(reject)
			}
		);

	}

	updateRole(role) {
		return new Promise((resolve, reject) => {
				dataService.updateRole(role).then(entity => {
					this._updateRoles();
					resolve(entity);
				}).catch(reject)
			}
		);
	}

	deleteRole(id) {
		return new Promise((resolve, reject) => {
				dataService.deleteRole(id).then(() => {
					this._updateRoles();
					resolve();
				}).catch(reject)
			}
		);
	}

	//endregion
}

module.exports = AdminServices;