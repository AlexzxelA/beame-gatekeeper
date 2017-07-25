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

const inc_id_field_name = '__autoid__';
const Collections       = {
	users:         {
		name:    'users',
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
	roles:         {
		name:    'roles',
		indices: [{fieldName: 'id', unique: true}]
	}
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
					{_id: inc_id_field_name},
					{$inc: {value: 1}},
					{upsert: true, returnUpdatedDocs: true}
				).then(doc => {
					resolve(doc.value);
				}).catch(reject);

			}
		);
	}

	static _formatBoolean(prop){
		return prop == 'true';
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
						this._loadCollection(Collections.users.name, Collections.users.indices)
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
						this._loadCollection(Collections.roles.name, Collections.roles.indices)
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
						this._db[name].insert({_id: inc_id_field_name, value: 0});
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

	_findDocs(collection, query = {}, sort = {}) {
		return new Promise((resolve, reject) => {
				query._id = {$ne: inc_id_field_name};
				this._db[collection].find(query).sort(sort).exec((err, docs) => {
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
								logger.info(`Doc ${JSON.stringify(doc)} inserted into ${collection}`);
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
				if (CommonUtils.isObjectEmpty(query)) {
					query = {_id: {$ne: inc_id_field_name}}
				}
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
					if (err) {
						reject(err || `Unexpected error`)
					} else {
						logger.info(`${numRemoved} records removed from ${collection}`);
						this._db[collection].persistence.compactDatafile();
						resolve()
					}
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
					logger.error(`Fetch registrations error ${BeameLogger.formatError(e)}`);
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
						if (doc && doc.completed) {
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
								userDataReceived: false,
								hashValidTill:    null
							}).then(resolve)
								.catch(reject)
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
	 * @returns {Promise.<Object|null>}
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
		return this._removeDoc(Collections.registrations.name, {id: id});

	}

	/**
	 * @param {String} fqdn
	 * @returns {Promise.<Object>}
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

					this._findDoc(Collections.registrations.name, {id: id}).then(doc => {
						if (!doc) {
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

						this._updateDoc(Collections.registrations.name, {_id: doc._id}, {
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
				this._findDoc(Collections.registrations.name, {id: id}).then(doc => {
					if (!doc) {
						reject(logger.formatErrorMessage(`Registration record not found`));
						return;
					}

					this._updateDoc(Collections.registrations.name, {_id: doc._id}, {
						$set: {pin: pin}
					}).then(resolve).catch(onError.bind(this, reject));

				}).catch(onError.bind(this, reject));
			}
		);
	}

	updateRegistrationCertFlag(id) {
		return new Promise((resolve, reject) => {
				this._findDoc(Collections.registrations.name, {id: id}).then(doc => {
					if (!doc) {
						reject(logger.formatErrorMessage(`Registration record not found`));
						return;
					}

					this._updateDoc(Collections.registrations.name, {_id: doc._id}, {
						$set: {certReceived: true}
					}).then(resolve).catch(onError.bind(this, reject));

				}).catch(onError.bind(this, reject));
			}
		);
	}

	updateRegistrationUserDataFlag(id) {
		return new Promise((resolve, reject) => {

				this._findDoc(Collections.registrations.name, {id: id}).then(doc => {
					if (!doc) {
						reject(logger.formatErrorMessage(`Registration record not found`));
						return;
					}

					this._updateDoc(Collections.registrations.name, {_id: doc._id}, {
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
		return this._findDoc(Collections.registrations.name, {
			hash: hash
		});
	}

	findRegistrationRecordByFqdn(fqdn) {
		return this._findDoc(Collections.registrations.name, {fqdn: fqdn});
	}

	//endregion

	//region session
	deleteSessionById(id) {
		return this._removeDoc(Collections.sessions.name, {id: id});
	}

	/**
	 *
	 * @param {String} pin
	 * @returns {Promise}
	 */
	deleteSessionByPin(pin) {
		return this._removeDoc(Collections.sessions.name, {pin: pin}, {multi: true})
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
		);
	}

	//endregion

	//region user
	/**
	 * @param {Object} user
	 */
	saveUser(user) {
		return new Promise((resolve, reject) => {
				this.findUser(user.fqdn).then(record => {
					if (record) {
						reject(`User with FQDN ${user.fqdn} already exists`);
						return;
					}
					user.isDeleted      = false;
					user.isActive       = true;
					user.lastActiveDate = new Date();
					user.nickname       = null;
					this._insertDoc(Collections.users.name, user).then(resolve).catch(onError.bind(this, reject));

				}).catch(reject);
			}
		);
	}

	/**
	 * @param fqdn
	 * @returns {Promise.<User>}
	 */
	findUser(fqdn) {
		return this._findDoc(Collections.users.name, {fqdn: fqdn});
	}

	/**
	 * Search users by predicated query
	 * @param {Object} predicate
	 */
	searchUsers(predicate) {
		return this._findDocs(Collections.users.name, predicate);
	}

	/**
	 * Update login info , like LastActiveDate
	 * @param fqdn
	 */
	updateLoginInfo(fqdn) {
		return this._updateDoc(Collections.users.name, {fqdn: fqdn}, {$set: {lastActiveDate: new Date()}});
	}

	/**
	 * @param {String} fqdn
	 * @param {Boolean} isActive
	 */
	updateUserActiveStatus(fqdn, isActive) {
		return this._updateDoc(Collections.users.name, {fqdn: fqdn}, {$set: {lisActive: isActive}});
	}

	/**
	 * @param {String} fqdn
	 */
	markUserAsDeleted(fqdn) {
		return this._updateDoc(Collections.users.name, {fqdn: fqdn}, {
			$set: {
				isDeleted: true,
				isActive:  false
			}
		});

	}

	/**
	 *
	 * @param {Object} user
	 */
	updateUser(user) {
		return this._updateDoc(Collections.users.name, {_id: user._id}, {
			$set: {
				isAdmin:  NeDB._formatBoolean(user.isAdmin),
				isActive:  NeDB._formatBoolean(user.isActive)
			}
		});
	}

	/**
	 *
	 * @param {Object} user
	 */
	updateUserProfile(user) {
		return this._updateDoc(Collections.users.name, {_id: user._id}, {
			$set: {
				name:     user.name,
				nickname: user.nickname
			}
		});
	}

	getUsers() {
		return this._findDocs(Collections.users.name, {}, {id: -1})
	}

	//endregion

	//region services
	getServices() {
		return this._findDocs(Collections.services.name, {}, {id: 1})
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
					service = NeDB._formatService(service);
					this._insertDoc(Collections.services.name, service).then(doc => {
						resolve(doc);
					}).catch(onError.bind(this, reject));
				}).catch(reject);

			}
		);
	}

	static _formatService(service) {
		service.isActive   = NeDB._formatBoolean(service.isActive);
		service.isMobile   = NeDB._formatBoolean(service.isMobile);
		service.isExternal = NeDB._formatBoolean(service.isExternal);

		return service;
	}

	updateService(service) {
		return new Promise((resolve, reject) => {

				let $this = this;

				const _update = () => {
					service    = NeDB._formatService(service);
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

				let query = service.url && service.url.length ? {
					_id:  {$ne: service._id},
					$and: [{$or: [{code: service.code}, {url: service.url}]}]
				} : {_id: {$ne: service._id}, code: service.code};

				this._validateService(query).then(_update.bind($this)).catch(reject);

			}
		);
	}

	updateServiceUrl(id, url) {
		return new Promise((resolve, reject) => {

				let $this = this;

				const _update = () => {
					let update = {
						$set: {
							url:       url,
							updatedAt: new Date()
						}
					};

					this._updateDoc(Collections.services.name, {id: id}, update, {upsert: false}).then(resolve).catch(reject);
				};

				let query = {id: {$ne: id}, url: url};

				this._validateService(query).then(_update.bind($this)).catch(reject);

			}
		);
	}

	deleteService(id) {
		return this._removeDoc(Collections.services.name, {id: id});
	}

	//endregion

	// region roles
	getRoles() {
		return this._findDocs(Collections.roles.name, {}, {id: 1})
	}

	_validateRole(query) {
		return new Promise((resolve, reject) => {
				try {

					this._findDoc(Collections.roles.name, query).then(record => {
						record ? reject(`Role name should be unique`) : resolve();
					}).catch(reject)
				} catch (e) {
					reject(e);
				}
			}
		);
	}

	saveRole(role) {
		return new Promise((resolve, reject) => {

				let query = {
					name: role.name
				};

				this._validateRole(query).then(() => {

					this._insertDoc(Collections.roles.name, role).then(doc => {
						resolve(doc);
					}).catch(onError.bind(this, reject));
				}).catch(reject);

			}
		);
	}

	updateRole(role) {
		return new Promise((resolve, reject) => {

				let $this = this;

				const _update = () => {
					let update = {
						$set: {
							name: role.name

						}
					};

					this._updateDoc(Collections.roles.name, {_id: role._id}, update).then(resolve).catch(reject);
				};

				let query = {_id: {$ne: role._id}, name: role.name};

				this._validateRole(query).then(_update.bind($this)).catch(reject);

			}
		);
	}

	deleteRole(id) {
		return this._removeDoc(Collections.roles.name, {id: id});
	}

	//endregion

	//region gkLogins
	getGkLogins() {
		return this._findDocs(Collections.gk_logins.name, {}, {id: -1})
	}

	getActiveGkLogins() {
		return this._findDocs(Collections.gk_logins.name, {isActive: true});
	}

	getOnlineGkLogins() {
		return this._findDocs(Collections.gk_logins.name, {isActive: true, isOnline: true});
	}

	setAllGkLoginOffline() {
		return this._updateDoc(Collections.gk_logins.name, {}, {isOnline: false}, {multi: true});
	}

	findLogin(fqdn) {
		return this._findDoc(Collections.gk_logins.name, {fqdn: fqdn});
	}

	saveGkLogin(login) {
		login.isActive = true;
		login.isOnline = false;

		return this._insertDoc(Collections.gk_logins.name, login);

	}

	updateGkLogin(login) {
		return new Promise((resolve, reject) => {
				let query = {_id: login._id};
				this._findDoc(Collections.gk_logins.name, query).then(doc => {
					if (!doc) {
						reject(logger.formatErrorMessage(`Gk Login record not found`));
						return;
					}
					let update = {
						$set: {
							name:      login.name,
							serviceId: login.serviceId,
							isActive:  NeDB._formatBoolean(login.isActive),
							isOnLine:  NeDB._formatBoolean(login.isOnline)
						}
					};

					this._updateDoc(Collections.gk_logins.name, query, update)
						.then(resolve)
						.catch(reject)

				}).catch(onError.bind(this, reject));
			}
		);
	}

	updateGkLoginState(fqdn, serviceId, isOnline) {
		return new Promise((resolve, reject) => {

				this._findDoc(Collections.gk_logins.name, {
					fqdn: fqdn
				}).then(doc => {
					if (!doc) {
						reject(logger.formatErrorMessage(`Gk Login record not found`));
						return;
					}
					let update = {
						$set: {
							serviceId: serviceId,
							isOnline:  isOnline
						}
					};

					this._updateDoc(Collections.gk_logins.name, {_id: doc._id}, update)
						.then(resolve)
						.catch(reject)

				}).catch(onError.bind(this, reject));
			}
		);

	}

	deleteGkLogin(id) {
		return this._removeDoc(Collections.gk_logins.name, {id: id});
	}

	//endregion
}

module.exports = NeDB;
