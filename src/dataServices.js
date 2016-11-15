/**
 * Created by zenit1 on 15/11/2016.
 */
"use strict";



const beameSDK    = require('beame-sdk');
const module_name = "DataServices";
const BeameLogger = beameSDK.Logger;
const CommonUtils = beameSDK.CommonUtils;
const logger      = new BeameLogger(module_name);
const Bootstrapper      = require('./bootstrapper');
const bootstrapper      = new Bootstrapper();
const Constants   = require('../constants');
const DbProviders = Constants.DbProviders;

class DataServices {
	constructor() {
		this._dbProvider = bootstrapper.dbProvider;
		this._dbService = null;

		if(!this._dbProvider){
			logger.error(`Db Provider not defined`);
			return;
		}

		switch (this._dbProvider){
			case DbProviders.Sqlite:
				this._dbService = new(require('./db/sqlite'))();
				break;

			case DbProviders.Couchbase:
				this._dbService = new(require('./db/couchbase'))();
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

	markRegistrationAsCompleted(fqdn){
		return this._dbService.markRegistrationAsCompleted(fqdn);
	}

	updateRegistrationFqdn(hash, fqdn){
		return this._dbService.updateRegistrationFqdn(hash, fqdn);
	}
	//endregion
}


module.exports = DataServices;