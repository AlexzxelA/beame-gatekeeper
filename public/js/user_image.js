/**
 * Created by zenit1 on 27/12/2016.
 */
"use strict";
var img ,
    signBox,
    imgBox;
function onUserImageReceived(args){
	if (!args || !args.src) {
		return;
	}

	img    = document.getElementById('img-user-pict');
		signBox =document.getElementById('pairing-box');
		imgBox =document.getElementById('user-img-box');

	img.src = args.src;
	img.style.visibility='visible';
	signBox.style.display ='none';
	imgBox.style.display ='block';
}

function onUserAction(accepted){
	if(accepted){
		window.sessionValidationComplete = true;
	}
	else{
		sendEncryptedData(getRelaySocket(), getRelaySocketID(), str2ab(JSON.stringify({'type': 'userImageReject'})));
		alert('User rejected');
		// signBox.style.display ='block';
		// imgBox.style.display ='none';
		// img.style.visibility='hidden';
		window.location.reload();
	}
}

function userImageHandler() {

	window.getNotifManagerInstance().subscribe('SHOW_USER_IMAGE', onUserImageReceived);
}


document.addEventListener("DOMContentLoaded", userImageHandler);