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

function start(callback) {
	const getServersSettings = bootstrapper.getServersSettings.bind(bootstrapper);
	const ServersManager     = require('../serversManager');

	const assertServersSettings = (settings) => {
		return new Promise((resolve) => {
			if (!settings) {
				console.log(getHelpMessage('no-certificates.txt'));
				process.exit(1);
			}
			resolve(settings);
		});
	};

	bootstrapper.initAll()
		.then(startDataService)
		.then(serviceManager.evaluateAppList.bind(serviceManager))
		.then(getServersSettings)
		.then(assertServersSettings)
		.then(ServersManager.go.bind(null, serviceManager))
		.catch(error=> {
			logger.fatal(`Start severs error ${BeameLogger.formatError(error)}`);
		});
}

start.params = {};

const list = beameSDK.creds.list;

module.exports = {
	start,
}
