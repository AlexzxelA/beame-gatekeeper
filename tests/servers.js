/**
 * Created by zenit1 on 14/11/2016.
 */
const async =require('async');

const Bootstrapper = require('../src/bootstrapper');
const Constants    = require('../constants');

const CustomerAuthServer = require('../src/servers/customer_auth/server');
const BeameAuthServer = require('../src/servers/beame_auth/server');


async.parallel([
	() => {
			let customer_auth_server = new CustomerAuthServer(Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer));

			customer_auth_server.start();

		},
	() => {
			let beame_auth_server = new BeameAuthServer(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer));

			beame_auth_server.start();


		}
	]);



