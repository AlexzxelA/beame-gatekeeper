#!/usr/bin/env node
'use strict';

//process.env.BEAME_LOG_LEVEL = "DEBUG";

// Ensure correct NodeJS version - start
const process = require('process');
const semver  = require('semver');
const pjson   = require('./package.json');
if (!semver.satisfies(process.versions.node, pjson.engines.node)) {
	console.error(`Beame-insta-server requires NodeJS version ${pjson.engines.node}. Running with version ${process.versions.node}. Exiting.`);
	process.exit(2);
}
// Ensure correct NodeJS version - end


/**
 * Should be synchronized with token from Auth Server
 * @typedef {Object} EmailRegistrationData
 * @property {String} name
 * @property {String} email
 * @property {String} authToken
 * @property {String} authSrvFqdn
 * @property {Number} src
 */

const fs   = require('fs');
const path = require('path');

const args        = require('minimist')(process.argv.slice(2));
const beameSDK    = require('beame-sdk');
const module_name = "InstaServerMain";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const BeameStore = new beameSDK.BeameStore();

const Constants         = require('./constants');
const Bootstrapper      = require('./src/bootstrapper');
const bootstrapper      = Bootstrapper.getInstance();
const credentialManager = new (require('./src/credentialManager'))();
const utils             = require('./src/utils');

/** @type {DataServices} */
var dataService = null;

const serviceManager = new (require('./src/servers/gw/serviceManager'))();

var commandHandled = false;

function startDataService() {
	dataService = require('./src/dataServices').getInstance({session_timeout: bootstrapper.sessionRecordDeleteTimeout});
	return dataService.start();

}

function getHelpMessage(fileName) {
	return fs.readFileSync(path.join(__dirname, 'help-messages', fileName), {'encoding': 'utf-8'});
}

// There will be automatically imported certificates in the store.
// Filtering them out.
function list() {
	return BeameStore.list(null, {hasPrivateKey: true});
}

if (args._[0] == 'create') {

	let fqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.ZeroLevel);

	if (fqdn) {
		logger.info(`Zero level credential already registered on ${fqdn}`);
		process.exit(1);
	}

	/** @type {EmailRegistrationData} */
	let token = JSON.parse(new Buffer(args._[1], 'base64').toString());

	if (token.src != Constants.RegistrationSource.InstaServerSDK) {
		logger.info(`Invitation is fot another SDK`);
		process.exit(1);
	}

	bootstrapper.initAll()
		.then(() => {
			credentialManager.createInitialCredentials(token).then(metadata => {
				console.log('');
				console.log(`Certificate created! Certificate FQDN is ${metadata.fqdn}`);
				console.log('');
				console.log(getHelpMessage('certificate-created.txt'));
				console.log(`https://${metadata.fqdn}`);
				process.exit(0);
			}).catch(e => {
				logger.error(BeameLogger.formatError(e));
				process.exit(1);
			});
		}).catch(error => {
			logger.error(BeameLogger.formatError(error));
			process.exit(1);
		});


	commandHandled = true;

} else {

	var credsCount = list().length;

	if (!credsCount) {
		console.log(getHelpMessage('no-certificates.txt'));
		process.exit(1);
	}

	if (args._.length == 0) {
		console.log(getHelpMessage('no-command.txt'));
		process.exit(1);
	}
}

if (args._[0] == 'list') {
	// TODO: show admin(s) and special permissions
	// TODO later: show permitted applications per user
	// TODO later: show user aliases?
	list().forEach(cred => {
		console.log(cred.fqdn);
	});
	process.exit(0);
}

if (args._[0] == 'server' || args._[0] == 'serve') {

	const getServersSettings = bootstrapper.getServersSettings.bind(bootstrapper);
	const ServersManager     = require('./src/serversManager');

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
		.then(ServersManager.go.bind(null, serviceManager));

	commandHandled = true;
}

if (args._[0] == 'setAuthServer') {

	let fqdn = args['fqdn'];

	if (!fqdn) {
		logger.error(`fqdn required`);
		process.exit(1)
	}

	bootstrapper.registerCustomerAuthServer(fqdn).then(() => {
		process.exit(0);
	}).catch(error => {
		logger.error(BeameLogger.formatError(error));
		process.exit(1);
	});


	commandHandled = true;
}

if (args._[0] == 'initConfig') {
	bootstrapper.initAll().then(() => {
		process.exit(0);
	}).catch(error => {
		logger.error(BeameLogger.formatError(error));
		process.exit(1);
	});
	commandHandled = true;
}

if (args._[0] == 'setName') {

	let name = args['name'];

	if (!name) {
		logger.error(`name required`);
		process.exit(1)
	}

	bootstrapper.setServiceName(name).then(() => {
		logger.info(`Insta-server service name set to ${name} successfully`);
		process.exit(0);
	}).catch(error => {
		logger.error(BeameLogger.formatError(error));
		process.exit(1);
	});


	commandHandled = true;
}

if (args._[0] == 'config' || args._[0] == 'admin') {

	const gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);


	const createToken = () => {
		serviceManager.getAdminAppId().then(app_id => {

			logger.info(`Admin service found with app_id ${app_id}`);

			const tokenInfoByCommand = {
				'config': {allowConfigApp: true},
				'admin':  {app_id: app_id, isAdmin: true}
			};

			// TODO: move 600 to config
			const makeProxyEnablingToken = () => {
				return utils.createAuthTokenByFqdn(
					gwServerFqdn,
					JSON.stringify(tokenInfoByCommand[args._[0]]),
					600
				);
			};

			// TODO: move app switching URL to config
			makeProxyEnablingToken().then(proxyEnablingToken => {
				const url = `https://${gwServerFqdn}/beame-gw/choose-app?proxy_enable=${encodeURIComponent(proxyEnablingToken)}`;
				console.log("--------------------------------------------------");
				console.log("Please use the URL below to configure/admininister beame-insta-server");
				console.log(`You can use this URL within 10 minutes. If you don't, you will need to get another URL (issue same CLI command - ${args._[0]})`);
				console.log(`Don't forget to run the server with 'beame-insta-server serve' command`);
				console.log(url);
				console.log("--------------------------------------------------");
			});
		}).catch(error => {
			console.error(`${BeameLogger.formatError(error)}`);
			process.exit(1);
		});
	};

	bootstrapper.initAll()
		.then(startDataService)
		.then(serviceManager.evaluateAppList.bind(serviceManager))
		.then(createToken)
		.catch(error => {
			console.error(`${BeameLogger.formatError(error)}`);
			process.exit(1);
		});


	commandHandled = true;
}

if (args._[0] == 'createServersCreds') {

	credentialManager.createServersCredentials().then(() => {
		process.exit(0);
	}).catch(error => {
		logger.error(BeameLogger.formatError(error));
		process.exit(1);
	});


	commandHandled = true;
}

if (!commandHandled) {
	logger.error(`Unknown command: ${args._[0]}`);
	process.exit(1);
}

