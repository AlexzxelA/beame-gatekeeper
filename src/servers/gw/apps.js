'use strict';

// TODO: actual list + cached health status in "online" field
function listApplications() {
	return Promise.resolve({
		'Files sharing app': {
			id: 1,
			online: true
		},
		'Funny pictures album app': {
			id: 2,
			online: false
		},
		'Company calendar app': {
			id: 3,
			online: true
		},
		'Simple chat': {
			id: 4,
			online: true
		}
	});
}

function appUrlById(id) {
	if (id == 1) {
		return Promise.resolve('http://127.0.0.1:65511');
	}
	if (id == 2) {
		return Promise.resolve('https://www.google.com');
	}
	if (id == 3) {
		return Promise.resolve('https://www.timeanddate.com');
	}
	if (id == 4) {
		return Promise.resolve('http://127.0.0.1:65510');
	}
	return Promise.reject(`Unkonwn application ID ${id}`);
	
}

module.exports = {
	listApplications,
	appUrlById
};
