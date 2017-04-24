#!/usr/bin/env node
'use strict';

//process.env.BEAME_LOG_LEVEL = "DEBUG";

// Ensure correct NodeJS version - start
const process = require('process');
const semver  = require('semver');
const pjson   = require('./package.json');
if (!semver.satisfies(process.versions.node, pjson.engines.node)) {
	console.error(`Beame-gatekeeper requires NodeJS version ${pjson.engines.node}. Running with version ${process.versions.node}. Exiting.`);
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

const beameSDK    = require('beame-sdk');
const BeameStore = new beameSDK.BeameStore();

const serviceManager = new (require('./src/servers/gw/serviceManager'))();

function getHelpMessage(fileName) {
	return fs.readFileSync(path.join(__dirname, 'help-messages', fileName), {'encoding': 'utf-8'});
}

// There will be automatically imported certificates in the store.
// Filtering them out.
function list() {
	return BeameStore.list(null, {hasPrivateKey: true});
}

const parametersSchema = {
	'format': {required: false, options: ['text', 'json'], default: 'text'},
};

const BeameCli = require('beame-cli');
const cli = new BeameCli('beame-gatekeeper', path.join(__dirname, 'src', 'cli'), [
	'creds',
	'config',
	'server',
]);

cli.setGlobalSchema(parametersSchema);

cli.approveCommand = (cmdName, subCmdName) => {
	if((cmdName == 'creds') && (subCmdName == 'getCreds')) {
		return true;
	}
	let credsCount = list().length;

	if (!credsCount) {
		console.log(getHelpMessage('no-certificates.txt'));
		return false;
	}
	return true;
};

cli.usage = () => {
	console.log(getHelpMessage('no-command.txt'));
};

cli.run();
