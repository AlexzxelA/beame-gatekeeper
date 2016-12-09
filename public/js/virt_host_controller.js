/**
 * Created by Alexz on 08/12/2016.
 */

"use strict";
const audioOnlySession = false;
var vUID = null,
	virtRelaySocket = null,
	virtHostConnected = false,
	connectToRelayTimeout = 10,
	connectToRelayRetry = null,
	TMPsocketOriginQR = null,
	TMPsocketOriginWh = null,
	TmpSocketID = null,
	RelayFqdn = null;
	

function registerVirtualHost(signature, socket) {

	sendConnectRequest(signature, socket);
	connectToRelayRetry = setInterval(function () {
		if(--connectToRelayTimeout){
			sendConnectRequest(signature, socket);
		}
	},3000);
}

function setOriginSocket(type, socket) {
	switch (type){
		case 'QR':
			TMPsocketOriginQR = socket;
			break;
		case 'WH':
			TMPsocketOriginWh = socket;
			break;
	}
}

function sendConnectRequest(signature, socket) {
	socket.emit('register_server',
		{
			'payload': {
				'socketId':      null,
				'hostname':      vUID,
				'signature':     signature,
				'type':          'HTTPS',
				'isVirtualHost': true
			}
		});
}

function connectRelaySocket(relay, sign) {
	if(virtRelaySocket)return virtRelaySocket;
	RelayFqdn   = "https://" + relay + "/control";
	virtRelaySocket = io.connect(RelayFqdn);
	virtRelaySocket.on('connect',function () {
		virtHostConnected = true;
		registerVirtualHost(sign, virtRelaySocket);
		initComRelay();
	});
	return 0;
}

function getRelayFqdn() {
	return RelayFqdn;
}

function getRelaySocket() {
	return virtRelaySocket;
}

function isAudioSession() {
	return audioOnlySession;
}

function getVUID() {
	if(vUID)return vUID;
	vUID = generateUID(24) + VirtualPrefix;
	return vUID;
}

function getRelaySocketID() {
	return TmpSocketID;
}

function initComRelay() {
	virtRelaySocket.on('disconnect', function () {
		setQRStatus('Virtual host disconnected');
		console.log('relay disconnected, ID = ', virtRelaySocket.id);
	});

	virtRelaySocket.on('data', function (data) {
		console.log('QR relay data');
		TmpSocketID = data.socketId;
		processMobileData(virtRelaySocket, {'QR':TMPsocketOriginQR, 'WH':TMPsocketOriginWh, 'GW':null}, data);
		virtRelaySocket.beame_relay_socket_id = data.socketId;
	});

	virtRelaySocket.on('create_connection', function () {
		console.log('create_connection, ID = ', virtRelaySocket.id);
	});

	virtRelaySocket.on('hostRegistered', function (data) {
		clearInterval(connectToRelayRetry);
		vUID = data.Hostname;
		sendQrDataToWhisperer(RelayFqdn, vUID, TMPsocketOriginWh);
		console.log('QR hostRegistered, ID = ', virtRelaySocket.id, '.. hostname: ', data.Hostname);
		setQRStatus('Virtual host registration complete');
		TMPsocketOriginQR.emit('virtSrvConfig', vUID);
	});

	virtRelaySocket.on('error', function () {
		console.log('Relay error, ID = ', virtRelaySocket.id);
	});

	virtRelaySocket.on('_end', function () {
		console.log('Relay end, ID = ', virtRelaySocket.id);
	});
}