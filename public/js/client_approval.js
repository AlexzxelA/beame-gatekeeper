/**
 * Created by zenit1 on 18/11/2016.
 */
"use strict";

var auth_mode              = 'Provision',
    stopAllRunningSessions = false,
    forceReloadWindowOnSessionFailure = false,
    socketio_options       = {'force new connection': true},
	ApTMPsocketOrigin,
	apRelayEndpoint;

var UID = getVUID();//generateUID(24) + VirtualPrefix;
console.log('UID:', UID);

//noinspection ES6ModulesDependencies,NodeModulesDependencies
var socket = io.connect("/approver", socketio_options);
console.log('Approver window ready');
socket.on('connect', function () {
	setOriginSocket('AP', socket);
	console.log('Approver socket connected, ', apRelayEndpoint);
	ApTMPsocketOrigin = socket;//remove towards prod
	if (!apRelayEndpoint) {
		socket.emit('browser_connected', UID);
	}
});

socket.on('userImageSign',function (data) {
	sendEncryptedData(getRelaySocket(), getRelaySocketID(), str2ab(JSON.stringify(data)));
	window.getNotifManagerInstance().notify('STOP_PAIRING', null);
});

socket.on('relayEndpoint', function (data) {
	socket.emit('ack', 'relayEndpoint');
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

function _logout() {
	deleteCookie('beame_reg_data');
	logout();
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

