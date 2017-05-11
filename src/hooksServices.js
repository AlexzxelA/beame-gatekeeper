/**
 * Created by zenit1 on 08/03/2017.
 */
"use strict";

let hookServiceInstance = null;

class HookServices {


	constructor() {
		this._dataService          = require('./dataServices').getInstance();

	}

	//region hooks manage

	getHooks() {
		return this._dataService.getHooks();
	}

	saveHook(hook) {

		return this._dataService.saveHook(hook);
	}

	updateHook(hook) {
		return this._dataService.updateHook(hook);
	}

	deleteHook(id) {
		return this._dataService.updateHook(id);
	}

	//endregion

	/** @type {CentralLoginServices} */
	static getInstance() {

		if (!hookServiceInstance) {
			hookServiceInstance = new HookServices();
		}

		return hookServiceInstance;

	}
}

module.exports = HookServices;