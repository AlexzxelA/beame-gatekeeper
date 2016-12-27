/**
 * Created by zenit1 on 27/12/2016.
 */
"use strict";

function onUserImageReceived(args){
	if (!args || !args.src) {
		return;
	}

	var img    = document.getElementById('img-user-pict'),
		signBox =document.getElementById('pairing-box'),
		imgBox =document.getElementById('user-img-box');

	img.src = args.src;

	signBox.style.display ='none';
	imgBox.style.display ='block';
}

function userImageHandler() {

	window.getNotifManagerInstance().subscribe('SHOW_USER_IMAGE', onUserImageReceived);
}


document.addEventListener("DOMContentLoaded", userImageHandler);