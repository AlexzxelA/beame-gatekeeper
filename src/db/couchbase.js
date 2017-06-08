/**
 * Created by zenit1 on 15/11/2016.
 */

"use strict";

const beameSDK    = require('beame-sdk');
const module_name = "SqliteServices";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

class CouchbaseServices {
	/**
	 * @param {DataServicesSettings} options
	 */
	constructor(options) {
		this._options = options;
		logger.debug(`Couchbase services started`);
	}


	//region registration services
	getRegistrations() {

	}

	saveRegistration(data) {

	}

	deleteRegistration(id) {

	}

	markRegistrationAsCompleted(fqdn) {

	}

	updateRegistrationFqdn(hash, fqdn) {

	}

	//endregion
}

module.exports = CouchbaseServices;