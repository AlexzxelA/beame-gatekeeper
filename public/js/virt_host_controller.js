/**
 * Created by Alexz on 08/12/2016.
 */

//"use strict";
const audioOnlySession = false;
const activateVirtHostRecovery = false;
const virtHostTimeout = 5;
const wait4MobileTimeout = 30000;
const connectionRetryDelay = 2000;
var vUID = null,
	virtRelaySocket = null,
	virtHostConnected = false,
	connectToRelayTimeout = 10,
	connectToRelayCounter = connectToRelayTimeout,
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
	waitingForMobileConnection = null,
	extVirtualHost = null,
	sessionRecovery = false,
	sessionXdata = null;

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
	var hostname = extVirtualHost,
		connectReq = function () {
		if(hostname)
			sendClientRequest(hostname, socket);
		else
			sendConnectRequest(signature, socket);
	};
	connectReq();
	if(!connectToRelayRetry)
	connectToRelayRetry = setInterval(function () {
		if(--connectToRelayCounter > 0){
			connectReq();
		}
		else{
			clearInterval(connectToRelayRetry);
			pingVirtHost && clearInterval(pingVirtHost);
		}
	},connectionRetryDelay);
}

function sendClientRequest(hostname, socket) {
	console.log('Sending connection request:',hostname);
	socket.emit('register_server',
		{
			'payload': {
				'socketId':      sessionRecovery?TmpSocketID:null,
				'host':          hostname,
				'type':          'HTTPS',
				'toVirtualHost': true,
				'recovery': sessionRecovery
			}
		});
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


function connectRelaySocket(relay, sign, extUid, retries) {
	if(retries){
		if(connectToRelayRetry){//connect in progress
			console.log('Already reconnecting:', connectToRelayCounter);
			return;
		}
		connectToRelayCounter += retries * connectToRelayTimeout;
		sessionRecovery = true;
	}
	else{
		sessionRecovery = false;
		sessionXdata = sign;
	}



	if(extUid)extVirtualHost = extUid;
	if(virtRelaySocket){
		if(virtRelaySocket.connected)
			virtRelaySocket.emit('cut_client',{'socketId':TmpSocketID});
		virtRelaySocket.removeAllListeners();
		virtRelaySocket = undefined;
	}
	if(!RelayFqdn || (relay && RelayFqdn.indexOf(relay) < 0)){
		RelayFqdn   = "https://" + relay + "/control";
		RelayPath   = "https://" + relay;
	}
	virtRelaySocket = io.connect(RelayFqdn);//, {transports: ['websocket']});
	virtRelaySocket.on('connect',function () {
		virtHostConnected = true;
		registerVirtualHost(sign || sessionXdata, virtRelaySocket);
		if(extVirtualHost)vUID = extVirtualHost;
		initComRelay(sign || sessionXdata);
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

function initComRelay(sign) {
	virtRelaySocket.on('disconnect', function () {
		setQRStatus && setQRStatus('Virtual host disconnected');
		console.log('relay disconnected, ID = ', virtRelaySocket.id);
	});

	virtRelaySocket.on('connectedToBrowser', function (data) {
		try{
			notifyOrigin(data);
			var parsed = (typeof  data === 'object')? data : JSON.parse(data);
			TmpSocketID = parsed.socketId;
			if(keyPair){
				events2promise(cryptoSubtle.exportKey(exportPKtype, keyPair.publicKey))
					.then(function (keydata) {
						var PK = null;
						if(engineFlag)
							PK = jwk2pem(JSON.parse(atob(arrayBufferToBase64String(keydata))));
						else
							PK = arrayBufferToBase64String(keydata);

						console.log('Sending connectionRequest to mobile');
						sendEncryptedData(getRelaySocket(), getRelaySocketID(), str2ab(JSON.stringify({type:'connectionRequest',token:sign, PK: PK, socketId: TmpSocketID})), null, vUID);

					}).catch(function (e) {
					console.error(e);
				});
			}

		}
		catch (e){
			console.error(e);
		}
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

	function notifyOrigin(data) {
		clearInterval(connectToRelayRetry);
		connectToRelayRetry = null;
		virtHostAlive = virtHostTimeout;
		if(!sessionRecovery){
			vUID = data.Hostname || vUID;
			//TMPsocketOriginWh && sendQrDataToWhisperer(RelayPath, vUID, TMPsocketOriginWh);
			TMPsocketOriginAp && sendQrDataToApprover(RelayPath, vUID, TMPsocketOriginAp);
			console.log('QR hostRegistered, ID = ', virtRelaySocket.id, '.. hostname: ', data.Hostname);
			TMPsocketOriginQR && setQRStatus && setQRStatus('Virtual host registration complete');
			TMPsocketOriginQR && TMPsocketOriginQR.emit('virtSrvConfig', vUID);
			TMPsocketOriginQR && keepVirtHostAlive(TMPsocketOriginQR);
			controlWindowStatus();
		}
		else{
			window.getNotifManagerInstance().notify('RELAY_CONNECTION_RECOVERED', virtRelaySocket);
		}
	}

	virtRelaySocket.on('hostRegistered', function (data) {
		notifyOrigin(data);
	});

	virtRelaySocket.on('hostRegisterFailed',function (msg) {

		processVirtualHostRegistrationError(msg, function (status) {
			if(!sessionRecovery){
				if(status === 'retry'){
					TMPsocketOriginQR && TMPsocketOriginQR.emit('browser_connected', getVUID());
				}
				else{
					virtRelaySocket.removeAllListeners();
					virtRelaySocket = undefined;
				}
			}
		});
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
