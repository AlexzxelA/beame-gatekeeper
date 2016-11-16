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
		return Promise.resolve('https://en.wikipedia.org/wiki/Computer_file');
	}
	if (id == 2) {
		return Promise.resolve('https://www.google.com/search?q=funny+pictures');
	}
	if (id == 3) {
		return Promise.resolve('https://www.timeanddate.com/calendar/');
	}
	if (id == 4) {
		return Promise.resolve('https://www.freechatnow.com/chat/adult');
	}
	return Promise.reject(`Unkonwn application ID ${id}`);
	
}

module.exports = {
	listApplications,
	appUrlById
};
