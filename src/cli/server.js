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
		const credentialManager  = new (require('../credentialManager'))();

		const assertServersSettings = (settings) => {
			return new Promise((resolve) => {
				if (!settings) {
					console.log(getHelpMessage('no-certificates.txt'));
					process.exit(1);
				}
				resolve(settings);
			});
		};

		const assertProxySettings = () => {

			return new Promise((resolve) => {
					let sett             = bootstrapper.proxySettings,
					    initGlobalTunnel = false,
					    port;
					if (sett.host && sett.port) {

						try {
							port             = parseInt(sett.port);
							initGlobalTunnel = true;
						} catch (e) {
						}
					}

					if (initGlobalTunnel) {
						const globalTunnel = require('global-tunnel-ng');

						globalTunnel.initialize({
							host: sett.host,
							port: port
						});
					}

					resolve();
				}
			);
		};

		bootstrapper.initAll()
			.then(assertProxySettings)
			.then(startDataService)
			.then(credentialManager.createServersCredentials.bind(credentialManager))
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

function config(callback) {


	bootstrapper.initConfig(false, false).then(() => {

		bootstrapper.setHtmlEnvMode();

		bootstrapper.setOcspCachePeriod();

		let validationResp = Bootstrapper.isConfigurationValid();

		if (!validationResp.valid) {

			logger.fatal(validationResp.message);
		}

		const Server = require('../servers/config/server');
		const server = new Server(serviceManager);

		server.start(callback);

	}).catch(error => {
		logger.fatal(error);
	});
}
config.params  = {};
config.toText  = x => `Config Server started on ${x.url}`;
module.exports = {
	start,
	config
};
