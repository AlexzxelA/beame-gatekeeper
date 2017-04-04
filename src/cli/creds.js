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
const logger      = new BeameLogger('CLI-creds');

function getHelpMessage(fileName) {
	return fs.readFileSync(path.join(__dirname, '..', '..', 'help-messages', fileName), {'encoding': 'utf-8'});
}

/** @type {DataServices} */
let dataService = null;

function startDataService() {
	dataService = require('../dataServices').getInstance({session_timeout: bootstrapper.sessionRecordDeleteTimeout});
	return dataService.start();

}

function getCreds(regToken, fqdn, callback) {

	if(!regToken && !fqdn){
		callback(`Registration token or fqdn required`);
		return;
	}

	let current_fqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.ZeroLevel);

	if (current_fqdn) {
		callback(`Zero level credential already registered on ${current_fqdn}`);
		return;
	}

	bootstrapper.initAll()
		.then(() => {
			credentialManager.createInitialCredentials(regToken, fqdn).then(metadata => {
				console.log('');
				console.log(`Certificate created! Certificate FQDN is ${metadata.fqdn}`);
				console.log('');
				console.log(getHelpMessage('certificate-created.txt'));
				let gw_fqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
				console.log(`https://${gw_fqdn}`);
				callback();
			}).catch(callback);
		}).catch(callback);
}

getCreds.params = { 'regToken': {required: false, base64: true, json: true}, 'fqdn': {required: false, base64: false, json: false} };

function list(regex, callback) {
	callback(null, beameSDK.creds.list(regex));
}
list.params = {'regex': {required: false}};
list.toText = beameSDK.creds.list.toText;

function createServersCredentials(callback) {
	credentialManager.createServersCredentials().then(callback.bind()).catch(callback);
}
createServersCredentials.params = {};

function webToken(type, appId, callback) {

	const gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);

	const createToken = () => {
		return new Promise((resolve) => {
			serviceManager.getAdminAppId().then(app_id => {

				logger.info(`Admin service found with app_id ${app_id}`);

				const tokenInfoByCommand = {
					'config': {allowConfigApp: true},
					'admin':  {app_id: app_id, isAdmin: true},
					'app':    {app_id: appId}
				};

				// TODO: move 600 to config
				const makeProxyEnablingToken = () => {
					return utils.createAuthTokenByFqdn(
						gwServerFqdn,
						JSON.stringify(tokenInfoByCommand[type]),
						600
					);
				};

				// TODO: move app switching URL to config
				makeProxyEnablingToken().then(proxyEnablingToken => {
					resolve(`https://${gwServerFqdn}/beame-gw/choose-app?proxy_enable=${encodeURIComponent(proxyEnablingToken)}`);
				});
			}).catch(callback);
		});
	};

	bootstrapper.initAll()
		.then(startDataService)
		.then(serviceManager.evaluateAppList.bind(serviceManager))
		.then(createToken)
		.then(callback.bind(null, null))
		.catch(callback);
}
webToken.params = {
	'type':  { required: true, options: ['config', 'admin', 'app'] },
	'appId': { required: false }
};
webToken.toText = (url) => {
	return "\n" +
	"--------------------------------------------------\n" +
	"Please use the URL below to configure/administer beame-gatekeeper\n" +
	`You can use this URL within 10 minutes. If you don't, you will need to get another URL (issue same CLI command)\n` +
	`Don't forget to run the server with 'beame-gatekeeper server start' command\n` +
	url + '\n'  +
	"--------------------------------------------------\n"
};

function admin(callback){
	return webToken('admin',null,callback);
}
admin.toText = (url) => {
	return "\n" +
		"--------------------------------------------------\n" +
		"Please use the URL below to configure/administer beame-gatekeeper\n" +
		`You can use this URL within 10 minutes. If you don't, you will need to get another URL (issue same CLI command)\n` +
		`Don't forget to run the server with 'beame-gatekeeper server start' command\n` +
		url + '\n'  +
		"--------------------------------------------------\n"
};

module.exports = {
	getCreds,
	list,
	createServersCredentials,
	webToken,
	admin
};
