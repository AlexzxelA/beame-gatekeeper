/**
 * Created by zenit1 on 28/11/2016.
 */


var videoEl, canvas, wsavc;


function onDocLoaded() {

	window.parent.document.title = 'Mobile Stream';

	window.parent.getNotifManagerInstance().subscribe('MOBILE_STREAM', function (args) {
		if (!args || !args.url || !args.sign) {
			return;
		}

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
}


document.addEventListener("DOMContentLoaded", onDocLoaded);