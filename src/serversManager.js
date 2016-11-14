/**
 * Created by zenit1 on 10/11/2016.
 */
"use strict";

const beameSDK    = require('beame-sdk');
const module_name = "ServersManager";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const CommonUtils = beameSDK.CommonUtils;

const async = require('async');

const Bootstrapper = require('../src/bootstrapper');
const bootstrapper = new Bootstrapper();
const Constants    = require('../constants');

class ServersManager {
	constructor(serversSettings) {

		if (CommonUtils.isObjectEmpty(serversSettings)) {
			logger.error(`Creds settings required`);
			process.exit(1);
		}

		this._settings = serversSettings;
	}

	start() {


		async.parallel([
				() => {

					return new Promise((resolve, reject) => {
						logger.info('Starting services');
						const node_command = process.env.BEAME_NODE_COMMAND || 'node';
						console.log('SETTINGS', this._settings);
						const gws = require('./servers/gw/gateway');
						gws.runServer(this._settings.GatewayServer.fqdn);
					});
				},
				() => {
					const CustomerAuthServer = require('../src/servers/customer_auth/server');

					let customer_auth_server = new CustomerAuthServer(Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer));

					customer_auth_server.start();

				},
				() => {

					const BeameAuthServer = require('../src/servers/beame_auth/server');

					let beame_auth_server = new BeameAuthServer(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer));

					beame_auth_server.start();


				}
			],
			error => {
				if (error) {

				}
			});

	}

	static go(serversSettings) {
		return (new ServersManager(serversSettings)).start();
	}
}


module.exports = ServersManager;
