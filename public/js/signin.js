/**
 * Created by zenit1 on 18/11/2016.
 */
"use strict";

var auth_mode = 'Session',
    stopAllRunningSessions = false,
	forceReloadWindowOnSessionFailure = false,
    reg_data = null,
    socketio_options = {path: '/beame-gw-insta-socket', 'force new connection': true}; //, transports: ['polling']};

function onUserAction(accepted){
	if(accepted&& originTmpSocket){

		try {
			lblReqImgMsg.innerHTML = 'Please wait';
			lblReqImg.style.display = 'block';
		}
		catch(e){

		}

		window.sessionValidationComplete = true;
	}
	else{
		sendEncryptedData(getRelaySocket(), getRelaySocketID(), str2ab(JSON.stringify({'type': 'userImageReject'})));
		alert('User rejected');
		window.location.reload();
	}
}