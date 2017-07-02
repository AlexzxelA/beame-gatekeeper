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

class NeDB {
	constructor(db_folder_path) {
		this._db_folder_path = db_folder_path;
		this._db             = {};

		//db.users         = new Datastore({filename: path.join(db_folder_path, 'users.db'), autoload: true});
		// db.services      = new Datastore({filename: path.join(db_folder_path, 'services.db'), autoload: true});
		// db.sessions      = new Datastore({filename: path.join(db_folder_path, 'sessions.db'), autoload: true});
		// db.registrations = new Datastore({filename: path.join(db_folder_path, 'registrations.db'), autoload: true});
		// db.gk_logins     = new Datastore({filename: path.join(db_folder_path, 'gk_logins.db'), autoload: true});

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

	_seedServices() {
		return new Promise((resolve, reject) => {

			}
		);
	}

	_loadCollections() {
		let $this = this;
		return new Promise((resolve, reject) => {
				this._loadCollection('users', [{fieldName: 'fqdn', unique: true}, {fieldName: 'isAdmin', unique: false}])
					.then(this._loadCollection.bind($this, 'sessions'))
					.then(this._loadCollection.bind($this, 'services', [{
						fieldName: 'url',
						unique:    true
					}, {fieldName: 'code', unique: true}]))
					.then(this._loadCollection.bind($this, 'registrations', [{fieldName: 'fqdn', unique: true}]))
					.then(this._loadCollection.bind($this, 'gk_logins', [{
						fieldName: 'fqdn',
						unique:    true
					}, {fieldName: 'serviceId', unique: true}]))
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
}

module.exports = NeDB;
