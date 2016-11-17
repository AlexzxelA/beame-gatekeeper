/**
 * Created by zenit1 on 17/11/2016.
 */
"use strict";

function startGatewaySession(authToken, relaySocket) {

	var gw_socket = null, relay_socket = null;

	restartMobileRelaySocket(relaySocket);

	gw_socket = io.connect('/', {path: '/beame-gw/socket.io'});

	gw_socket.on('error', function(e) {
		console.error('Error in gw_socket', e);
	});

	gw_socket.on('connect',function(){

		gw_socket.emit('data',{
			type:'auth',
			payload: {token:authToken}
		})

	});

	gw_socket.on('data', data => {
		data = JSON.parse(data);

		console.log('DATA %j', data);

		var session_token, apps, type = data.type, payload = data.payload;

		if (payload.html) {

			removeLogin();

			setIframeHtmlContent(payload.html);
			// Happens on 'authenticated' type event
			// Show full screen div with payload.html
			delete payload.html;
		}

		if (payload.url) {
			setIframeUrl(payload.url);
			// Redirect the main frame to payload.url
			delete payload.url;
		}

		if(relay_socket){
			relay_socket.emit('data', data);
		}


		// For all types of packets
		// Send payload to mobile device using mob_relay_socket


	});

	function restartMobileRelaySocket(mob_relay_socket){

		if(!mob_relay_socket) return;

		relaySocket = mob_relay_socket;

		relaySocket.removeAllListeners();

		relaySocket.on('disconnect', function () {
			console.log('mobile socket:: disconnected ', relaySocket.id);
		});

		relaySocket.on('data',function(data){
			var type = data.payload.data.type;

			switch (type) {
				case 'choose':
					return;
				case 'logout':
					gw_socket.emit('data',{
						type:'logout',

					});
					return;
				default:
					console.error('mobile socket:: unknown payload type ' + type);
					return;
			}
		});

		relaySocket.on('error', function () {
			console.log('mobile socket:: error', relaySocket.id);
		});

		relaySocket.on('_end', function () {
			console.log('mobile socket:: end', relaySocket.id);
		});

	}
}

function setIframeHtmlContent(html){
	var iframe = document.getElementById('ifrm-content'),
	    iframedoc = iframe.contentDocument || iframe.contentWindow.document;

	iframedoc.body.innerHTML = html;
}

function setIframeUrl(url){
	var iframe = document.getElementById('ifrm-content');

	iframe.src = url;
}

function removeLogin(){
	$('#login_form').remove();
}
