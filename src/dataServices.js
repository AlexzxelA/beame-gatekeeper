/**
 * Created by zenit1 on 15/11/2016.
 */
"use strict";

/**
 * @typedef {Object} DataServicesSettings
 * @property {Number} session_timeout
 */

const beameSDK    = require('beame-sdk');
const module_name = "DataServices";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const Bootstrapper      = require('./bootstrapper');
const bootstrapper      = new Bootstrapper();
const Constants   = require('../constants');
const DbProviders = Constants.DbProviders;

class DataServices {

	/**
	 * @param {DataServicesSettings} options
	 */
	constructor(options) {

		this._options = options || {};

		this._dbProvider = bootstrapper.dbProvider;
		this._dbService = null;

		if(!this._dbProvider){
			logger.error(`Db Provider not defined`);
			return;
		}

		switch (this._dbProvider){
			case DbProviders.Sqlite:
				this._dbService = new(require('./db/sqlite'))(this._options);
				break;

			case DbProviders.Couchbase:
				this._dbService = new(require('./db/couchbase'))(this._options);
				break;

			default:
				logger.error(`Unknown Db Provider ${this._dbProvider}`);
				return;
		}

	}

	//region registration services
	getRegistrations(){
		return this._dbService.getRegistrations();
	}

	/**
	 *
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	saveRegistration(data){
		return this._dbService.saveRegistration(data);
	}

	deleteRegistration(id){
		return this._dbService.deleteRegistration(id);
	}

	/**
	 * @param {String} fqdn
	 * @returns {Promise.<Registration>}
	 */
	markRegistrationAsCompleted(fqdn){
		return this._dbService.markRegistrationAsCompleted(fqdn);
	}

	/**
	 * @param id
	 * @param {SignatureToken|String} sign
	 */
	updateRegistrationHash(id, sign){
		return this._dbService.updateRegistrationHash(id, sign);
	}

	/**
	 * @param {String} hash
	 * @param {String} fqdn
	 * @returns {*}
	 */
	updateRegistrationFqdn(hash, fqdn){
		return this._dbService.updateRegistrationFqdn(hash, fqdn);
	}

	/**
	 * @param {String} hash
	 * @returns {Promise}
	 */
	findRegistrationRecordByHash(hash){
		return this._dbService.findRegistrationRecordByHash(hash);
	}
	//endregion

	//region sessions
	/**
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	saveSession(data){
		return this._dbService.saveSession(data);
	}

	/**
	 * @param {String} pin
	 * @returns {Promise}
	 */
	deleteSession(pin){
		return this._dbService.deleteSessionByPin(pin);
	}
	//endregion

	//region user
	/**
	 * @param {User} user
	 */
	saveUser(user){
		return this._dbService.saveUser(user);
	}

	/**
	 * @param fqdn
	 * @returns {Promise.<User>}
	 */
	findUser(fqdn){
		return this._dbService.findUser(fqdn);
	}
	//endregion
}


module.exports = DataServices;