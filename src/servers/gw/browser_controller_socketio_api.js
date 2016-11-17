'use strict';

const socket_io         = require('socket.io');
const Bootstrapper      = require('../../bootstrapper');
const Constants         = require('../../../constants');
const beameSDK          = require('beame-sdk');
const CommonUtils      = beameSDK.CommonUtils;
const BeameStore        = new beameSDK.BeameStore();
const AuthToken         = beameSDK.AuthToken;
const BeameAuthServices = require('../beame_auth/authServices');
const utils             = require('../../utils');
const gwServerFqdn      = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
const apps = require('./apps');

var authServices        = null;


function assertSignedByGw(session_token) {
	let signedBy = JSON.parse(session_token).signedBy;
	if (signedBy == gwServerFqdn) {
		return Promise.resolve(session_token);
	} else {
		return Promise.reject(`messageHandlers/choose session_token must be signed by ${gwServerFqdn}, not ${signedBy}`);
	}
}

// TODO: Session renewal?
const messageHandlers = {
	'auth':   function (payload, reply) {
		// TODO: validate token and check it belongs to one of the registered users
		// TODO: return apps list + session token
		// --- request ---
		// type: auth
		// payload: token
		// --- response ---
		// type: 'authenticated'
		// payload: {success: true/false, session_token: ..., error: 'some str', apps: [{'App Name': {id: ..., online: true/false}}, ...]}
		console.log('messageHandlers/auth');

		function assertTokenFqdnIsAuthorized(token) {
			return BeameAuthServices.validateUser(token.signedBy);
		}

		function createSessionToken(apps) {
			return new Promise((resolve, reject) => {
				utils.createAuthTokenByFqdn(gwServerFqdn, 'Does not matter', 86400)
					.then(token => resolve([apps, token]))
					.catch(e => reject(e));
			});
		}

		function respond([apps, token]) {
			return new Promise((resolve, reject) => {
				console.log('messageHandlers/auth/respond token', token);
				reply({
					type:    'authenticated',
					payload: {
						success:       true,
						session_token: token,
						apps:          apps
					}
				});
			});
		}

		AuthToken.validate(payload.token)
			.then(assertTokenFqdnIsAuthorized)
			.then(apps.listApplications)
			.then(createSessionToken)
			.then(respond)
			.catch(e => {
				reply({
					type:    'authenticated',
					payload: {
						success: false,
						error:   e.toString()
					}
				});
			});

	},
	'choose': function (payload, reply) {
		// Choose application - redirect app switchig URL on GW, auth token in URL
		// --- request ---
		// type: choose
		// payload: {session_token: ..., id: ...}
		// --- response ---
		// type: 'redirect'
		// payload: {success: true/false, id: (same as in request), url: ...}

		function makeProxyEnablingToken() {
			return utils.createAuthTokenByFqdn(
				gwServerFqdn,
				JSON.stringify({app_id: payload.id}),
				86400
			);
		}

		function respond(token) {
			return new Promise((resolve, reject) => {
				const url = `https://${gwServerFqdn}/beame-gw/choose-app?proxy_enable=${encodeURIComponent(token)}`;
				console.log('respond() URL', url);
				reply({
					type:    'redirect',
					payload: {
						success: true,
						id: payload.id,
						url: url
					}
				});
			});
		}

		assertSignedByGw(payload.session_token)
			.then(AuthToken.validate)
			.then(makeProxyEnablingToken)
			.then(respond)
			.catch(e => {
				console.log('choose error', e);
			});

	},
	'logout': function (payload, reply) {
		// Redirect to cookie removing URL on GW
		// type: logout
		// payload: {session_token: ...}
		// --- response ---
		// type: 'redirect'
		// payload: {success: true/false, logout:true, url: ...}

		function makeLogoutToken() {
			return utils.createAuthTokenByFqdn(
				gwServerFqdn,
				JSON.stringify('Does not matter'),
				60
			);
		}

		function respond(token) {
			return new Promise((resolve, reject) => {
				const url = `https://${gwServerFqdn}/beame-gw/logout?token=${encodeURIComponent(token)}`;
				console.log('respond() URL', url);
				reply({
					type:    'redirect',
					payload: {
						success: true,
						logout:  true,
						url:     url
					}
				});
			});
		}

		assertSignedByGw(payload.session_token)
			.then(AuthToken.validate)
			.then(makeLogoutToken)
			.then(respond);
	}
};

function sendError(client, error) {
	// --- request ---
	// some kind of invalid request
	// --- response ---
	// type: 'error'
	// payload: error message
	client.emit('data', JSON.stringify({type: 'error', payload: error}));
}


class BrowserControllerSocketioApi {
	constructor(fqdn) {
		this._fqdn   = fqdn;
		authServices = new BeameAuthServices(this._fqdn);
		/** @type {Socket} */
		this._socket_server = null;
	}

	start(server) {
		return new Promise((resolve, reject) => {
				try {
					this._socket_server = socket_io(server, {path: `${Constants.GatewayControllerPath}/socket.io`});
					this._socket_server.on('connection', this._onConnection);
					resolve(this._socket_server);
				} catch (e) {
					reject(e);
				}
			}
		);

	}

	stop() {
		if (this._socket_server) {
			this._socket_server.close();
			this._socket_server = null;
		}
	}

	_onConnection(client) {
		// Browser controller will connect here
		console.log('[GW] handleSocketIoConnect');

		function reply(data) {
			client.emit('data', JSON.stringify(data));
		}

		client.on('data', data => {
			try {
				data = JSON.parse(data);
			} catch (e) {
				// nothing
			}
			if (!data || !data.type || !data.payload) {
				return sendError(client, 'Data must have "type" and "payload" fields');
			}
			if (!messageHandlers[data.type]) {
				return sendError(client, `Don't know how to handle message of type ${data.type}`);
			}
			messageHandlers[data.type](data.payload, reply);
		});
	}
}


module.exports = BrowserControllerSocketioApi;
