/**
 * Created by zenit1 on 25/09/2016.
 */


var QrTMPsocketRelay;
var QrTMPsocketOrigin;
var qrTmpSocketID;
var qrRelayEndpoint = null;
var qrContainer     = null;
var qrSession       = null;
var login_session   = false;
var retryCounter    = 0;

$(document).ready(function () {
	if(delegatedUserId){
		login_session = true;
		console.log('*** Delegated ID: <', delegatedUserId, '> ***');
	}

	generateKeys();

	var resetPageStatus = function(msg){
		socket.emit('ack', msg);
		retryCounter = 0;
	};

	setQRStatus('QR initializing session');
	var resetQR = function () {
		if (!qrContainer)return;
		if (qrSession) clearInterval(qrSession);
		console.log('QR read successfully - set green');
		qrContainer.empty();
		qrContainer.removeClass('qr-spinner');
		//noinspection JSUnresolvedFunction
		qrContainer.kendoQRCode({
			value:           "{\"message\":\"QR used, reload the page to get new QR\"}",
			errorCorrection: "L",
			color:           "#0F9239",
			background:      "transparent",
			padding:         0,
			size:            220
		});
	};

	window.getNotifManagerInstance().subscribe('STOP_PAIRING', resetQR, null);

	//noinspection ES6ModulesDependencies,NodeModulesDependencies
	var socket = io.connect("/qr", socketio_options);
	console.log('QR window ready');
	socket.on('connect', function () {
		setOriginSocket('QR', socket);
		setQRStatus('Connected to origin');
		console.log('QR socket connected, ', qrRelayEndpoint);
		QrTMPsocketOrigin = socket;//remove towards prod

		var UID = getVUID(socket);//generateUID(24) + VirtualPrefix;
		console.log('UID:', UID);

		if (!qrRelayEndpoint) {
			socket.emit('browser_connected', UID);
		}
		// setTimeout(function () {
		// 	socket.emit('beamePing');
		// },1000);
	});
	// socket.on('connect_failed', function () {
	// 	socket.emit('ack', 'connect_failed');
	// 	console.log('QR socket connect_failed,', qrRelayEndpoint);
	// 	if (!qrRelayEndpoint) {
	// 		socket.emit('browser_connected', UID);
	// 	}
	// });
	socket.on('edgeError', function (data) {
		resetPageStatus('edgeError');
		console.log('Session failed from server. Network issue.');
	});

	socket.on('startQrSession',function (data) {
		if(!stopAllRunningSessions){
			resetPageStatus('startQrSession');
			setQRStatus('Requesting QR data');
			console.log('Starting QR session with data:', data);
			if(data && !sessionServiceDataSign){/*do not factor out: AZ*/

				sessionServiceData = JSON.stringify({'matching':data.matching, 'service':data.service, 'appId': data.appId});

				signArbitraryData(sessionServiceData, function (err, sign) {
					if(!err){
						sessionServiceDataSign = arrayBufferToBase64String(sign);
					}
					else{
						sessionServiceDataSign = err;
					}
				});
			}

			if(!login_session && !delegatedUserId){
				setTimeout(function () {
					socket.emit('pinRequest');
				},200);

				if (!qrSession) {
					qrRefreshRate = data.refresh_rate;
					qrSession = setInterval(function () {
						console.log('QR requesting data');
						socket.emit('pinRequest');
						if(++retryCounter > 2){
							qrSession = null;
							window.location.href = window.location.origin;
						}
					}, qrRefreshRate);
				}
			}
		}
		else{
			setQRStatus('Page is expired, please reload');
			//window.location.href = window.location.origin;
		}

	});

	socket.on('pinRenew', function (data) {

		resetPageStatus('pinRenew');
		setQRStatus('');
		console.log('pinRenew:', data);
		if (stopAllRunningSessions) {
			console.log('QR session stopped from server');
			resetQR();
		}
		else if(!waitingForMobileConnection && !delegatedUserId && !login_session){
			try {
				console.log('QR! RENEW QR');
				var parsed = JSON.parse(data);
				if (parsed['data'] && keyGenerated) {
					if(reg_data && reg_data.hash){delete reg_data.hash;}
					console.log('QR Generating information packet');
					events2promise(cryptoSubtle.exportKey(exportPKtype, keyPair.publicKey))
						.then(function (keydata) {
							var PK = null;
							if(engineFlag)
								PK = jwk2pem(JSON.parse(atob(arrayBufferToBase64String(keydata))));
							else
								PK = arrayBufferToBase64String(keydata);
							//console.log('Public Key Is Ready:', PK, '==>', PK);
							if (qrRelayEndpoint.indexOf(getRelaySocket().io.engine.hostname) < 0) {
								console.log('Crap(q)::',
									qrRelayEndpoint, '..', getRelaySocket().io.engine.hostname);
								window.alert('Warning! Suspicious content, please verify domain URL and reload the page..');
							}
							else {
								var qrType = (auth_mode == "Provision")?"PROV":"LOGIN";
								var QRdata       = {
									'relay': 'https://' + qrRelayEndpoint,
									'PK': PK,
									'UID': parsed['UID'],
									'PIN':   parsed['data'],
									'TYPE': qrType,
									'TIME': Date.now(),
									'REG': reg_data || 'login',
									'appId': JSON.parse(sessionServiceData).appId
								};
								console.log('QR DATA:', QRdata);
								socket.emit('QRdata', QRdata);
								qrContainer = $('#qr');
								try {
									var dataStr = JSON.stringify(QRdata);
									if (dataStr.length > 30) {
										var qrCode = dataStr;
										console.log(qrCode);
										qrContainer.empty();
										qrContainer.removeClass('qr-spinner');
										qrContainer.kendoQRCode({
											value:           qrCode,
											errorCorrection: "L",
											color:           "#000",
											background:      "transparent",
											padding:         0,
											size:            220
										});
									}
									else {
										console.log('data is short:', dataStr.length, ', data:', data);//resend qr
									}
								}
								catch (e) {
									console.log('Invalid QR data:', data);
								}
							}

							//exampleSocket.send(JSON.stringify({'type':'key','payload':{'data':PK, 'token':
							//{'signedData':'key','signedBy':'signedBy','signature':'signature'}}}));
						})
						.catch(function (err) {
							console.error('Export Public Key Failed', err);
						});

				}
			}
			catch (e) {
				console.log('Error:', e);
			}
		}


	});

	socket.on('mobileProv1', function (data) {
		setQRStatus('Mobile session complete');
		resetPageStatus('mobileProv1');
		stopAllRunningSessions = true;
		console.log('QR mobileProv1:', data);
		if (data.data && getRelaySocket()) {
			if(!userImageRequired)
				window.getNotifManagerInstance().notify('STOP_PAIRING', null);
			sendEncryptedData(getRelaySocket(), getRelaySocketID(), str2ab(JSON.stringify(data)));
		}
		if(!userImageRequired)socket.emit('close_session');
	});

	socket.on('mobilePinInvalid', function (data) {
		setQRStatus('Session ID invalid, please retry');
		resetPageStatus('mobilePinInvalid');
		console.log('QR ***mobilePinInvalid***** Sedning:: ', msg);
		if (data.data && getRelaySocket()) {
			var msg = {'socketId': getRelaySocketID(), 'payload': JSON.stringify(data)};
			console.log('******** Sedning:: ', msg);
			getRelaySocket().emit('data', msg);
		}
	});

	socket.on('userImageSign',function (data) {
		sendEncryptedData(getRelaySocket(), getRelaySocketID(), str2ab(JSON.stringify(data)));
		window.getNotifManagerInstance().notify('STOP_PAIRING', null);
	});

	socket.on('relayEndpoint', function (data) {
		resetPageStatus('relayEndpoint');
		console.log('QR relayEndpoint', data);

			setQRStatus('Got virtual host registration token');
			getKeyPairs(function (error, keydata) {
				if (error) {
					console.log(error);
					return;
				}
				try {
					var parsedData = JSON.parse(data);
					sessionServiceData = JSON.stringify({'matching':parsedData.matching, 'service':parsedData.service, 'appId': parsedData.appId});
					userImageRequired = parsedData['imageRequired'];
					qrRelayEndpoint = parsedData['data'];

					verifyInputData('https://'+qrRelayEndpoint, function (isLoginSession) {
						login_session = isLoginSession;
						if (parsedData.delegatedLogin && !login_session && auth_mode != 'Provision') {
							window.location.href = parsedData.delegatedLogin;
						}
						connectRelaySocket(qrRelayEndpoint, parsedData['signature']);
					});
				}
				catch (e) {
					socket.emit('browserFailure', {'error': 'relay fqdn get - failed'});
					console.error('failed to parse data:', e);
				}
			});


	});

	socket.on('disconnect', function () {
		console.log('QR DISCONNECTED');
		//resetQR();
	});

	socket.on('forceRedirect', function (target) {
		window.location.href = target;
	});

	socket.on('resetQR', function () {
		resetPageStatus('resetQR');
		console.log('QR resetQR');
		resetQR();
	});

//window.location.host window.location.href
	$(window).on('resize', function () {
		if (qrContainer) {
			if (qrContainer.data("kendoQRCode")) qrContainer.data("kendoQRCode").redraw();
		}
	});
});


