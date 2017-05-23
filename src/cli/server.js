'use strict';

const fs   = require('fs');
const path = require('path');

const Bootstrapper   = require('../bootstrapper');
const bootstrapper   = Bootstrapper.getInstance();
const ServiceManager = require('../serviceManager');
const serviceManager = ServiceManager.getInstance();

const beameSDK    = require('beame-sdk');
const module_name = "ServerCLI";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const CommonUtils = beameSDK.CommonUtils;


/** @type {DataServices} */
let dataService = null;

function getHelpMessage(fileName) {
	return fs.readFileSync(path.join(__dirname, '..', '..', 'help-messages', fileName), {'encoding': 'utf-8'});
}

function startDataService() {
	dataService = require('../dataServices').getInstance({session_timeout: bootstrapper.sessionRecordDeleteTimeout});
	return dataService.start();

}

function start(callback) {

	CommonUtils.validateMachineClock().then(() => {
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
			.catch(callback);
	}).catch(error => {
		logger.fatal(error);
	})


}

start.params = {};


module.exports = {
	start
};
