'use strict';

const socket_io   = require('socket.io');
const Bootstrapper = require('../../bootstrapper');
const Constants    = require('../../../constants');
const beameSDK     = require('beame-sdk');
const BeameStore   = new beameSDK.BeameStore();
const AuthToken    = beameSDK.AuthToken;
const utils        = require('../../utils');
const gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);

// TODO: Session renewal?
const messageHandlers = {
	'auth': function(payload, reply) {
		// TODO: validate token and check it belongs to one of the registered users
		// TODO: return apps list + session token
		// --- request ---
		// type: auth
		// payload: token
		// --- response ---
		// type: 'authenticated'
		// payload: {success: true/false, error: 'some str', apps: [{'App Name': {id: ..., online: true/false}}, ...]}
		console.log('messageHandlers/auth');

		// XXX really do it against authorization server
		function assertTokenFqdnIsAuthorized(token) {
			return Promise.resolve(token);
		}

		function listApplications() {
			return Promise.resolve({
				'Files sharing app': {
					id: 1,
					online: true
				},
				'Funny pictures album app': {
					id: 2,
					online: false
				},
				'Company calendar app': {
					id: 3,
					online: true
				}
			});
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
					type: 'authenticated',
					payload: {
						success: true,
						session_token: token,
						apps: apps
					}
				});
			});
		}

		assertTokenFqdnIsAuthorized(payload.token)
			.then(AuthToken.validate)
			.then(listApplications)
			.then(createSessionToken)
			.then(respond)
			.catch(e => {
				reply({
					type: 'authenticated',
					payload: {
						success: false,
						error: e.toString()
					}
				});
			});

	},
	'choose': function(payload, reply) {
		// Choose application - redirect app switchig URL on GW, auth token in URL
		// --- request ---
		// type: choose
		// payload: {session_token: ..., app_id: ...}
		// --- response ---
		// type: 'redirect'
		// payload: {success: true/false, url: ...}
	},
	'logout': function(payload, reply) {
		// Redirect to cookie removing URL on GW
		// type: logout
		// payload: {session_token: ...}
		// --- response ---
		// type: 'redirect'
		// payload: {success: true/false, logout:true, url: ...}
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

function onConnection(client) {
	// Browser controller will connect here
	console.log('[GW] handleSocketIoConnect');

	function reply(data) {
		client.emit('data', JSON.stringify(data));
	}

	client.on('data', data => {
		try {
			data = JSON.parse(data);
		} catch(e) {
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

// server - https.Server
function start(server) {
	const io = socket_io(server, {path: `${Constants.GatewayControllerPath}/socket.io`});
	io.on('connection', onConnection);
}

module.exports = {
	start
};
