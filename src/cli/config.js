'use strict';

const Bootstrapper      = require('../bootstrapper');
const bootstrapper      = Bootstrapper.getInstance();
const serviceManager    = new (require('../servers/gw/serviceManager'))();

/** @type {DataServices} */
let dataService = null;


function startDataService() {
	dataService = require('../dataServices').getInstance({session_timeout: bootstrapper.sessionRecordDeleteTimeout});
	return dataService.start();
}

function init(callback) {
	bootstrapper.initAll().then(() => callback()).catch(callback);
}
init.params = {};

function setName(name, callback) {
	bootstrapper.setServiceName(name).then(() => callback()).catch(callback);
}
setName.params = {'name': {required: true}};

function registerAuthServer(fqdn, callback) {
	bootstrapper.registerCustomerAuthServer(fqdn).then(callback.bind()).catch(callback);
}
registerAuthServer.params = {'fqdn': {required: true}};

function apps(callback) {
	bootstrapper.initAll()
		.then(startDataService)
		.then(serviceManager.evaluateAppList.bind(serviceManager))
		.then(() => serviceManager.listApplications({isAdmin: true}))
		.then(callback.bind(null, null));
}

module.exports = {
	init,
	setName,
	registerAuthServer,
	apps,
};

