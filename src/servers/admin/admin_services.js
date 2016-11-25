/**
 * Created by zenit1 on 23/11/2016.
 */

"use strict";
const async          = require('async');
const beameSDK       = require('beame-sdk');
const module_name    = "BeameAdminServices";
const BeameLogger    = beameSDK.Logger;
const logger         = new BeameLogger(module_name);
const CommonUtils    = beameSDK.CommonUtils;
const Bootstrapper   = require('../../bootstrapper');
const bootstrapper   = new Bootstrapper();
const dataService    = new (require('../../dataServices'))();
const serviceManager = new (require('../gw/serviceManager'))();

class AdminServices {
	constructor() {

	}

	//region settings
	saveAppConfig(req) {
		return new Promise((resolve) => {

				let old = bootstrapper.appConfig;

				bootstrapper.setAppConfig = CommonUtils.parse(req.data).AppConfig;

				bootstrapper.saveAppConfigFile().then(resolve).catch(error => {
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
					"Creds":     null
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
					serviceManager.evaluateAppList().then(() => {
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
					serviceManager.evaluateAppList().then(() => {
						resolve(entity);
					}).catch(reject)
				}).catch(reject);
			}
		);

	}

	//noinspection JSMethodCanBeStatic
	deleteService(id) {
		return new Promise((resolve, reject) => {
				dataService.deleteService(id).then(serviceManager.evaluateAppList).then(resolve).catch(reject);
			}
		);

	}

	//endregion
}


module.exports = AdminServices;