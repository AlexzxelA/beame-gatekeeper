/**
 * Created by zenit1 on 18/11/2016.
 */
"use strict";

var auth_mode = 'Session',
    stopAllRunningSessions = false,
	forceReloadWindowOnSessionFailure = false,
    reg_data = null,
    socketio_options = {path: '/beame-gw-insta-socket', 'force new connection': true},
	delegatedUserId = getCookie('beame_userid');
	if(delegatedUserId){
		document.cookie = "beame_userid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
	}

function onUserAction(accepted){
	if(accepted && originTmpSocket){

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
		window.location.reload();
	}
}