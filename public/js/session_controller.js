/**
 * Created by zenit1 on 17/11/2016.
 */
"use strict";

var ActionTypes = {
	"Photo":       "photo",
	"Video":       "video",
	"ChangeState": "state",
	"Location":    "location",
	"Stream":      "stream"
};

function startGatewaySession(authToken, relaySocket, uid, relay) {

	var gw_socket = null, relay_socket = relaySocket, UID = uid;

	// xxx - start
	var xxx_session_token = null;
	// xxx - end
	console.log('startGatewaySession authToken:', authToken);
	restartMobileRelaySocket(relaySocket, uid);

	gw_socket = io.connect('/', {
		path:                   '/beame-gw/socket.io',
		'force new connection': true
	});

	gw_socket.on('error', function (e) {
		console.error('Error in gw_socket', e);
	});

	gw_socket.on('virtHostRecovery', function (data) {
		console.log('recovering virtual host:', UID);
		var parsedData  = JSON.parse(data);
		relay_socket = io.connect(relay + "/control");
		relay_socket.on('connect',function () {
			relay_socket.emit('register_server',
				{
					'payload': {
						'socketId':      null,
						'hostname':      parsedData.data,
						'signature':     parsedData.signature,
						'type':          'HTTPS',
						'isVirtualHost': true
					}
				});
		});
		relay_socket.on('hostRegistered',function (data) {
			console.log('Virtual host recovered');
			restartMobileRelaySocket(relay_socket, data.Hostname);
		});
	});

	gw_socket.once('connect', function () {

		console.info('gw_socket connected');

		gw_socket.emit('data', {
			type:    'auth',
			payload: {token: authToken}
		})

	});

	gw_socket.on('data', function (data) {
		data = JSON.parse(data);

	//	console.log('DATA %j', data);

		var session_token, apps, type = data.type, payload = data.payload, user = payload.user;

		// xxx - start
		if (type == 'authenticated' && payload.success) {

			window.getNotifManagerInstance().notify('STOP_PAIRING', null);

			xxx_session_token = payload.session_token;
			console.warn('session token', xxx_session_token);

			saveUserInfoCookie(user);
		}

		if(type == 'updateProfile'){
			saveUserInfoCookie(user);
			return;
		}

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

		if (relay_socket) {
			sendEncryptedData(relay_socket, relay_socket.beame_relay_socket_id,
				str2ab(JSON.stringify(data)));
		}

	});

	function restartMobileRelaySocket(mob_relay_socket, uid) {

		if (!mob_relay_socket) return;

		relaySocket = mob_relay_socket;

		relaySocket.removeAllListeners();

		relaySocket.on('disconnect', function () {
			console.log('mobile socket:: disconnected ', relaySocket.id);
			gw_socket.emit('virtHostRecovery',uid);
		});

		relaySocket.on('data', function (data) {

			processMobileData(WhTMPSocketRelay, {'QR':null, 'WH':null, 'GW':gw_socket}, data, function (decryptedData) {

				console.log('relaySocket data', decryptedData);
				//TODO temp hack for testing, to be removed
				 var type = decryptedData.type;

				switch (type) {
					case 'mediaRequest':
						var segment = '/'+(decryptedData.payload.url).split('/').pop();
						console.log('Media request, signing:',segment);
						signArbitraryData(segment, function (error, signature) {
							if(!error){
								//window.crypto.subtle.digest("SHA-256", signature).then(function (signHash) {
									switch (decryptedData.payload.action){
										case ActionTypes.Photo:
											window.getNotifManagerInstance().notify('MOBILE_PHOTO_URL',
												{url:decryptedData.payload.url, sign:arrayBufferToBase64String(signature)});
											return;
										case ActionTypes.Video:
											window.getNotifManagerInstance().notify('MOBILE_STREAM',
												{url:decryptedData.payload.url, sign:arrayBufferToBase64String(signature)});
											return;
									}
								//});
							}
						});

						break;
					default:
						gw_socket.emit('data', decryptedData);
						break;
				}
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
		gw_socket.emit('data', {
			type:    'choose',
			payload: {
				id:            id,
				session_token: xxx_session_token
			}
		});
	}

	function logout() {
		onStaticPageLoaded();
		gw_socket.emit('data', {
			type:    'logout',
			payload: {
				session_token: xxx_session_token
			}
		});
	}

	function saveUserInfoCookie(user){
		if (user) {

			var name = user.nickname || user.name,
			    info = {
				    name:name,
				    fqdn:user.fqdn
			    };

			document.cookie = "userinfo=" +  JSON.stringify(info);
		}
	}

}

function setIframeHtmlContent(html) {
	var iframe    = document.getElementById('ifrm-content'),
	    iframedoc = iframe.contentDocument || iframe.contentWindow.document;

	iframe.style.display = 'block';

	iframedoc.body.innerHTML = html;
}

function setIframeUrl(url) {
	var iframe           = document.getElementById('ifrm-content');
	iframe.style.display = 'block';
	iframe.src           = url;
}

function removeLogin() {
	$('#login_form').remove();
}
