/**
 * Created by Alexz on 08/12/2016.
 */

"use strict";
const audioOnlySession = false;
const activateVirtHostRecovery = false;
const virtHostTimeout = 5;
const wait4MobileTimeout = 7000;
var vUID = null,
	virtRelaySocket = null,
	virtHostConnected = false,
	connectToRelayTimeout = 10,
	connectToRelayRetry = null,
	qrRefreshRate = 1000,
	allSessionsActive = true,
	TMPsocketOriginQR = null,
	TMPsocketOriginWh = null,
	TMPsocketOriginAp = null,
	TmpSocketID = null,
	virtHostAlive = 0,
	pingVirtHost = null,
	controlWindowTimer = null,
	RelayPath = null,
	RelayFqdn = null,
	waitingForMobileConnection = null;

var sessionValidationActive   = null,
	sessionValidationComplete = false;

function validateSession(imageRequired) {

	return new Promise(function(resolve, reject) {
			if (imageRequired) {
				sendEncryptedData(getRelaySocket(), getRelaySocketID(), str2ab(JSON.stringify({'type': 'userImageRequest'})));
				window.getNotifManagerInstance().notify('SHOW_USER_IMAGE_LOAD_MSG');
				var safetyTimer = 300;
				sessionValidationComplete = false;
				sessionValidationActive = setInterval(function () {
					if (--safetyTimer > 0) {
						if (sessionValidationComplete) {
							clearInterval(sessionValidationActive);
							resolve();
						}
					}
					else {
						clearInterval(sessionValidationActive);
						reject();
					}
				}, 1000);
			}
			else {
				resolve();
			}
		}
	);
}

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
		case 'AP':
			TMPsocketOriginAp = socket;
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
	if(virtRelaySocket && virtRelaySocket.connected){
		virtRelaySocket.emit('cut_client',{'socketId':TmpSocketID});
		virtRelaySocket.removeAllListeners();
		virtRelaySocket = undefined;
	}
	if(!RelayFqdn || (RelayFqdn.indexOf(relay) < 0)){
		RelayFqdn   = "https://" + relay + "/control";
		RelayPath   = "https://" + relay;
	}
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
	// if(delegatedUserId){
	// 	var usrParsed = JSON.parse(delegatedUserId);
	// 	delegatedUID = usrParsed.uid;
	// 	vUID = delegatedUID;
	// }
	// else{
	vUID = generateUID(24) + VirtualPrefix;
	//}

	return vUID;
}

function getRelaySocketID() {
	return TmpSocketID;
}

function initComRelay() {
	virtRelaySocket.on('disconnect', function () {
		setQRStatus && setQRStatus('Virtual host disconnected');
		console.log('relay disconnected, ID = ', virtRelaySocket.id);
	});

	virtRelaySocket.on('data', function (data) {
		console.log('QR relay data');
		TmpSocketID = data.socketId;
		processMobileData(virtRelaySocket, {'QR':TMPsocketOriginQR, 'WH':TMPsocketOriginWh, 'GW':null, 'AP': TMPsocketOriginAp}, data);
		virtRelaySocket.beame_relay_socket_id = data.socketId;
	});

	virtRelaySocket.on('create_connection', function () {
		console.log('create_connection, ID = ', virtRelaySocket.id);
	});

	virtRelaySocket.on('hostRegistered', function (data) {
		clearInterval(connectToRelayRetry);
		virtHostAlive = virtHostTimeout;
		vUID = data.Hostname;
		//TMPsocketOriginWh && sendQrDataToWhisperer(RelayPath, vUID, TMPsocketOriginWh);
		TMPsocketOriginAp && sendQrDataToApprover(RelayPath, vUID, TMPsocketOriginAp);
		console.log('QR hostRegistered, ID = ', virtRelaySocket.id, '.. hostname: ', data.Hostname);
		TMPsocketOriginQR && setQRStatus && setQRStatus('Virtual host registration complete');
		TMPsocketOriginQR && TMPsocketOriginQR.emit('virtSrvConfig', vUID);
		TMPsocketOriginQR && keepVirtHostAlive(TMPsocketOriginQR);
		controlWindowStatus();
		if(delegatedUserId){
			waitingForMobileConnection = setTimeout(function () {
				window.location.href = 'https://dev.login.beameio.net';//TODO restart local login page without parameters?
			},wait4MobileTimeout);
			var sock = TMPsocketOriginQR || TMPsocketOriginWh || TMPsocketOriginAp;
			events2promise(cryptoObj.subtle.exportKey('spki', keyPair.publicKey)).
			then(function (keydata) {
				var PK = arrayBufferToBase64String(keydata);
				var imgReq = (reg_data && reg_data.userImageRequired)?reg_data.userImageRequired: userImageRequired;
				var qrData       = JSON.stringify({
					'relay': RelayPath, 'PK': PK, 'UID': getVUID(),
					'PIN':   getParameterByName('pin') || 'none', 'TYPE': 'LOGIN',
					'TIME': Date.now(), 'REG': 'LOGIN',
					'imageRequired': imgReq, 'appId':JSON.parse(sessionServiceData).appId
				});

				sock && sock.emit('notifyMobile', JSON.stringify(Object.assign((JSON.parse(delegatedUserId)), {qrData:qrData})));
				delegatedUserId = undefined;
			}).catch(function (e) {
				sock && sock.emit('notifyMobile', JSON.stringify(Object.assign((JSON.parse(delegatedUserId)), {qrData:'NA', error:e})));
				delegatedUserId = undefined;
				window.location.href = 'https://dev.login.beameio.net';//TODO restart local login page without parameters?
			});
		}
	});

	virtRelaySocket.on('hostRegisterFailed',function (data) {
		if(data && data.Hostname){
			console.log('Requesting virtual host signature renewal');
			TMPsocketOriginQR && TMPsocketOriginQR.emit('browser_connected', getVUID());
		}
	});

	virtRelaySocket.on('error', function () {
		console.log('Relay error, ID = ', virtRelaySocket.id);
	});

	virtRelaySocket.on('_end', function () {
		console.log('Relay end, ID = ', virtRelaySocket.id);
	});

}

function controlWindowStatus() {
	if(!controlWindowTimer){
		controlWindowTimer = setInterval(function () {
			if(forceReloadWindowOnSessionFailure){
				console.log('<<<<<<<<<<<<<<<<<<<< Reloading due to external trigger >>>>>>>>>>>>>>>>>>>>>>');
				setTimeout(function () {
					window.location.reload();
				},1000);
			}
			if(stopAllRunningSessions && allSessionsActive){
				allSessionsActive = false;
				if(TMPsocketOriginWh){
					TMPsocketOriginWh.emit('close_session');
				}
				if (qrSession) clearInterval(qrSession);
			}
		}, 1000);
	}
}

function keepVirtHostAlive(srcSock) {
	if(virtHostAlive == virtHostTimeout && activateVirtHostRecovery){
		--virtHostAlive;
		setTimeout(function () {
			virtRelaySocket.emit('beamePing');
			pingVirtHost = setInterval(function () {
				if(--virtHostAlive <= 0){
					clearInterval(pingVirtHost);
					srcSock.emit('browser_connected', getVUID());
				}
			},2000);
		},2000);

		virtRelaySocket.on('beamePong',function () {
			setTimeout(function () {
				virtHostAlive = virtHostTimeout - 1;
				virtRelaySocket.emit('beamePing');
			},2000);
		});
	}
}