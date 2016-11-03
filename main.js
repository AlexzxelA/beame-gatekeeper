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
const beame = require('beame-sdk');

const BeameStore = new beame.BeameStore();
const Credential = beame.Credential;

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