function initRelay(socket) {
	var UID = 'UID';
	QrTMPsocketRelay.on('disconnect', function () {
		setQRStatus('Virtual host disconnected');
		console.log('QR relay disconnected, ID = ', QrTMPsocketRelay.id);
		socket.emit('virtSrvConfig', UID);
	});

	QrTMPsocketRelay.on('data', function (data) {
		console.log('QR relay data');
		qrTmpSocketID = data.socketId;
		processMobileData(QrTMPsocketRelay, QrTMPsocketOrigin, data);
		QrTMPsocketRelay.beame_relay_socket_id = data.socketId;

	});

	QrTMPsocketRelay.on('create_connection', function () {
		console.log('create_connection, ID = ', QrTMPsocketRelay.id);
	});

	QrTMPsocketRelay.on('hostRegistered', function (data) {
		UID = data.Hostname;
		console.log('QR hostRegistered, ID = ', QrTMPsocketRelay.id, '.. hostname: ', data.Hostname);
		setQRStatus('Virtual host registration complete');
		socket.emit('virtSrvConfig', UID);
		//noinspection JSUnresolvedFunction,JSUnresolvedVariabl
	});

	QrTMPsocketRelay.on('error', function () {
		console.log('QR error, ID = ', QrTMPsocketRelay.id);
	});

	QrTMPsocketRelay.on('_end', function () {
		console.log('QR end, ID = ', QrTMPsocketRelay.id);
	});
}

function setQRStatus(status){
	$('.qr-status').html(status);

}