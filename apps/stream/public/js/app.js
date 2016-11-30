/**
 * Created by zenit1 on 28/11/2016.
 */


var videoEl, canvas, wsavc;


function onDocLoaded() {

	window.parent.document.title = 'Mobile Stream';

	window.parent.getNotifManagerInstance().subscribe('MOBILE_STREAM', function (args) {
		if (!args || !args.url) {
			return;
		}


		function resetCanvas() {
			console.log('on streamer controller enter');
			videoEl = document.getElementById('remote-video-player');
			videoEl.innerHTML = null;
			canvas = document.createElement("canvas");
			videoEl.innerHTML += canvas;
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