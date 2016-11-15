/**
 * Created by zenit1 on 15/11/2016.
 */
"use strict";

const Sequelize    = require('sequelize');
const beameSDK     = require('beame-sdk');
const module_name  = "SqliteServices";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const bootstrapper = new (require('../bootstrapper'))();

function onError(reject, error) {
	logger.error(BeameLogger.formatError(error));
	reject(error);
}

class SqliteServices {
	constructor() {

		let config = bootstrapper.sqliteConfig;

		if (!config) {
			logger.error(`Sqlite config file not found`);
			return;
		}


		this._sequelize = new Sequelize(config["database"], config["username"], config["password"], {
			dialect: 'sqlite',

			pool:    {
				max:  5,
				min:  0,
				idle: 10000
			},
			// SQLite only
			storage: config["storage"]
		});

		this._models = {
			sessions:      this._sequelize.models["Sessions"],
			registrations: this._sequelize.models["Registrations"],
			users:         this._sequelize.models["Users"],
			services:      this._sequelize.models["Services"]
		};

		logger.debug(`Sqlite services started`);
	}

	//region registration services
	getRegistrations() {

	}

	/**
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	saveRegistration(data) {
		return new Promise((resolve, reject) => {

				let registration = this._models.registrations;

				try {
					//noinspection JSUnresolvedFunction
					registration.findOne({
						where: {
							email:          data.email,
							name:           data.email,
							externalUserId: data.userId
						}
					}).then(record=> {
						if (record) {
							reject(`Record for email ${data.email}, name ${data.name}, userId ${data.userId} already registered`);
							return;
						}

						registration.create({
							name:           data.name,
							email:          data.email,
							externalUserId: data.userId
						}).then(regs=> {
							resolve(regs.id);
						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					onError(reject, error)
				}
			}
		);
	}

	deleteRegistration(id) {
		return new Promise((resolve, reject) => {
				logger.debug(`try delete registration ${id}`);
				let model = this._models.registrations;
				model.destroy({where: {id: id}}).then(resolve).catch(reject);
			}
		);
	}

	markRegistrationAsCompleted(fqdn) {

	}

	updateRegistrationFqdn(hash, fqdn) {

	}

	//endregion

	deleteSessionById(id) {
		return new Promise((resolve, reject) => {
				logger.debug(`try delete session by id ${id}`);
				let model = this._models.sessions;
				model.destroy({where: {id: id}}).then(resolve).catch(reject);
			}
		);
	}

	/**
	 *
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	deleteSessionByData(data) {
		return new Promise((resolve, reject) => {
				logger.debug(`try delete session by id ${id}`);
				let model = this._models.sessions;
				model.destroy({
					where: {
						email:          data.email,
						name:           data.email,
						externalUserId: data.userId,
						pin:            data.pin
					}
				}).then(resolve).catch(reject);
			}
		);
	}

	/**
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */


	saveRegistrationSession(data) {
		return new Promise((resolve, reject) => {

				let model = this._models.sessions;

				try {
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							email:          data.email,
							name:           data.email,
							externalUserId: data.userId
						}
					}).then(record=> {
						if (record) {
							this.deleteSessionById(record.id)
						}

						model.create({
							name:           data.name,
							email:          data.email,
							externalUserId: data.userId
						}).then(regs=> {
							resolve(regs.id);
						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					onError(reject, error)
				}
			}
		);
	}
}

module.exports = SqliteServices;