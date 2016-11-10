#!/usr/bin/env node
'use strict';

/**
 * @typedef {Object} RegistrationToken
 * Should be synchronized with token from Auth Server
 * @property {String} authToken
 * @property {String} authSrvFqdn
 * @property {String} name
 * @property {String} email
 */


const fs   = require('fs');
const path = require('path');

const args  = require('minimist')(process.argv.slice(2));
const beameSDK = require('beame-sdk');
const module_name = "InstaServerMain";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const BeameStore = new beameSDK.BeameStore();
const Credential = beameSDK.Credential;

const Bootstrapper = require('./src/bootstrapper');

var commandHandled = false;

function getHelpMessage(fileName) {
	return fs.readFileSync(path.join(__dirname, 'help-messages', fileName), {'encoding': 'utf-8'});
}

// There will be automatically imported certificates in the store.
// Filtering them out.
function list() {
	return BeameStore.list(null, {hasPrivateKey: true});
}

function selectCert() {
	if (args.fqdn) {
		const ret = BeameStore.find(args.fqdn);
		ret.catch(e => console.error(`Certificate for FQDN ${args.fqdn} not found: ${e}`));
		return ret;
	}

	return new Promise((resolve, reject) => {
		let allCerts = list();
		if (allCerts.length == 1) {
			resolve(allCerts[0]);
			return;
		}
		console.log("server requires --fqdn parameter because you have more than one certificate");
		console.log("Possible FQDNs are:");
		allCerts.forEach(cred => {
			console.log(`  ${cred.fqdn}`);
		});
		reject('server requires --fqdn parameter because you have more than one certificate');
		return;
	});
}

function ensureCertHasPrivateKey(cert) {
	return new Promise((resolve, reject) => {
		if(cert.hasKey('PRIVATE_KEY')) {
			resolve(cert);
			return;
		}
		reject(`Certificate for FQDN ${cert.fqdn} does not have private key, can't run a server with it.`);
	});
}


if (args._[0] == 'create') {
	/** @type {RegistrationToken} */
	let token = JSON.parse(new Buffer(args._[1], 'base64').toString());
	let cred  = new Credential(BeameStore);

	commandHandled = true;

	cred.createEntityWithAuthServer(token.authToken, token.authSrvFqdn, token.name, token.email).then(metadata=> {
		console.log('');
		console.log(`Certificate created! Certificate FQDN is ${metadata.fqdn}`);
		console.log('');
		console.log(getHelpMessage('certificate-created.txt'));
		console.log(`https://${metadata.fqdn}`);
		process.exit(0);
	}).catch(e => {
		console.log('ERROR', e);
		process.exit(1);
	});

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

	let creds = Bootstrapper.getCredsSettings();

	const server = require('./server.js');
	selectCert()
		.then(ensureCertHasPrivateKey)
		.then(server.runServer)
		.catch(e => {
			console.error(`Error: ${e}`);
			if(e.stack) {
				console.error(`Stack: ${e.stack}`);
			}
			process.exit(1);
		});
	commandHandled = true;
}

if (!commandHandled) {
	console.error(`Unknown command: ${args._[0]}`);
	process.exit(1);
}

