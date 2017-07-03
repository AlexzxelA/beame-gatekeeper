/**
 * Created by zenit1 on 02/07/2017.
 */
"use strict";

const Datastore   = require('nedb');
const async       = require('async');
const path        = require('path');
const beameSDK    = require('beame-sdk');
const module_name = "NeDBServices";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);


const Collections = {
	user:          {
		name:    'user',
		indices: [{fieldName: 'fqdn', unique: true}, {fieldName: 'isAdmin', unique: false}]
	},
	services:      {
		name:    'services',
		indices: [{
			fieldName: 'code',
			unique:    true
		}]
	},
	registrations: {
		name:    'registrations',
		indices: [{fieldName: 'fqdn', unique: true}]
	},
	gk_logins:     {
		name:    'gk_logins',
		indices: [{
			fieldName: 'fqdn',
			unique:    true
		}, {fieldName: 'serviceId', unique: true}]
	},
	sessions:      {
		name:    'sessions',
		indices: []
	},
};

function onError(reject, error) {
	logger.error(BeameLogger.formatError(error), error);
	reject(error);
}

class NeDB {
	constructor(db_folder_path, options) {
		this._db_folder_path = db_folder_path;
		this._db             = {};
		this._options        = options;
	}

	start() {
		return new Promise((resolve, reject) => {
				this._loadCollections()
					.then(this._seedServices.bind(this))
					.then(() => {
						logger.info(`NeDB started successfully`);
						resolve();
					})
					.catch(reject)
			}
		);

	}

	//region seeders
	_seedServices() {
		return new Promise((resolve, reject) => {
				let services = require('../../nedb/seeders/services');

				const _saveServices = (srv) => {

					Promise.all(srv.map(data => {
							return this._insertDoc(Collections.services.name, data).then(() => {
								return Promise.resolve()
							});
						}
					)).then(() => {
						resolve()
					}).catch(reject);

				};

				return this._findDocs(Collections.services.name, {}).then(existing_services => {
					if (!existing_services.length) return _saveServices(services);

					let additioan_services = [];

					for (let i = 0; i < services.length; i++) {
						if (existing_services.some(x => x.code == services[i].code)) continue;

						additioan_services.push(services[i]);
					}

					return _saveServices(additioan_services);
				});
			}
		);
	}

	//endregion

	//region collections
	_loadCollections() {
		return new Promise((resolve, reject) => {

				async.parallel([
					cb => {
						this._loadCollection(Collections.user.name, Collections.user.indices)
							.then(() => {
								cb(null);
							})
							.catch(err => {
								cb(err);
							})
					},
					cb => {
						this._loadCollection(Collections.registrations.name, Collections.registrations.indices)
							.then(() => {
								cb(null);
							})
							.catch(err => {
								cb(err);
							})
					},
					cb => {
						this._loadCollection(Collections.services.name, Collections.services.indices)
							.then(() => {
								cb(null);
							})
							.catch(err => {
								cb(err);
							})
					},
					cb => {
						this._loadCollection(Collections.gk_logins.name, Collections.gk_logins.indices)
							.then(() => {
								cb(null);
							})
							.catch(err => {
								cb(err);
							})
					},
					cb => {
						this._loadCollection(Collections.sessions.name, Collections.sessions.indices)
							.then(() => {
								cb(null);
							})
							.catch(err => {
								cb(err);
							})
					}
				], err => {
					if (err) {
						reject(err)
					} else {
						logger.info(`All collections loaded`);
						resolve()
					}
				});
			}
		);
	}

	_addIndex(name, index) {
		return new Promise((resolve, reject) => {
				try {
					this._db[name].ensureIndex(index, err => {
						if (err) {
							reject(err)
						}
						else {
							logger.info(`Index for ${name} created`);
							resolve()
						}
					})
				} catch (e) {
					reject(e);
				}
			}
		);
	}

	/**
	 * @param {String} name
	 * @param {Array} indices
	 * @private
	 */
	_loadCollection(name, indices = []) {
		return new Promise((resolve, reject) => {

				const _resolve = () => {
					logger.info(`Collection ${name} created fully`);
					resolve()
				};

				try {

					this._db[name] = new Datastore({
						filename:      path.join(this._db_folder_path, `${name}.db`),
						timestampData: true
					});
					this._db[name].loadDatabase(err => {
						if (err) {
							reject(err);
							return;
						}
						logger.info(`${name} collection loaded`);
						if (indices.length) {
							Promise.all(indices.map(data => {
									return this._addIndex(name, data).then(() => {
										return Promise.resolve()
									});
								}
							)).then(() => {
								_resolve()
							}).catch(reject);
						}
						else {
							_resolve()
						}
					});

				} catch (e) {
					reject(e)
				}
			}
		);
	}

