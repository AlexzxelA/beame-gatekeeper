/**
 * Created by zenit1 on 28/11/2016.
 */
"use strict";

var img, loader;

function loadImage(url) {

	loader.style.visibility='visible';

	var tempImage = new Image();

	function notify_complete() {
		loader.style.visibility='hidden';
		console.log('set url to ' + url);
		img.src  = url;
		img.style.visibility='visible';
	}

	tempImage.onload = notify_complete;
	tempImage.src    = url;
}

function onUrlReceived(args){
	if (!args || !args.url) {
		return;
	}

	var url = args.url + '?sign=@'+ encodeURIComponent(args.sign)+'&w=600&h=600';

	img    = document.getElementById('img-photo');
	loader = document.getElementById('img-loader');

	loadImage(url);
}

function onDocLoaded() {

	window.parent.document.title = 'Mobile Photos';

	window.parent.getNotifManagerInstance().subscribe('MOBILE_PHOTO_URL', onUrlReceived);
}


document.addEventListener("DOMContentLoaded", onDocLoaded);