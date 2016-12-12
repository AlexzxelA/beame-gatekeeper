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
	logger.error(BeameLogger.formatError(error), error);
	reject(error);
}

class SqliteServices {
	/**
	 * @param {DataServicesSettings} options
	 */
	constructor(options) {

		let config = bootstrapper.sqliteConfig;

		if (!config) {
			logger.error(`Sqlite config file not found`);
			return;
		}

		this._options = options;

		const models = require("../../models/index");

		this._sequelize = models.sequelize;

	}

	start() {
		return new Promise((resolve, reject) => {
				this._sequelize.sync().then(() => {

					this._models = {
						sessions:      this._sequelize.models["Session"],
						registrations: this._sequelize.models["Registration"],
						users:         this._sequelize.models["User"],
						services:      this._sequelize.models["Service"]
					};

					logger.info(`Sqlite services started`);

					resolve()
				}).catch(reject);
			}
		);
	}

	//region registration services
	getRegistrations() {
		return new Promise((resolve) => {
				logger.debug(`try fetch registrations`);
				let model = this._models.registrations;

				//noinspection JSUnresolvedFunction
				model.findAll({order: 'id DESC'}).then(models => {
						let records = models.map(item => {
							return item.dataValues
						});
						resolve(records);
					}
				).catch(
					error => {
						logger.error(error);
						resolve([]);
					}
				);
			}
		);
	}

