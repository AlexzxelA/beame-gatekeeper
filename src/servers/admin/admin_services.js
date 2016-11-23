/**
 * Created by zenit1 on 23/11/2016.
 */

"use strict";
const async        = require('async');
const Constants    = require('../../../constants');
const beameSDK     = require('beame-sdk');
const module_name  = "BeameAdminServices";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const CommonUtils  = beameSDK.CommonUtils;
const store        = new (beameSDK.BeameStore)();
const Bootstrapper = require('../../bootstrapper');
const bootstrapper = new Bootstrapper();
const dataService  = new (require('../../dataServices'))();

class AdminServices {
	constructor() {

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

	//noinspection JSMethodCanBeStatic
	getUsers() {
		return dataService.getUsers();
	}

	//noinspection JSMethodCanBeStatic
	updateUser(user) {
		return dataService.updateUser(user);
	}

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

}


module.exports = AdminServices;