'use strict';

// TODO: actual list + cached health status in "online" field
function listApplications(user) {
	let ret = {
		'Files sharing app': {
			app_id: 11,
			online: true
		},
		'Funny pictures album app': {
			app_id: 12,
			online: false
		},
		'Company calendar app': {
			app_id: 13,
			online: true
		},
		'Simple chat': {
			app_id: 14,
			online: true
		}
	};
	if(user.isAdmin) {
		ret['Insta server admin app'] = {
			app_id: 1,
			online: true
		};
	}
	return Promise.resolve(ret);
}

function appUrlById(app_id) {
	if (app_id == 11) {
		return Promise.resolve('http://127.0.0.1:65511');
	}
	if (app_id == 12) {
		return Promise.resolve('https://yahoo.com');
	}
	if (app_id == 13) {
		return Promise.resolve('https://www.timeanddate.com');
	}
	if (app_id == 14) {
		return Promise.resolve('http://127.0.0.1:65510');
	}
	return Promise.reject(`Unkonwn application APP_ID ${app_id}`);

}

module.exports = {
	listApplications,
	appUrlById
};
