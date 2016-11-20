/**
 * Created by zenit1 on 17/11/2016.
 */
"use strict";

function startGatewaySession(authToken, relaySocket) {

	var gw_socket = null, relay_socket = relaySocket;

	// xxx - start
	var xxx_session_token = null;
	// xxx - end
	console.log('startGatewaySession authToken:',authToken);
	restartMobileRelaySocket(relaySocket);

	gw_socket = io.connect('/', {
		path: '/beame-gw/socket.io',
		'force new connection': true
	});

	gw_socket.on('error', function(e) {
		console.error('Error in gw_socket', e);
	});

	gw_socket.once('connect',function(){

		console.info('gw_socket connected');

		gw_socket.emit('data',{
			type:'auth',
			payload: {token:authToken}
		})

	});

	gw_socket.on('data', function(data) {
		data = JSON.parse(data);

		console.log('DATA %j', data);

		var session_token, apps, type = data.type, payload = data.payload, user = payload.user;

		// xxx - start
		if (type == 'authenticated' && payload.success) {
			xxx_session_token = payload.session_token;
			console.warn('session token', xxx_session_token);

			if(user){
				$('#conn-to').html('connected to ' + user.fqdn);
				$('#user-name').html('Hello, ' + (user.name || user.email || user.user_id));
				$('#info-module').show();
			}

		}
		// xxx - end

		if (payload.html) {

			stopAllRunningSessions = true;

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
			var msg = {
				'socketId': relay_socket.beame_relay_socket_id,
				'payload': JSON.stringify(data)
			};
			console.log('******** Sedning:: ', msg);
			// QrTMPsocketRelay.emit('data', msg);
			relay_socket.emit('data', msg);
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

			processMobileData(WhTMPSocketRelay,gw_socket, data,function (decryptedData){
				gw_socket.emit('data',decryptedData);
				console.log('relaySocket data', decryptedData);
				// var type = decryptedData.payload.data.type,
				// 	session_token = decryptedData.payload.data.session_token;
				//
				// var payload = {session_token: session_token};
				//
				// switch (type) {
				// 	case 'choose':
				// 		payload.app_id = decryptedData.payload.data.app_id;
				// 		break;
				// 	case 'logout':
				// 		break;
				// 	default:
				// 		console.error('mobile socket:: unknown payload type ' + type);
				// 		return;
				// }

				// gw_socket.emit('data',{
				// 	type: type,
				// 	payload: payload
				// });

			});
		});

		relaySocket.on('error', function () {
			console.log('mobile socket:: error', relaySocket.id);
		});

		relaySocket.on('_end', function () {
			console.log('mobile socket:: end', relaySocket.id);
		});

	}

	function chooseApp(id) {
		console.log('chooseApp', id, xxx_session_token);
		gw_socket.emit('data',{
			type: 'choose',
			payload: {
				id: id,
				session_token: xxx_session_token
			}
		});
	}

	function logout() {
		gw_socket.emit('data',{
			type: 'logout',
			payload: {
				session_token: xxx_session_token
			}
		});
	}

	// xxx - start
	window.xxx_choose_app = chooseApp;
	window.xxx_logout = logout;
	// xxx - end
}

function setIframeHtmlContent(html){
	var iframe = document.getElementById('ifrm-content'),
	    iframedoc = iframe.contentDocument || iframe.contentWindow.document;

	iframe.style.display = 'block';

	iframedoc.body.innerHTML = html;
}

function setIframeUrl(url){
	var iframe = document.getElementById('ifrm-content');
	iframe.style.display = 'block';
	iframe.src = url;
}

function removeLogin(){
	$('#login_form').remove();
}