	//endregion

	//region db access operations
	_findDoc(collection, query) {
		return new Promise((resolve, reject) => {
				this._db[collection]
					.findOne(query, (err, doc) => {
						if (err) {
							reject(err)
						}
						else {
							resolve(doc)
						}
					})
			}
		);
	}

	_findDocs(collection, query) {
		return new Promise((resolve, reject) => {
				this._db[collection]
					.find(query, (err, docs) => {
						if (err) {
							reject(err)
						}
						else {
							resolve(docs)
						}
					})
			}
		);
	}

	_insertDoc(collection, doc) {
		return new Promise((resolve, reject) => {
				logger.info(`Inserting ${JSON.stringify(doc)} into ${collection}`);
				this._db[collection]
					.insert(doc, (err, newDoc) => {
						if (err) {
							reject(err)
						}
						else {
							resolve(newDoc)
						}
					})
			}
		);
	}

	_updateDoc(collection, query, update, options = {}) {
		return new Promise((resolve, reject) => {
				options['returnUpdatedDocs'] = true;
				this._db[collection].update(query, update, options, (err, numReplaced, returnUpdatedDocs) => {
					if (err) {
						reject(err)
					} else {
						this._db[collection].persistence.compactDatafile();
						resolve(returnUpdatedDocs);
					}
				});
			}
		);
	}

	_removeDoc(collection, query) {
		return new Promise((resolve, reject) => {
				this._db[collection](query, {}, (err, numRemoved) => {
					err || numRemoved != 1 ? reject(err || `Unexpected error`) : resolve()
					// numRemoved = 1
				});
			}
		);
	}

	//endregion

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
							pin:            data.pin,
							fqdn:           data.fqdn || null,
							hash:           data.hash
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

