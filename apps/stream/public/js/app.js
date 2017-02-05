/**
 * Created by zenit1 on 28/11/2016.
 */

"use strict";

var videoEl, canvas, wsavc,loader;


function onDocLoaded() {
console.log('onDocLoaded stream');
	loader = document.getElementById('img-loader');

	window.parent.document.title = 'Mobile Stream';

	window.parent.getNotifManagerInstance().subscribe('MOBILE_STREAM', function (args) {
		console.log('MOBILE_STREAM stream:',args);
		if (!args || !args.url || !args.sign) {
			return;
		}

		loader.style.visibility='visible';

		var STREAM_SOCKET_URL = args.url + '?sign=@'+ encodeURIComponent(args.sign);

		//
		// var canvas = document.getElementsByTagName('canvas');
		// if (!canvas || canvas.length == 0) return;
		//
		// canvas[0].style.display = 'block';
		//
		// //clear canvas
		// var gl = canvas[0].getContext('webgl');
		// if (gl == null) return;
		// //gl.clearColor(1,1,1,1);
		// gl.clear(gl.COLOR_BUFFER_BIT);


		function resetCanvas() {
			console.log('on streamer controller enter');
			videoEl = document.getElementById('remote-video-player');
			videoEl.innerHTML = null;
			canvas = document.createElement("canvas");
			videoEl.appendChild(canvas);
		}


		resetCanvas();

		//noinspection JSUnusedAssignment
		wsavc = new window.WSAvcPlayer(canvas, "webgl", 1, 35);
		wsavc.connect(STREAM_SOCKET_URL, function () {
			console.log('play stream');

			wsavc.playStream();
		});

	});


	window.parent.getNotifManagerInstance().subscribe('MOBILE_STREAM_HIDE_LOADER',function(){

		loader.style.visibility='hidden';
	});
}


document.addEventListener("DOMContentLoaded", onDocLoaded);