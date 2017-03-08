'use strict';

const fs   = require('fs');
const path = require('path');

const Constants         = require('../../constants');
const Bootstrapper      = require('../bootstrapper');
const bootstrapper      = Bootstrapper.getInstance();
const credentialManager = new (require('../credentialManager'))();
const serviceManager    = new (require('../servers/gw/serviceManager'))();
const utils             = require('../utils');

const beameSDK    = require('beame-sdk');
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger('CLI-server');

/** @type {DataServices} */
var dataService = null;

function getHelpMessage(fileName) {
	return fs.readFileSync(path.join(__dirname, '..', '..', 'help-messages', fileName), {'encoding': 'utf-8'});
}

function startDataService() {
	dataService = require('../dataServices').getInstance({session_timeout: bootstrapper.sessionRecordDeleteTimeout});
	return dataService.start();

}


function init(callback) {
	bootstrapper.initAll().then(() => callback()).catch(callback);
}
init.params = {};

function name(name, callback) {
	bootstrapper.setServiceName(name).then(() => callback()).catch(callback);
}
name.params = {'name': {required: true}};

function setAuthServer(fqdn, callback) {
	bootstrapper.registerCustomerAuthServer(fqdn).then(callback.bind()).catch(callback);
}
setAuthServer.params = {'fqdn': {required: true}};

function apps(callback) {
	bootstrapper.initAll()
		.then(startDataService)
		.then(serviceManager.evaluateAppList.bind(serviceManager))
		.then(() => serviceManager.listApplications({isAdmin: true}))
		.then(callback.bind(null, null));
}

module.exports = {
	init,
	name,
	setAuthServer,
	apps,
}

