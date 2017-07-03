'use strict';

// TODO: actual list + cached health status in "online" field

const beameSDK      = require('beame-sdk');
const module_name   = "ServiceManager";
const BeameLogger   = beameSDK.Logger;
const logger        = new BeameLogger(module_name);
const CommonUtils   = beameSDK.CommonUtils;
const SetupServices = require('../constants').SetupServices;
const utils         = require('./utils');
let serviceManager  = null;

class ServiceManager {

	constructor() {
		this._appList = {};

		if (!serviceManager) serviceManager = this;
	}

	get _activeApps(){
		return CommonUtils.filterHash(this._appList, (k, v) => v.active == true)
	}

	listApplications(user) {

		return new Promise((resolve, reject) => {
				const returnList = () => {

					let approvedList = user.isAdmin ? this._activeApps : CommonUtils.filterHash(this._activeApps, (k, v) => v.code !== SetupServices.Admin.code && v.code !== SetupServices.AdminInvitation.code);

					let formattedList = {};

					Object.keys(approvedList).forEach(key => {
						formattedList[approvedList[key].name] = {
							app_id:   parseInt(key),
							online:   approvedList[key].online,
							code:     approvedList[key].code,
							name:     approvedList[key].name,
							external: approvedList[key].external,
							mobile: approvedList[key].mobile
						};
					});
					logger.debug('app list:', formattedList);
					resolve(formattedList);
				};

				this.evaluateAppList().then(returnList).catch(reject);

			}
		);
	}

	updateAppUrl(code, url) {
		try {

			if (!url) return;

			let apps = utils.hashToArray(CommonUtils.filterHash(this._appList, (k, v) => v.code == code));

			if (apps.length == 1) {
				let app           = apps[0];
				const dataService = require('./dataServices').getInstance();
				dataService.updateServiceUrl(app.app_id, url);
			}
		} catch (e) {
		}
	}

	evaluateAppList() {

		return new Promise((resolve, reject) => {

				this._appList = {};

				const dataService = require('./dataServices').getInstance();

				dataService.getServices().then(apps => {

					if (apps.length) {
						for (let app of apps) {

							if (!app || !app.code) continue;

							this._appList[app.id || app._id] = {
								name:   app.name,
								app_id: app.id || app._id,
								code:   app.code,
								url:    app.url,
								online: app.isOnline,
								external: app.isExternal,
								mobile: app.isMobile,
								active:app.isActive
							};
						}

						resolve();
					}
					else {
						reject(`no services found`);
					}

				}).catch(error => {
					logger.error(`Get active services error ${BeameLogger.formatError(error)}`);
					reject(error);
				})
			}
		);
	}

	getAdminAppId() {

		return new Promise((resolve, reject) => {
				let adminApp = CommonUtils.filterHash(this._appList, (k, v) => v.code === SetupServices.Admin.code);

				let keys = Object.keys(adminApp);

				keys.length === 1 ? resolve(adminApp[keys[0]].app_id) : reject(`duplicate app found`);
			}
		);
	}

	getAppCodeById(app_id) {
		let app = this._appList[app_id];

		return app ? app.code : null;
	}

	getAppById(app_id) {
		return this._appList[app_id];
	}

	isAdminService(app_id) {
		let app = this._appList[app_id];

		return app && (app.code === SetupServices.Admin.code || app.code === SetupServices.AdminInvitation.code);
	}

	appUrlById(app_id) {
		logger.debug('got app request:', app_id);
		return new Promise((resolve, reject) => {
				let app = this._appList[app_id];

				app ? resolve(app.url) : reject(`Unknown appId ${app_id}`);
			}
		);
	}

	/** @type {ServiceManager} */
	static getInstance() {

		return serviceManager;
	}
}

module.exports = ServiceManager;

