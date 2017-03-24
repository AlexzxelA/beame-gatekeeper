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
const Constants = require('../../../constants');
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
					"AppConfig": null,
					"DbConfig":  null,
					"Creds":     null,
					"RegMethods":null,
					"EnvModes"  :null
				};

				try {
					async.parallel([
							callback => {
								data.AppConfig = bootstrapper.appConfig;
								callback();
							},
							callback => {
								data.DbConfig = bootstrapper.sqliteConfig;
								delete  data.DbConfig.password;
								callback();

							},
							callback => {
								data.Creds = bootstrapper.creds;
								callback();
							},
							callback =>{

								const options = Constants.RegistrationMethod;

								let ds = [];

								Object.keys(options).forEach(key=>{
									ds.push({name:options[key]})
								});

								data.RegMethods = ds;

								callback();
							},
							callback =>{

								const options = Constants.EnvMode;

								let ds = [];

								Object.keys(options).forEach(key=>{
									ds.push({name:options[key]})
								});

								data.EnvModes = ds;

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

	//noinspection JSMethodCanBeStatic
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

	//noinspection JSMethodCanBeStatic
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

	//noinspection JSMethodCanBeStatic
	deleteService(id) {
		return new Promise((resolve, reject) => {
				dataService.deleteService(id).then(this._serviceManager.evaluateAppList.bind(this._serviceManager)).then(resolve).catch(reject);
			}
		);

	}

	//endregion
}

module.exports = AdminServices;