						record.update({hash: hash, hashValidTill: valid_till}).then(reg => {
							resolve(reg.dataValues);
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

	updateRegistrationPin(id, pin) {
		return new Promise((resolve, reject) => {
				try {
					let registration = this._models.registrations;
					//noinspection JSUnresolvedFunction
					registration.findById(id).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`Registration record not found`));
							return;
						}
						record.update({pin: pin}).then(() => {
							resolve();
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

	updateRegistrationCertFlag(id) {
		return new Promise((resolve, reject) => {
				let registration = this._models.registrations;
				//noinspection JSUnresolvedFunction
				registration.findById(id).then(record => {
					if (!record) {
						reject(logger.formatErrorMessage(`Registration recorc not found`));
						return;
					}
					record.update({certReceived: true}).then(rec => {
						resolve(rec.dataValues);
					}).catch(onError.bind(this, reject));

				}).catch(onError.bind(this, reject));

			}
		);
	}

	updateRegistrationUserDataFlag(id) {
		return new Promise((resolve, reject) => {
				let registration = this._models.registrations;
				//noinspection JSUnresolvedFunction
				registration.findById(id).then(record => {
					if (!record) {
						reject(logger.formatErrorMessage(`Registration record not found`));
						return;
					}
					record.update({userDataReceived: true}).then(rec => {
						resolve(rec.dataValues);
					}).catch(onError.bind(this, reject));

				}).catch(onError.bind(this, reject));

			}
		);
	}

	/**
	 * @param {String} hash
	 * @returns {Promise}
	 */
	findRegistrationRecordByHash(hash) {
		return new Promise((resolve) => {
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
		);
	}

	findRegistrationRecordByFqdn(fqdn) {
		return new Promise((resolve) => {
				let model = this._models.registrations;
				//noinspection JSUnresolvedFunction
				model.findOne({
					where: {
						fqdn: fqdn
					}
				}).then(record => {
					resolve(record ? record.dataValues : null);

				}).catch(error => {
					logger.error(BeameLogger.formatError(error));
					resolve(null);
				});
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
					logger.error(`delete session with id ${id} error ${BeameLogger.formatError(error)}`, error);
					reject(error);
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
		return new Promise((resolve) => {
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
				model.findOne({where: {fqdn: fqdn}}).then(item => {
					item ? resolve(item.dataValues) : resolve(null);
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
	updateUserActiveStatus(fqdn, isActive) {
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
						record.update({isDeleted: true, isActive: false}).then(resolve).catch(onError.bind(this, reject));

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
							name:     user.name,
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
		return this._findDocs(Collections.services.name, {})
	}

	getActiveServices() {
		return this._findDocs(Collections.services.name, {isActive: true});
	}

	_validateService(query) {
		return new Promise((resolve, reject) => {
				try {

					this._findDoc(Collections.services.name, query).then(record => {
						record ? reject(`Check service code and url, it should be unique`) : resolve();
					}).catch(reject)
				} catch (e) {
					reject(e);
				}
			}
		);
	}

	saveService(service) {
		return new Promise((resolve, reject) => {

				let query = {
					code: service.code,
					url:  service.url
				};

				this._validateService(query).then(() => {

					this._insertDoc(Collections.services.name, service).then(doc => {
						resolve(doc);
					}).catch(onError.bind(this, reject));
				}).catch(reject);

			}
		);
	}

	updateService(service) {
		return new Promise((resolve, reject) => {

				let $this = this;

				const _update = () => {
					let update = {
						$set: {
							url:        service.url,
							name:       service.name,
							isActive:   service.isActive,
							isMobile:   service.isMobile,
							isExternal: service.isExternal

						}
					};

					this._updateDoc(Collections.services.name, {_id: service._id}, update).then(resolve).catch(reject);
				};

				let query = {_id: {$ne: service._id}, $and: [{$or: [{code: service.code}, {url: service.url}]}]};

				this._validateService(query).then(_update.bind($this)).catch(reject);

			}
		);
	}

	updateServiceUrl(_id, url) {
		return new Promise((resolve, reject) => {

				let $this = this;

				const _update = () => {
					let update = {
						$set: {
							url:       url,
							updatedAt: new Date()
						}
					};

					this._updateDoc(Collections.services.name, {_id: _id}, update, {upsert: false}).then(resolve).catch(reject);
				};

				let query = {_id: {$ne: _id}, $and: [{url: url}]};

				this._validateService(query).then(_update.bind($this)).catch(reject);

			}
		);
	}

	deleteService(_id) {
		return this._removeDoc(Collections.services.name, {_id: _id});
	}

	//endregion

	//region gkLogins
	getGkLogins() {
		return new Promise((resolve) => {
				let model = this._models.gklogins;

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

	getActiveGkLogins() {
		return new Promise((resolve) => {
				let model = this._models.gklogins;

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

	getOnlineGkLogins() {
		return new Promise((resolve) => {
				let model = this._models.gklogins;

				//noinspection JSUnresolvedFunction
				model.findAll({where: {isActive: true, isOnline: true}}).then(models => {
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

	setAllGkLoginOffline() {
		try {
			this._sequelize.query('UPDATE GkLogins SET isOnline = 0');
			return Promise.resolve();
		} catch (e) {
			return Promise.reject(e);
		}
	}

	findLogin(fqdn) {
		return new Promise((resolve) => {
				let model = this._models.gklogins;

				//noinspection JSUnresolvedFunction
				model.findOne({where: {fqdn: fqdn}}).then(item => {
						item ? resolve(item.dataValues) : resolve(null);
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

	saveGkLogin(login) {
		return new Promise((resolve, reject) => {

				let model = this._models.gklogins;

				try {

					delete login.id;

					//noinspection JSUnresolvedFunction
					model.create(login).then(entity => {
						resolve(entity.dataValues);
					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					onError(reject, error)
				}
			}
		);
	}

	updateGkLogin(login) {
		return new Promise((resolve, reject) => {
				try {
					let model = this._models.gklogins;
					//noinspection JSUnresolvedFunction
					model.findById(login.id).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`Gk Login record not found`));
							return;
						}
						record.update({
							name:     login.name,
							isActive: login.isActive,
							isOnLine: login.isOnline
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

	updateGkLoginState(fqdn, serviceId, isOnline) {
		return new Promise((resolve, reject) => {
				try {
					let model = this._models.gklogins;
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							fqdn: fqdn
						}
					}).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`Gk Login record not found`));
							return;
						}
						record.update({
							serviceId: serviceId,
							isOnline:  isOnline
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

	deleteGkLogin(id) {
		return new Promise((resolve, reject) => {
				logger.debug(`try delete gk login ${id}`);
				let model = this._models.gklogins;
				model.destroy({where: {id: id}}).then(resolve).catch(reject);
			}
		);
	}

	//endregion
}

module.exports = NeDB;
