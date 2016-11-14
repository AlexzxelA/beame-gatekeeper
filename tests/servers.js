/**
 * Created by zenit1 on 14/11/2016.
 */
"use strict";
const async =require('async');

const Bootstrapper = require('../src/bootstrapper');
const bootstrapper      = new Bootstrapper();

const Constants    = require('../constants');

const CustomerAuthServer = require('../src/servers/customer_auth/server');
const BeameAuthServer = require('../src/servers/beame_auth/server');


async.parallel([
	() =>{

		const getServersSettings = bootstrapper.getServersSettings.bind(bootstrapper);
		const ServersManager = require('../src/serversManager');

		const assertServersSettings = (settings) => {
			return new Promise((resolve, reject) => {
				if(!settings) {
					console.error('server settings error');
					process.exit(1);
				}
				resolve(settings);
			});
		};

		bootstrapper.initAll()
			.then(getServersSettings)
			.then(assertServersSettings)
			.then(ServersManager.go);
	},
	() => {
			let customer_auth_server = new CustomerAuthServer(Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer));

			customer_auth_server.start();

		},
	() => {
			let beame_auth_server = new BeameAuthServer(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer));

			beame_auth_server.start();


		}
	]);



