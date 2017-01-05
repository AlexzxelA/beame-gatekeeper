/**
 * Created by zenit1 on 18/11/2016.
 */
"use strict";

var auth_mode              = 'Provision',
    stopAllRunningSessions = false,
    forceReloadWindowOnSessionFailure = false,
    socketio_options       = {'force new connection': true};

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

