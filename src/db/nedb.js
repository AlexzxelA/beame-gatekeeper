/**
 * Created by zenit1 on 02/07/2017.
 */
"use strict";

const Datastore   = require('nedb');
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
			fieldName: 'url',
			unique:    true
		}, {fieldName: 'code', unique: true}]
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

class NeDB {
	constructor(db_folder_path) {
		this._db_folder_path = db_folder_path;
		this._db             = {};
	}

	start() {
		return new Promise((resolve, reject) => {
				this._loadCollections()
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

					this._upsertDocument(`services`, {services: srv}).then(() => {
						return Promise.resolve();
					}).catch(e => {
						return Promise.reject(e);
					});
				};

				return this.getServices().then(existing_services => {
					if (!existing_services.length) return _saveServices(services);

					for (let i = 0; i < services.length; i++) {
						if (existing_services.some(x => x.code == services[i].code)) continue;

						existing_services.push(services[i]);
					}

					return _saveServices(existing_services);
				});
			}
		);
	}

	//endregion

	//region collections
	_loadCollections() {
		let $this = this;
		return new Promise((resolve, reject) => {
				this._loadCollection(Collections.user.name, Collections.user.indices)
					.then(this._loadCollection.bind($this, Collections.sessions.name, Collections.sessions.indices))
					.then(this._loadCollection.bind($this, Collections.services.name, Collections.services.indices))
					.then(this._loadCollection.bind($this, Collections.registrations.name, Collections.registrations.indices))
					.then(this._loadCollection.bind($this, Collections.gk_logins.name, Collections.gk_logins.indices))
					.then(() => {
						logger.info(`All collections loaded`)
					})
					.catch(err => {
						reject(err);
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

					this._db[name] = new Datastore({filename: path.join(this._db_folder_path, `${name}.db`)});
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

	_findDoc() {
	}
}

module.exports = NeDB;
