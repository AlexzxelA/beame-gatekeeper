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

		const _assertServersSettings = (settings) => {
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
			.then(credentialManager.createServersCredentials.bind(credentialManager))
			.then(serviceManager.evaluateAppList.bind(serviceManager))
			.then(getServersSettings)
			.then(_assertServersSettings)
			.then(ServersManager.go.bind(null, serviceManager))
			.catch(callback);
	}).catch(error => {
		logger.fatal(error);
	})


}

start.params = {};

function config(proxy, callback) {


	const _assertConfiguration = () => {
		bootstrapper.setHtmlEnvMode();

		bootstrapper.setOcspCachePeriod();

		let validationResp = Bootstrapper.isConfigurationValid();

		if (!validationResp.valid) {

			logger.fatal(validationResp.message);
		}

		return Promise.resolve();
	};

	const _assertProxy = () => {

		return new Promise((resolve, reject) => {
				if (proxy) {

					let parts = proxy.split(':');

					if (parts.length === 2) {

						let proxySettings = bootstrapper.proxySettings;

						if((proxySettings.host && proxySettings.host != parts[0]) && (proxySettings.port && proxySettings.port != parts[1])){
							reject(`proxy settings already defined on ${proxySettings.host}:${proxySettings.port}`);
							return;
						}

						proxySettings.host = parts[0];
						proxySettings.port = parts[1];

						bootstrapper.setProxySettings = proxySettings;

						bootstrapper.assertProxySettings();

						resolve();
					}
					else {
						reject(`proxy should be in format host:port instead ${proxy}`);
					}
				}
				else{
					resolve()
				}
			}
		);

	};

	bootstrapper.initAll(false, false)
		.then(startDataService)
		.then(_assertConfiguration)
		.then(_assertProxy)
		.then(() => {


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
