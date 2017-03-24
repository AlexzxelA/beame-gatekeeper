/**
 * Created by zenit1 on 18/11/2016.
 */
"use strict";

var auth_mode = 'Session',
    stopAllRunningSessions = false,
	forceReloadWindowOnSessionFailure = false,
    reg_data = null,
    socketio_options = {path: '/beame-gw-insta-socket', 'force new connection': true},// transports: ['websocket']},
	delegatedUserId = getParameterByName('usrInData');

	if(delegatedUserId){
		delegatedUserId = window.atob(decodeURIComponent(delegatedUserId));
		setCookie("usrInData",delegatedUserId,0.24);
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
		//ensure that no login proposed after image invalidation
		document.cookie = 'usrInData=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;';
		logout();
	}
}