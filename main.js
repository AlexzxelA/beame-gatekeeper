#!/usr/bin/env node
'use strict';


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
const bootstrapper      = new Bootstrapper();
const credentialManager = new (require('./src/credentialManager'))();


var commandHandled = false;

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

	bootstrapper.initAll().then(() => {

		credentialManager.createInitialCredentials(token).then(metadata=> {
			console.log('');
			console.log(`Certificate created! Certificate FQDN is ${metadata.fqdn}`);
			console.log('');
			console.log(getHelpMessage('certificate-created.txt'));
			console.log(`https://${metadata.fqdn}`);
			process.exit(0);
		}).catch(e => {
			logger.error(e);
			process.exit(1);
		});
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
	const ServersManager = require('./src/serversManager');

	function assertServersSettings(creds) {
		return new Promise((resolve, reject) => {
			if(!creds) {
				console.log(getHelpMessage('no-certificates.txt'));
				process.exit(1);
			}
			resolve(creds);
		});
	}

	bootstrapper.initAll()
		.then(getServersSettings)
		.then(assertServersSettings)
		.then(ServersManager.go);

	commandHandled = true;
}

if (!commandHandled) {
	console.error(`Unknown command: ${args._[0]}`);
	process.exit(1);
}

