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

var logoutUrl = null;

function startGatewaySession(authToken, relaySocket, uid, relay) {

	var gw_socket = null, relay_socket = relaySocket, UID = uid;

	var session_token = null;

	console.log('startGatewaySession authToken:', authToken);

	gw_socket = io.connect('/', {
		path:                   '/beame-gw/socket.io',
		'force new connection': true
	});

	restartMobileRelaySocket(relaySocket, gw_socket, uid);

	gw_socket.on('error', function (e) {
		console.error('Error in gw_socket', e);
	});

	gw_socket.on('virtHostRecovery', function (data) {
		console.log('recovering virtual host:', getVUID());
		var parsedData = JSON.parse(data);
		relay_socket   = io.connect(RelayFqdn);
		relay_socket.on('connect', function () {
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
		relay_socket.on('hostRegistered', function (data) {
			console.log('Virtual host recovered');
			restartMobileRelaySocket(relay_socket, gw_socket, data.Hostname);
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

		var type = data.type, payload = data.payload, user = payload.user;

		console.log('GW data type', type);

		if (type == 'authenticated') {
			if(payload.success){
				window.getNotifManagerInstance().notify('STOP_PAIRING', null);

				session_token = payload.session_token;
				console.log('session token', session_token);

				saveUserInfoCookie(user);

				stopAllRunningSessions = true;

				removeLogin();
			}
			else{
				forceReloadWindowOnSessionFailure = true;
			}

		}

		if (type == 'updateProfile') {
			saveUserInfoCookie(user);
			return;
		}

		if (type == 'redirect' && payload.url.indexOf('beame-gw/logout') > 0) {
			// gw_socket.emit('data', {
			// 	type:    'logout',
			// 	payload: {
			// 		session_token: session_token
			// 	}
			// });
			logoutUrl = payload.url;

		}

		if (payload.html) {

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
			sendEncryptedData(relay_socket, relay_socket.beame_relay_socket_id, str2ab(JSON.stringify(data)));
		}

	});

	function restartMobileRelaySocket(mob_relay_socket, gw_sock, uid) {

		if (!mob_relay_socket) return;

		relaySocket = mob_relay_socket;

		relaySocket.removeAllListeners();

		relaySocket.on('data', function (data) {

			processMobileData(WhTMPSocketRelay, {
				'QR': null,
				'WH': null,
				'GW': gw_socket
			}, data, function (rawData) {
				var decryptedData = JSON.parse(rawData);
				console.log('relaySocket data', decryptedData);
				//TODO temp hack for testing, to be removed
				var type = decryptedData.type;

				console.log('MobileW data type', type);

				switch (type) {
					case 'mediaRequest':
						var segment = '/' + (decryptedData.payload.url).split('/').pop();
						console.log('Media request, signing:', segment);
						signArbitraryData(segment, function (error, signature) {
							if (!error) {
								//window.crypto.subtle.digest("SHA-256", signature).then(function (signHash) {
								switch (decryptedData.payload.action) {
									case ActionTypes.Photo:
										window.getNotifManagerInstance().notify('MOBILE_PHOTO_URL',
											{
												url:  decryptedData.payload.url,
												sign: arrayBufferToBase64String(signature)
											});
										return;
									case ActionTypes.Video:
										window.getNotifManagerInstance().notify('MOBILE_STREAM',
											{
												url:  decryptedData.payload.url,
												sign: arrayBufferToBase64String(signature)
											});
										return;
								}
								//});
							}
						});

						break;
					case 'loggedOut':
					    logoutUrl ?	window.location.href = logoutUrl  : logout();
						break;
					case 'logout':

						// setTimeout(function(){
						// 	logoutUrl ?	window.location.href = logoutUrl  : logout();
						// },1000*5);
						gw_socket.emit('data', decryptedData);

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

		relaySocket.on('disconnect', function () {
			console.log('mobile socket:: disconnect', relaySocket.id);
		});

		virtHostAlive = virtHostTimeout;
		keepVirtHostAlive(gw_sock);

	}

	function chooseApp(id) {
		console.log('chooseApp', id, session_token);
		gw_socket.emit('data', {
			type:    'choose',
			payload: {
				id:            id,
				session_token: session_token
			}
		});
	}


	function saveUserInfoCookie(user) {
		if (user) {

			var name = user.nickname || user.name,
			    info = {
				    name: name,
				    fqdn: user.fqdn
			    };

			document.cookie = "userinfo=" + JSON.stringify(info);
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

	console.log('*********************************SET IFRAME URL', url);
	var iframe           = document.getElementById('ifrm-content');


	if(url.indexOf('beame-gw/logout') > 0){
		return;
	}

	iframe.src           = "about:blank";

	iframe.style.display = 'block';

	iframe.src = url;
}

function removeLogin() {
	$('#login_form').remove();
}
