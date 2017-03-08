/**
 * Created by zenit1 on 08/03/2017.
 */
"use strict";

let centralLoginServiceInstance = null;

class CentralLoginServices{

	constructor() {
		this._dataService          = require('./dataServices').getInstance();
	}

	//region Gatekeeper logins

	getGkLogins() {
		return this._dataService.getGkLogins();
	}

	getActiveGkLogins() {
		return this._dataService.getActiveGkLogins();
	}

	saveGkLogin(login) {
		return this._dataService.saveGkLogin(login);
	}

	updateGkLogin(login) {

		return this._dataService.updateGkLogin(login);
	}

	deleteGkLogin(id) {
		return this._dataService.deleteGkLogin(id);
	}

	//endregion

	/** @type {CentralLoginServices} */
	static getInstance() {

		if(!centralLoginServiceInstance){
			centralLoginServiceInstance = new CentralLoginServices();
		}

		return centralLoginServiceInstance;

	}
}

module.exports = CentralLoginServices;