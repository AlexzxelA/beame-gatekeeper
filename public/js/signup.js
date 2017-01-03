/**
 * Created by zenit1 on 18/11/2016.
 */
"use strict";

var auth_mode              = 'Provision',
    stopAllRunningSessions = false,
    forceReloadWindowOnSessionFailure = false,
    socketio_options       = {'force new connection': true},//, transports: ['polling']},
    reg_data;

function _logout() {
	deleteCookie('beame_reg_data');
	logout();
}

var reg_data_cookie = getCookie('beame_reg_data');

if (!reg_data_cookie) {
	alert('Registration data required');
	_logout();
}

try {
	reg_data = JSON.parse(decodeURIComponent(reg_data_cookie));
	deleteCookie('beame_reg_data');
} catch (e) {
	console.error(e);
	_logout();
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