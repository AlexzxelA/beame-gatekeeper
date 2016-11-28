/**
 * Created by zenit1 on 28/11/2016.
 */
"use strict";

var img, loader;

function loadImage(url) {

	loader.style.visibility='visible';

	var img = new Image();

	function notify_complete() {
		loader.style.visibility='hidden';
		img.src  = url;
	}

	img.onload = notify_complete;
	img.src    = url;
}

function onDocLoaded() {

	window.parent.document.title = 'Mobile Photos';

	window.parent.getNotifManagerInstance().subscribe('MOBILE_PHOTO_URL', function (event, args) {
		if (!args || !args.url) {
			return;
		}

		var url = args.url + '?w=600&h=600';

		img    = document.getElementById('img-photo');
		loader = document.getElementById('img-loader');

		loadImage(url);

	});
}


document.addEventListener("DOMContentLoaded", onDocLoaded);