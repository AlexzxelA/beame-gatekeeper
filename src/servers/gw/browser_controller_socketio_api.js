'use strict';

const socket_io   = require('socket.io');
const beameSDK    = require('beame-sdk');
const BeameStore  = new beameSDK.BeameStore();

// TODO: Session renewal?
const messageHandlers = {
	'auth': function(payload) {
		// TODO: check which token
		// TODO: return apps list + session token
		// --- request ---
		// type: auth
		// payload: token
		// --- reply ---
		// type: 'authenticated'
		// payload: {success: true/false, apps: [{'App Name': {id: ..., online: true/false}}, ...]}
	},
	'choose': function(payload) {
		// Choose application - redirect app switchig URL on GW, auth token in URL
		// --- request ---
		// type: choose
		// payload: {session_token: ..., app_id: ...}
		// --- reply ---
		// type: 'redirect'
		// payload: {success: true/false, url: ...}
	},
	'logout': function(payload) {
		// Redirect to cookie removing URL on GW
		// type: logout
		// payload: {session_token: ...}
		// --- reply ---
		// type: 'redirect'
		// payload: {success: true/false, logout:true, url: ...}
	}
};

function sendError(client, error) {
	client.emit('data', JSON.stringify({type: 'error', payload: error}));
}

function onConnection(client) {
	// Browser controller will connect here
	console.log('[GW] handleSocketIoConnect');
	client.on('data', data => {
		try {
			data = JSON.parse(data);
		} catch(e) {
			// nothing
		}
		if (!data || !data.type || !data.payload) {
			return sendError(client, 'Data must have "type" and "payload" fields');
		};
		if (!messageHandlers[data.type]) {
			return sendError(client, `Don't know how to handle message of type ${data.type}`);
		}
		client.emit('data', JSON.stringify(messageHandlers[data.type](data.payload)));
	});
}

// server - https.Server
function start(server) {
	const io = socket_io(server, {path: '/beame-gw/socket.io'});
	io.on('connection', onConnection);
}
	
module.exports = {
	start
};
