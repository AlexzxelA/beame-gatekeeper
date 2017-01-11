/**
 * Created by zenit1 on 18/11/2016.
 */
"use strict";

var auth_mode              = 'Provision',
    stopAllRunningSessions = false,
    forceReloadWindowOnSessionFailure = false,
    socketio_options       = {'force new connection': true},
	ApTMPsocketOrigin,
	apRelayEndpoint,
	UID,
	originSock;

$(document).ready(function () {
	var waitingForWindow = setInterval(function () {
		if(getVUID()){
			console.log('UID:',getVUID());
			clearInterval(waitingForWindow);
			if(!originSock){
				generateKeys();
				originSock = io.connect("/approver", {'path':'/customer-approve/socket.io','force new connection': true});
				originSock.on('connect', function () {
					setOriginSocket('AP', originSock);
					console.log('Approver socket connected, ', apRelayEndpoint);
					ApTMPsocketOrigin = originSock;//remove towards prod
					if (!apRelayEndpoint) {
						UID = getVUID();
						originSock.emit('browser_connected', getVUID());
					}
				});
				initSocketInterface(originSock);
			}
		}
	},200);
});
// var UID = getVUID();//generateUID(24) + VirtualPrefix;
// console.log('UID:', UID);

//noinspection ES6ModulesDependencies,NodeModulesDependencies


function initSocketInterface(socket) {
	console.log('Approver window ready');


	socket.on('userImageSign',function (data) {
		sendEncryptedData(getRelaySocket(), getRelaySocketID(), str2ab(JSON.stringify(data)));
		window.getNotifManagerInstance().notify('STOP_PAIRING', null);
	});

	socket.on('relayEndpoint', function (data) {
		console.log('AP relayEndpoint', data);
		getKeyPairs(function (error, keydata) {
			if (error) {
				console.log(error);
				return;
			}
			try {
				var parsedData  = JSON.parse(data);
				userImageRequired = parsedData['imageRequired'];
				apRelayEndpoint = parsedData['data'];
				connectRelaySocket(apRelayEndpoint, parsedData['signature']);
			}
			catch (e) {
				socket.emit('browserFailure', {'error': 'relay fqdn get - failed'});
				console.error('failed to parse data:', e);
			}
		});
	});
}

function sendQrDataToApprover(relay, uid, socket) {
	console.log('sendQrDataToApprover - entering');
	if(keyPair){
		window.crypto.subtle.exportKey('spki', keyPair.publicKey)
			.then(function (keydata) {
				var PK = arrayBufferToBase64String(keydata);
				var tmp_type = (auth_mode == 'Provision') ? 'PROV' : "LOGIN";
console.log('data:',getParameterByName('data'));
				var qrData       = JSON.stringify({
					'relay': relay, 'PK': PK, 'UID': uid, 'imageRequired':userImageRequired,
					'pin':   getParameterByName('pin'), 'TYPE': tmp_type, 'TIME': Date.now(), 'REG': 'approval'
				});
				socket.emit('init_mobile_session', qrData);
				console.log('sending qr data to approver:', qrData);//XXX
			}).catch(function (err) {
			console.error('Export Public Key Failed', err);
		});
	}
}

function onUserAction(accepted){
	if(accepted && originTmpSocket){

		try {
			lblReqImgMsg.innerHTML = 'Please wait for completing registration';
			lblReqImg.style.display = 'block';
		}
		catch(e){

		}

		originTmpSocket.emit('userImageOK', activeImageData);
	}
	else{
		sendEncryptedData(getRelaySocket(), getRelaySocketID(), str2ab(JSON.stringify({'type': 'userImageReject'})));
	}
}

