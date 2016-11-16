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
		'Adult Chat': {
			id: 4,
			online: true
		}
	});
}

function appUrlById(id) {
	if (id == 1) {
		return Promise.resolve('https://en.wikipedia.org');
	}
	if (id == 2) {
		return Promise.resolve('https://www.google.com');
	}
	if (id == 3) {
		return Promise.resolve('https://www.timeanddate.com');
	}
	if (id == 4) {
		return Promise.resolve('https://www.freechatnow.com');
	}
	return Promise.reject(`Unkonwn application ID ${id}`);
	
}

module.exports = {
	listApplications,
	appUrlById
};
