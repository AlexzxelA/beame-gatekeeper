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

var logoutUrl = null,
	logoutTimeout = null,
	gwloginTarget,
	gwloginRelay,
	gw_socket = null,
	isDirectSession,
	samlRequest = getParameterByName('SAMLRequest'),
	relayState = getParameterByName('RelayState'),
	reinitSessionSockets = null;


function startGatewaySession(authToken, userData, relaySocket, uid, isDirect) {

	setQRStatus('starting GatewaySession');
	isDirectSession = isDirect;
	var relay_socket = relaySocket;

	var session_token = null;


	window.getNotifManagerInstance().subscribe('CLOSE_SESSION', function(){

		var data = {
			type:'redirect',
			payload:{
				'logout':true,
				'sucess':true
				}
		};

		sendEncryptedData(relay_socket, relay_socket.beame_relay_socket_id, str2ab(JSON.stringify(data)));

		setTimeout(window.cefManager.reload,200);
	});

	try {
		console.log('startGatewaySession authToken:', authToken);

		gw_socket = io.connect('/', {
			path:                   '/beame-gw/socket.io'
			// ,
			// 'force new connection': true
		});

		restartMobileRelaySocket(relaySocket, gw_socket, uid);

		gw_socket.on('error', function (e) {
			console.error('Error in gw_socket', e);
		});

		gw_socket.on('virtHostRecovery', function (data) {
			if(reinitSessionSockets){
				clearInterval(reinitSessionSockets);
				reinitSessionSockets = null;
			}
			console.log('recovering virtual host:', getVUID(),' : ',data);
			var parsedData = JSON.parse(data);
			parsedData && connectRelaySocket(getRelayFqdn(), parsedData.signature, getVUID(), 5);

		});

		gw_socket.once('connect', function () {

			console.log('gw_socket connected'+gw_socket.id);

			gw_socket.emit('data', {
				type:    'auth',
				payload: {
					token:    authToken,
					userData: userData,
					SAMLRequest: samlRequest,
					RelayState: relayState
				}
			})

		});

		gw_socket.on('tokenVerified', function (data) {
			console.log('tokenVerified', data);
			var parsed = JSON.parse(data);
			console.log('tokenVerified:',parsed,'..loginTarget:',gwloginTarget,'..loginRelay:',gwloginRelay);
			if(parsed.success){
				var l;
				if(parsed.token && gwloginTarget && gwloginRelay){
					 l = 'https://' + parsed.target + "?usrInData=" +
						encodeURIComponent(window.btoa(JSON.stringify({token:parsed.token,uid:gwloginTarget, relay:gwloginRelay})));
				}
				else{
					 l = 'https://' + parsed.target + "?usrInData=" +
						encodeURIComponent(window.btoa(JSON.stringify({token:parsed.token})));
				}
				window.top.location = l;

			}
			else{
				console.log('Token validation failed, or invalid session data:',parsed.error);
			}
		});

		gw_socket.on('disconnect', function () {
			console.log('GW disconnected');
		});

		gw_socket.on('reconnect', function () {
			console.log('GW reconnected:'+gw_socket.id);
		});

		gw_socket.on('data', function (data) {
			data = JSON.parse(data);
			console.log('GW data type', data);
			var type = data.type, payload = data.payload, user = payload.users;

			if (type === 'authenticated') {
				if (payload.success) {
					stopAllRunningSessions = true;
					window.getNotifManagerInstance().notify('STOP_PAIRING', null);

					session_token = payload.session_token;
					console.log('session token', session_token);

					saveUserInfoCookie(user);
					console.log('Pairing completed. Session started.');

					if (payload.userData) {

						try {
							cefManager.notifyUserData(JSON.parse(payload.userData));
						} catch (e) {
						}
					}

					removeLogin();
				}
				else {
					var e = (payload.error && payload.error!=='undefined')?payload.error:'Login failed';
					sendEncryptedData(getRelaySocket(), getRelaySocketID(),
						str2ab(JSON.stringify({'type': 'autheticated', 'payload':{'error':e}})),
						function () {
							forceReloadWindowOnSessionFailure = true;
							window.alert(e);
						});
				}

			}

			if (type === 'updateProfile') {
				saveUserInfoCookie(user);
				return;
			}

			if (type === 'redirectTopWindow' && payload.url){
				var target = payload.url;
				sendEncryptedData(getRelaySocket(), getRelaySocketID(),
					str2ab(JSON.stringify({'type': 'redirect', 'payload':{'forceLogout':true}})),
				function () {
					window.top.location = target;
				});
			}

			if (type === 'redirect' && payload.url.indexOf('beame-gw/logout') > 0) {
				// gw_socket.emit('data', {
				// 	type:    'logout',
				// 	payload: {
				// 		session_token: session_token
				// 	}
				// });
				logoutUrl = payload.url;
				var safetyCounter = 10;
				logoutTimeout = setInterval(function () {
					if(safetyCounter-- <= 0){
						clearInterval(logoutTimeout);
						logoutUrl ? window.location.href = logoutUrl : logout();
					}
				}, 1000);
			}

			if (payload.samlHtml) {
				setCookie('BeameSSOsession',payload.SSOsessionId, 0.24);
				var onDataSent = function () {
					setTimeout(function () {
						document.write(payload.samlHtml);
						console.log('onDataSent: page rewritten');
						document.close();
					}, 0.1);
				};
				var cmdData = {"type":"redirect", "payload":{"success":true, "samlSession":true}};
				relay_socket?sendEncryptedData(relay_socket, relay_socket.beame_relay_socket_id,
					str2ab(JSON.stringify(cmdData)), onDataSent()):
					drctSessionId?passData2Mobile(type || 'gw data', str2ab(JSON.stringify(cmdData), undefined, onDataSent())):window.alert('Invalid app state');
				return;
			}
			else if (payload.html) {

				setIframeHtmlContent(payload.html);
				// Happens on 'authenticated' type event
				// Show full screen div with payload.html
				delete payload.html;
			}
			else if (payload.url) {
				setIframeUrl(payload.url);
				// Redirect the main frame to payload.url
				if(!payload.external) {
					delete payload.url;
				}
			}

			if (relay_socket) {
				console.log('******** sendEncryptedData ', data);
				sendEncryptedData(relay_socket, relay_socket.beame_relay_socket_id, str2ab(JSON.stringify(data)));
			}
			else if(drctSessionId){
				passData2Mobile(type || 'gw data', str2ab(JSON.stringify(data)))
			}

		});
	} catch (e) {
		console.error(e);
	}

	window.getNotifManagerInstance().subscribe('RELAY_CONNECTION_RECOVERED', function (newSocket) {
		restartMobileRelaySocket(newSocket, gw_socket);
		gw_socket.emit(JSON.stringify({type:'beamePing',id:'1'}));
	});
	//window.getNotifManagerInstance().subscribe('SHOW_USER_IMAGE', onUserImageReceived);

	function restartMobileRelaySocket(mob_relay_socket, gw_sock, uid) {

		if (!mob_relay_socket) return;
		if(relaySocket)relaySocket.removeAllListeners();
		relay_socket = mob_relay_socket;
		relaySocket = mob_relay_socket;
		relaySocket.removeAllListeners();

		relaySocket.on('data', function (data) {
			relaySocket.beame_relay_socket_id = data.socketId;
			processMobileData(relaySocket, {
				'QR': null,
				'WH': null,
				'GW': gw_socket
			}, data, function (rawData) {
				console.log('processMobileData: relaySocket data', rawData);
				processInSessionDataFromMobile(rawData, relaySocket);
			});
		});

		relaySocket.on('error', function () {
			console.log('mobile socket:: error', relaySocket.id);
		});

		relaySocket.on('_end', function () {
			console.log('mobile socket:: end', relaySocket.id);
		});

		relaySocket.on('disconnect', function () {//connection dropped by network, trying to reconnect
			console.log('mobile socket:: disconnected from GW. Reconnecting..', RelayFqdn);
			if(!reinitSessionSockets){
				reinitSessionSockets = setInterval(function () {
					gw_socket.connected && gw_socket.emit('browser_connected', getVUID());
				}, 1500);
			}
			// gw_socket.emit('browser_connected', getVUID());
			// connectRelaySocket(null, null, null, 10);//default is 10 retries for 2 seconds. 2 + 10 * 20 seconds
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

			document.cookie = "beame_userinfo=" + JSON.stringify(info)+ ";path=/";
		}
	}

}

function verifyGwSocket(cb) {
	if(gw_socket && !gw_socket.connected){
		gw_socket.connect();
		var safetyCounter = 10;
		var gwVerification = setInterval(function () {
			if(safetyCounter--<=0 || gw_socket.connected){
				clearInterval(gwVerification);
				cb && cb(safetyCounter);
			}

		}, 0.25);
	}
	else
		cb && cb(10);
}

function processInSessionDataFromMobile(rawData, relay_socket) {
	verifyGwSocket(function (succeeded) {
		var decryptedData = (typeof rawData === 'object')?rawData:JSON.parse(rawData);

		//TODO temp hack for testing, to be removed
		var type = decryptedData.type;

		console.log('MobileW data type', type);
		switch (type) {
			case 'appCommand':
				// window.getNotifManagerInstance().notify('RASP_CMD',
				// 	{
				// 		cmd:decryptedData.payload.data.cmd
				// 	});
				break;
			case 'new_session_init':
				console.log('Requested new session with:',decryptedData.payload);

				var parsed = decryptedData.payload;
				//var parsedToken = JSON.parse(parsed.token);
				gw_socket.emit('verifyToken', parsed.token);
				gwloginRelay = parsed.relay;
				gwloginTarget = parsed.uid;
				// var l = 'https://' + parsedToken.signedData.data + "/beame-gw/xprs-signin?usrInData=" +
				// 	encodeURIComponent(window.btoa(JSON.stringify({token:parsed.token, uid:parsed.uid, relay:parsed.relay, renew:true})));
				// window.top.location = l;
				break;
			case 'mediaRequest':
				sendEncryptedData(relay_socket, relay_socket.beame_relay_socket_id,
					str2ab(JSON.stringify({type:'redirect', payload:{'success':true}})));
				var segment = '/' + (decryptedData.payload.url).split('/').pop();
				console.log('Media request, signing:', segment);
				signArbitraryData(segment, function (error, signature) {
					if (!error) {
						//window.crypto.subtle.digest("SHA-256", signature).then(function (signHash) {
						switch (decryptedData.payload.action) {
							case ActionTypes.Photo:
								cefManager.changeState(1);

								setTimeout(function () {
										window.getNotifManagerInstance()
											.notify('MOBILE_PHOTO_URL',
												{
													url:  decryptedData.payload.url,
													sign: arrayBufferToBase64String(signature)
												});
									},
									300);
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
				logoutTimeout && clearInterval(logoutTimeout);
				logoutUrl ? window.location.href = logoutUrl : logout();
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

}

function setIframeHtmlContent(html) {
	console.warn('setIframeHtmlContent >>>>> '+ html.charCodeAt(0) + ' ' + html.charCodeAt(1) + ' ' + html.charCodeAt(2));
	var iframe    = document.getElementById('ifrm-content'),
	    iframedoc = iframe.contentDocument || iframe.contentWindow.document;

	iframe.style.display = 'block';

	iframedoc.body.innerHTML = html;

}

function setIframeUrl(url) {

	console.log('*********************************SET IFRAME URL', url);
	var top = null;
	if(url.indexOf('choose-app')>0 && false){//prepared to open in new window
		 top=window.top.open(
			url,
			'_blank'
		);
		top && top;
	}
	if(!top){
		var iframe = document.getElementById('ifrm-content'),
		    card = document.getElementById('iframe-neighbor');

		if (url.indexOf('beame-gw/logout') > 0) {
			return;
		}

		iframe.src = "about:blank";

		iframe.style.display = 'block';
		card.style.display = 'none';

		iframe.src = url;
	}

}

function removeLogin() {
	$('#login_form').remove();
}