	/**
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	saveRegistration(data) {
		return new Promise((resolve, reject) => {

				let model = this._models.registrations;

				try {
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							email:          data.email,
							name:           data.name,
							externalUserId: data.user_id
						}
					}).then(record => {
						if (record) {
							reject(`Record for email ${data.email}, name ${data.name}, userId ${data.user_id} already registered`);
							return;
						}

						model.create({
							name:           data.name,
							email:          data.email,
							externalUserId: data.user_id,
							fqdn:           data.fqdn || null
						}).then(record => {
							resolve(record.dataValues);
						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					onError(reject, error)
				}
			}
		);
	}

	/**
	 * @param {RegistrationData} data
	 * @returns {Promise.<Registration|null>}
	 */
	isRegistrationExists(data) {
		return new Promise((resolve, reject) => {

				let model = this._models.registrations;

				try {
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							email:          data.email,
							name:           data.name,
							externalUserId: data.user_id
						}
					}).then(record => {
						resolve(record ? record.dataValues : null);
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

	/**
	 * @param {String} fqdn
	 * @returns {Promise.<Registration>}
	 */
	markRegistrationAsCompleted(fqdn) {
		return new Promise((resolve, reject) => {
				try {
					let model = this._models.registrations;
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							fqdn: fqdn
						}
					}).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`Registration record not found`));
							return;
						}

						record.update({completed: true}).then(record => {
							resolve(record.dataValues);
						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					onError(reject, error);
				}
			}
		);
	}

	updateRegistrationFqdn(hash, fqdn) {

	}

	/**
	 *
	 * @param id
	 * @param {SignatureToken|String} sign
	 */
	updateRegistrationHash(id, sign) {
		return new Promise((resolve, reject) => {
				try {
					let registration = this._models.registrations;
					//noinspection JSUnresolvedFunction
					registration.findById(id).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`Registration record not found`));
							return;
						}

						var signObj = CommonUtils.parse(sign);

						if (signObj == null) {
							onError(reject, new Error(`invalid auth token`));
							return;
						}
						//noinspection JSValidateTypes
						/** @type {SignedData}*/
						let signedData = signObj.signedData,
						    hash       = signedData.data,
						    valid_till = signedData.valid_till;

						record.update({hash: hash, hashValidTill: valid_till}).then(regs => {
							resolve(regs.dataValues);
						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					onError(reject, error);
				}
			}
		);
	}

	/**
	 * @param {String} hash
	 * @returns {Promise}
	 */
	findRegistrationRecordByHash(hash) {
		return new Promise((resolve) => {
				try {
					let model = this._models.registrations;
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							hash: hash
						}
					}).then(record => {
						resolve(record ? record.dataValues : null);

					}).catch(error => {
						logger.error(BeameLogger.formatError(error));
						resolve(null);
					});

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					resolve(null);
				}
			}
		);
	}

	//endregion

	//region session
	deleteSessionById(id) {
		return new Promise((resolve, reject) => {
				logger.debug(`try delete session by id ${id}`);
				let model = this._models.sessions;
				model.destroy({where: {id: id}}).then(resolve).catch(error => {
					logger.error(`delete session with id ${id} error ${BeameLogger.formatError(error)}`, error)
				});
			}
		);
	}

	/**
	 *
	 * @param {String} pin
	 * @returns {Promise}
	 */
	deleteSessionByPin(pin) {
		return new Promise((resolve, reject) => {
				logger.debug(`try delete session by pin ${pin}`);


				let model = this._models.sessions;

				//noinspection JSUnresolvedFunction
				model.findAll({where: {pin: pin}}).then(records => {
					if (records.length == 1) {
						return this.deleteSessionById(records[0].dataValues.id);
					}

					let ids = records.map(item => item.dataValues.id);

					return this._setSessionTtl(ids);

				}).catch(error => {
					logger.error(`deleteSessionByPin ${pin} error ${BeameLogger.formatError(error)}`);
					resolve();
				});

			}
		);
	}

	/**
	 * @param {Array.<number>}ids
	 * @returns {Promise}
	 * @private
	 */
	_setSessionTtl(ids) {
		return new Promise((resolve) => {
				let timeout = this._options.session_timeout;
				if (!timeout) {
					resolve();
					return;
				}

				ids.forEach(id => {
					setTimeout(() => {
						logger.debug(`deleting session ${id}`);
						this.deleteSessionById(id)
					}, timeout);
				})

			}
		);
	}

	/**
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	saveSession(data) {
		return new Promise((resolve, reject) => {

				let model = this._models.sessions;

				try {
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							email:          data.email,
							name:           data.name,
							externalUserId: data.user_id
						}
					}).then(record => {
						if (record) {
							this.deleteSessionById(record.id)
						}

						model.create({
							name:           data.name,
							email:          data.email,
							externalUserId: data.user_id,
							pin:            data.pin
						}).then(session => {

							this._setSessionTtl([session.id]);

							resolve(session.id);

						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					onError(reject, error)
				}
			}
		);
	}

	//endregion

	//region user
	/**
	 * @param {User} user
	 */
	saveUser(user) {
		return new Promise((resolve, reject) => {
				this.findUser(user.fqdn).then(record => {
					if (record) {
						reject(`User with FQDN ${user.fqdn} already exists`);
						return;
					}

					let model = this._models.users;

					model.create(user).then(entity => {
						resolve(entity.dataValues);
					}).catch(onError.bind(this, reject));

				}).catch(reject);
			}
		);
	}

	/**
	 * @param fqdn
	 * @returns {Promise.<User>}
	 */
	findUser(fqdn) {
		return new Promise((resolve, reject) => {
				let model = this._models.users;

				//noinspection JSUnresolvedFunction
				model.findOne({where: {fqdn: fqdn}}).then(user => {
					user ? resolve(user.dataValues) : resolve(null);
				}).catch(reject);
			}
		);
	}

	/**
	 * Search users by predicated query
	 * @param {Object} predicate
	 */
	searchUsers(predicate) {
		return new Promise((resolve, reject) => {
				let model = this._models.users;

				//noinspection JSUnresolvedFunction
				model.findAll({where: predicate}).then(users => {
					let records = users.map(item => {
						return item.dataValues
					});
					resolve(records);
				}).catch(reject);
			}
		);
	}

	/**
	 * Update login info , like LastActiveDate
	 * @param fqdn
	 */
	updateLoginInfo(fqdn) {
		return new Promise((resolve, reject) => {
				try {
					let model = this._models.users;
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							fqdn: fqdn
						}
					}).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`User record not found`));
							return;
						}
						record.update({lastActiveDate: new Date()}).then(resolve).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					onError(reject, error);
				}
			}
		);
	}

	/**
	 * @param {String} fqdn
	 * @param {Boolean} isActive
	 */
	updateUserActiveStatus(fqdn,isActive) {
		return new Promise((resolve, reject) => {
				try {
					let model = this._models.users;
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							fqdn: fqdn
						}
					}).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`User record not found`));
							return;
						}
						record.update({isActive: isActive}).then(resolve).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					onError(reject, error);
				}
			}
		);
	}

	/**
	 * @param {String} fqdn
	 */
	markUserAsDeleted(fqdn) {
		return new Promise((resolve, reject) => {
				try {
					let model = this._models.users;
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							fqdn: fqdn
						}
					}).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`User record not found`));
							return;
						}
						record.update({isDeleted: true}).then(resolve).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					onError(reject, error);
				}
			}
		);
	}

	/**
	 *
	 * @param {User} user
	 */
	updateUser(user) {
		return new Promise((resolve, reject) => {
				try {
					let model = this._models.users;
					//noinspection JSUnresolvedFunction
					model.findById(user.id).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`User record not found`));
							return;
						}
						record.update({
							isAdmin:  user.isAdmin,
							isActive: user.isActive
						}).then(entity => {
							resolve(entity.dataValues);
						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					onError(reject, error);
				}
			}
		);
	}

	/**
	 *
	 * @param {User} user
	 */
	updateUserProfile(user) {
		return new Promise((resolve, reject) => {
				try {
					let model = this._models.users;
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							fqdn: user.fqdn
						}
					}).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`User record not found`));
							return;
						}
						record.update({
							name:  user.name,
							nickname: user.nickname
						}).then(entity => {
							resolve(entity.dataValues);
						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					onError(reject, error);
				}
			}
		);
	}

	getUsers() {
		return new Promise((resolve) => {
				logger.debug(`try fetch users`);
				let model = this._models.users;

				//noinspection JSUnresolvedFunction
				model.findAll({order: 'id DESC'}).then(models => {
						let records = models.map(item => {
							return item.dataValues
						});
						resolve(records);
					}
				).catch(
					error => {
						logger.error(error);
						resolve([]);
					}
				);
			}
		);
	}

	//endregion

	//region services
	getServices() {
		return new Promise((resolve) => {
				let model = this._models.services;

				//noinspection JSUnresolvedFunction
				try {
					model.findAll({order: 'id DESC'}).then(models => {
							let records = models.map(item => {
								return item.dataValues
							});
							resolve(records);
						}
					).catch(
						error => {
							logger.error(error);
							resolve([]);
						}
					);
				} catch (e) {
					logger.error(e);
					resolve([]);
				}
			}
		);
	}

	getActiveServices() {
		return new Promise((resolve) => {
				let model = this._models.services;

				//noinspection JSUnresolvedFunction
				model.findAll({where: {isActive: true}}).then(models => {
						let records = models.map(item => {
							return item.dataValues
						});
						resolve(records);
					}
				).catch(
					error => {
						logger.error(error);
						resolve([]);
					}
				);
			}
		);
	}

	saveService(service) {
		return new Promise((resolve, reject) => {
				var condition = {
					where: Sequelize.and(
						{code: service.code},
						Sequelize.or(
							{url: service.url}
						)
					)
				};
				let model     = this._models.services;

				try {
					//noinspection JSUnresolvedFunction
					model.findOne(condition).then(record => {
						if (record) {
							reject(`Record for code ${service.code} or url ${service.url} already registered`);
							return;
						}

						delete service.id;

						model.create(service).then(entity => {
							resolve(entity.dataValues);
						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					onError(reject, error)
				}
			}
		);
	}

	updateService(service) {
		return new Promise((resolve, reject) => {
				try {
					let model = this._models.services;
					//noinspection JSUnresolvedFunction
					model.findById(service.id).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`Service record not found`));
							return;
						}
						record.update({
							url:      service.url,
							name:     service.name,
							isActive: service.isActive
						}).then(entity => {
							resolve(entity.dataValues);
						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					onError(reject, error);
				}
			}
		);
	}

	deleteService(id) {
		return new Promise((resolve, reject) => {
				logger.debug(`try delete registration ${id}`);
				let model = this._models.services;
				model.destroy({where: {id: id}}).then(resolve).catch(reject);
			}
		);
	}

	//endregion
}

module.exports = SqliteServices;