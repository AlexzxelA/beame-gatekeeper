'use strict';

// TODO: actual list + cached health status in "online" field

const beameSDK           = require('beame-sdk');
const module_name        = "ServicesManager";
const BeameLogger        = beameSDK.Logger;
const logger             = new BeameLogger(module_name);
const CommonUtils        = beameSDK.CommonUtils;
const dataService        = new (require('../../dataServices'))();
const ADMIN_SERVICE_CODE = 'ADMIN';

const default_services = {
	1:  {
		app_id: 1,
		name:   'Insta server admin app',
		code:   ADMIN_SERVICE_CODE,
		url:    null,
		online: true
	},
	11: {
		name:   'Files sharing app',
		app_id: 11,
		code:   'SHARE',
		url:    'http://127.0.0.1:65511',
		online: true
	},
	12: {
		name:   'Funny pictures album app',
		app_id: 12,
		code:   'ALBUM',
		url:    'https://yahoo.com',
		online: false
	},
	13: {
		name:   'Company calendar app',
		app_id: 13,
		code:   'CALENDAR',
		url:    'https://www.timeanddate.com',
		online: true
	},
	14: {
		name:   'Simple chat',
		app_id: 14,
		code:   'CHAT',
		url:    'http://127.0.0.1:65510',
		online: true
	}
};


class ServicesManager {

	constructor() {
		this._appList = {};
	}

	listApplications(user) {

		return new Promise((resolve, reject) => {
				const returnList = () => {

					let approvedList = user.isAdmin ? this._appList : CommonUtils.filterHash(this._appList, (k, v) => v.code !== ADMIN_SERVICE_CODE);

					let formattedList = {};

					Object.keys(approvedList).forEach(key => {
						formattedList[approvedList[key].name] = {app_id: parseInt(key),online:approvedList[key].online};
					});

					resolve(formattedList);
				};

				if (!CommonUtils.isObjectEmpty(this._appList)) {
					returnList();
				}
				else {
					this.evaluateAppList().then(returnList).catch(reject);
				}

			}
		);
	}

	evaluateAppList() {

		return new Promise((resolve, reject) => {
				dataService.getServices().then(apps => {

					if (apps.length) {
						for (let app of apps) {
							this._appList[app.id] = {
								name:   app.name,
								app_id: app.id,
								code:   app.code,
								url:    app.url,
								online: app.isActive
							};
						}
					}
					else {
						this._appList = default_services;
					}

					resolve();

				}).catch(error => {
					logger.error(`Get active services error ${BeameLogger.formatError(error)}`);
					reject(error);
				})
			}
		);


	}

	isAdminService(app_id) {
		let app = this._appList[app_id];

		return app && app.code === ADMIN_SERVICE_CODE;
	}

	appUrlById(app_id) {
		let app = this._appList[app_id];

		return app ? Promise.resolve(app.url) : Promise.reject(`Unknown appId ${app_id}`);
	}

}

module.exports = ServicesManager;

