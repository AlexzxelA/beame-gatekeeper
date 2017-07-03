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
const CommonUtils = beameSDK.CommonUtils;

const Collections = {
	user:          {
		name:    'user',
		indices: [{fieldName: 'id', unique: true}, {fieldName: 'fqdn', unique: true}, {
			fieldName: 'isAdmin',
			unique:    false
		}]
	},
	services:      {
		name:    'services',
		indices: [{fieldName: 'id', unique: true}, {
			fieldName: 'code',
			unique:    true
		}]
	},
	registrations: {
		name:    'registrations',
		indices: [{fieldName: 'id', unique: true}, {fieldName: 'fqdn', unique: true}]
	},
	gk_logins:     {
		name:    'gk_logins',
		indices: [{fieldName: 'id', unique: true}, {
			fieldName: 'fqdn',
			unique:    true
		}, {fieldName: 'serviceId', unique: true}]
	},
	sessions:      {
		name:    'sessions',
		indices: [{fieldName: 'id', unique: true}]
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

	_getUniqueId(collection) {
		return new Promise((resolve, reject) => {
				this._updateDoc(
					collection,
					{_id: '__autoid__'},
					{$inc: {value: 1}},
					{upsert: true, returnUpdatedDocs: true}
				).then(doc => {
					resolve(doc.value);
				}).catch(reject);

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
						this._db[name].insert({_id: '__autoid__', value: -1});
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

				this._getUniqueId(collection).then(id => {
					logger.info(`Inserting ${JSON.stringify(doc)} into ${collection}`);
					doc.id = id;
					this._db[collection]
						.insert(doc, (err, newDoc) => {
							if (err) {
								reject(err)
							}
							else {
								resolve(newDoc)
							}
						})
				}).catch(reject)
			}
		);
	}

	_updateDoc(collection, query, update, options = {}) {
		return new Promise((resolve, reject) => {
				options['returnUpdatedDocs'] = true;
				try {
					this._db[collection].update(query, update, options, (err, numReplaced, returnUpdatedDocs) => {
						if (err) {
							reject(err)
						} else {
							this._db[collection].persistence.compactDatafile();
							resolve(returnUpdatedDocs);
						}
					});
				} catch (e) {
					console.log(e)
				}
			}
		);
	}

	_removeDoc(collection, query, options = {}) {
		return new Promise((resolve, reject) => {
				this._db[collection].remove(query, options, (err, numRemoved) => {
					err ? reject(err || `Unexpected error`) : resolve()
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

				this._findDocs(Collections.registrations.name, {}).then(docs => {
					resolve(docs)
				}).catch(e => {
					logger.error(`Fetch registrations error ${BeameLogger.formatError(e)}`)
					resolve([])
				})
			}
		);
	}

	/**
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	saveRegistration(data) {
		return new Promise((resolve, reject) => {

				try {
					//noinspection JSUnresolvedFunction
					this._findDoc(Collections.registrations.name, {
						email:          data.email,
						name:           data.name,
						externalUserId: data.user_id
					}).then(doc => {
						if (doc && doc.completed === true) {
							reject(`Record for email ${data.email}, name ${data.name}, userId ${data.user_id} already registered`);
							return;
						}

						if (doc) {
							resolve(doc);
						} else {
							this._insertDoc(Collections.registrations.name, {
								name:             data.name,
								email:            data.email,
								externalUserId:   data.user_id,
								pin:              data.pin,
								fqdn:             data.fqdn || null,
								hash:             data.hash,
								completed:        false,
								certReceived:     false,
								userDataReceived: false
							})
						}

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

				try {
					this._findDoc(Collections.registrations.name, {
						where: {
							email:          data.email,
							name:           data.name,
							externalUserId: data.user_id
						}
					}).then(doc => {
						resolve(doc);
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
				this._removeDoc(Collections.registrations.name, {id: id}).then(resolve).catch(reject)
			}
		);

	}

	/**
	 * @param {String} fqdn
	 * @returns {Promise.<Registration>}
	 */
	markRegistrationAsCompleted(fqdn) {
		return this._updateDoc(Collections.registrations.name, {fqdn: fqdn}, {
			$set: {completed: true}
		})
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

					this._findDoc(Collections.registrations.name, {id: id}).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`Registration record not found`));
							return;
						}

						let signObj = CommonUtils.parse(sign);

						if (signObj == null) {
							onError(reject, new Error(`invalid auth token`));
							return;
						}
						//noinspection JSValidateTypes
						/** @type {SignedData}*/
						let signedData = signObj.signedData,
						    hash       = signedData.data,
						    valid_till = signedData.valid_till;

						this._updateDoc(Collections.registrations.name, {_id: record._id}, {
							$set: {hash: hash, hashValidTill: valid_till}
						}).then(resolve).catch(onError.bind(this, reject));

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
				this._findDoc(Collections.registrations.name, {id: id}).then(record => {
					if (!record) {
						reject(logger.formatErrorMessage(`Registration record not found`));
						return;
					}

					this._updateDoc(Collections.registrations.name, {_id: record._id}, {
						$set: {pin: pin}
					}).then(resolve).catch(onError.bind(this, reject));

				}).catch(onError.bind(this, reject));
			}
		);
	}

	updateRegistrationCertFlag(id) {
		return new Promise((resolve, reject) => {
				this._findDoc(Collections.registrations.name, {id: id}).then(record => {
					if (!record) {
						reject(logger.formatErrorMessage(`Registration record not found`));
						return;
					}

					this._updateDoc(Collections.registrations.name, {_id: record._id}, {
						$set: {certReceived: true}
					}).then(resolve).catch(onError.bind(this, reject));

				}).catch(onError.bind(this, reject));
			}
		);
	}

	updateRegistrationUserDataFlag(id) {
		return new Promise((resolve, reject) => {

				this._findDoc(Collections.registrations.name, {id: id}).then(record => {
					if (!record) {
						reject(logger.formatErrorMessage(`Registration record not found`));
						return;
					}

					this._updateDoc(Collections.registrations.name, {_id: record._id}, {
						$push: {userDataReceived: true}
					}).then(resolve).catch(onError.bind(this, reject));

				}).catch(onError.bind(this, reject));


			}
		);
	}

	/**
	 * @param {String} hash
	 * @returns {Promise}
	 */
	findRegistrationRecordByHash(hash) {
		return new Promise((resolve, reject) => {
				this._findDoc(Collections.registrations.name, {
					hash: hash
				}).then(resolve).catch(reject);
			}
		);

	}

	findRegistrationRecordByFqdn(fqdn) {
		return new Promise((resolve, reject) => {
				this._findDoc(Collections.registrations.name, {
					fqdn: fqdn
				}).then(resolve).catch(reject);
			}
		);

	}

	//endregion

	//region session
	deleteSessionById(id) {
		return new Promise((resolve, reject) => {
				this._removeDoc(Collections.sessions.name, {id: id}).then(resolve).catch(reject)
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
				this._removeDoc(Collections.sessions.name, {pin: pin}, {multi: true}).then(resolve).catch(reject)
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

				try {
					this._findDoc(Collections.sessions.name, {
						email:          data.email,
						name:           data.name,
						externalUserId: data.user_id

					}).then(record => {
						if (record) {
							this.deleteSessionById(record._id)
						}

						this._insertDoc(Collections.sessions.name, {
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

					this._insertDoc(Collections.user.name, user).then(resolve).catch(onError.bind(this, reject));

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
				this._findDoc(Collections.user.name, {fqdn: fqdn}).then(resolve).catch(reject)
			}
		);

	}

	/**
	 * Search users by predicated query
	 * @param {Object} predicate
	 */
	searchUsers(predicate) {
		return new Promise((resolve, reject) => {
				this._findDocs(Collections.user.name, predicate).then(resolve).catch(reject)
			}
		);

	}

	/**
	 * Update login info , like LastActiveDate
	 * @param fqdn
	 */
	updateLoginInfo(fqdn) {
		return new Promise((resolve, reject) => {
				this._updateDoc(Collections.user.name, {fqdn: fqdn}, {$set: {lastActiveDate: new Date()}}).then(resolve).catch(reject)
			}
		);

	}

	/**
	 * @param {String} fqdn
	 * @param {Boolean} isActive
	 */
	updateUserActiveStatus(fqdn, isActive) {
		return new Promise((resolve, reject) => {
				this._updateDoc(Collections.user.name, {fqdn: fqdn}, {$set: {lisActive: isActive}}).then(resolve).catch(reject)
			}
		);
	}

	/**
	 * @param {String} fqdn
	 */
	markUserAsDeleted(fqdn) {
		return new Promise((resolve, reject) => {
				this._updateDoc(Collections.user.name, {fqdn: fqdn}, {
					$set: {
						isDeleted: true,
						isActive:  false
					}
				}).then(resolve).catch(reject)
			}
		);

	}

	/**
	 *
	 * @param {Object} user
	 */
	updateUser(user) {
		return new Promise((resolve, reject) => {
				this._updateDoc(Collections.user.name, {_id: user._id}, {
					$set: {
						isAdmin:  user.isAdmin,
						isActive: user.isActive
					}
				}).then(resolve).catch(reject);
			}
		);

	}

	/**
	 *
	 * @param {Object} user
	 */
	updateUserProfile(user) {
		return new Promise((resolve, reject) => {
				this._updateDoc(Collections.user.name, {_id: user._id}, {
					$set: {
						name:     user.name,
						nickname: user.nickname
					}
				}).then(resolve).catch(reject);
			}
		);
	}

	getUsers() {
		return this._findDocs(Collections.user.name, {})
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
