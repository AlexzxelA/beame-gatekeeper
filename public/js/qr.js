/**
 * Created by zenit1 on 25/09/2016.
 */




var sessionAESkey;
var sessionIV;
var QrTMPsocketRelay;
var QrTMPsocketOrigin;
var qrTmpSocketID;
var qrRelayEndpoint = "";
var qrContainer     = null;
var qrSession       = null;
var matchingFqdn    = null;
var serviceName     = null;

$(document).ready(function () {

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

	var UID = generateUID(24) + VirtualPrefix;
	console.log('UID:', UID);

	//noinspection ES6ModulesDependencies,NodeModulesDependencies
	var socket = io.connect("/qr", socketio_options);
	console.log('QR window ready');
	socket.on('connect', function () {
		console.log('QR socket connected, ', qrRelayEndpoint);
		QrTMPsocketOrigin = socket;//remove towards prod
		if (!qrRelayEndpoint) {
			socket.emit('browser_connected', UID);
		}
	});
	socket.on('connect_failed', function () {
		socket.emit('ack', 'connect_failed');
		console.log('QR socket connect_failed,', qrRelayEndpoint);
		QrTMPsocketOrigin = socket;//remove towards prod
		if (!qrRelayEndpoint) {
			socket.emit('browser_connected', UID);
		}
	});
	socket.on('edgeError', function (data) {
		socket.emit('ack', 'edgeError');
		console.log('Session failed from server. Network issue.');
	});

	socket.on('startQrSession',function (data) {
		console.log('Starting QR session with data:', data);
		if(data){
			matchingFqdn = data.matching || matchingFqdn;
			serviceName  = data.service || serviceName;
		}
		socket.emit('ack', 'startQrSession');
		socket.emit('pinRequest');
		if (!qrSession) {
			qrSession = setInterval(function () {
				console.log('QR requesting data');
				socket.emit('pinRequest');
			}, data.refresh_rate);
		}
	});

	socket.on('pinRenew', function (data) {
		socket.emit('ack', 'pinRenew');
		console.log('pinRenew:', data);
		if (stopAllRunningSessions) {
			console.log('QR session stopped from server');
			resetQR();
		}
		else {
			try {
				console.log('QR! RENEW QR');
				var parsed = JSON.parse(data);
				if (parsed['data'] && keyGenerated) {
					console.log('QR Generating information packet');
					window.crypto.subtle.exportKey('spki', keyPair.publicKey)
						.then(function (keydata) {
							var PK = arrayBufferToBase64String(keydata);
							//console.log('Public Key Is Ready:', PK, '==>', PK);
							if (qrRelayEndpoint.indexOf(QrTMPsocketRelay.io.engine.hostname) < 0) {
								console.log('Crap(q)::',
									qrRelayEndpoint, '..', QrTMPsocketRelay.io.engine.hostname);
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
									'matching': matchingFqdn,
									'service' : serviceName
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
		socket.emit('ack', 'mobileProv1');
		stopAllRunningSessions = true;
		console.log('QR mobileProv1:', data);
		if (data.data && QrTMPsocketRelay) {
			window.getNotifManagerInstance().notify('STOP_PAIRING', null);
			var msg = {'socketId': qrTmpSocketID, 'payload': JSON.stringify(data)};
			console.log('QR ******** Sending:: ', msg);
			QrTMPsocketRelay.emit('data', msg);
		}
		socket.emit('close_session');
	});

	socket.on('mobilePinInvalid', function (data) {
		socket.emit('ack', 'mobilePinInvalid');
		console.log('QR ***mobilePinInvalid***** Sedning:: ', msg);
		if (data.data && QrTMPsocketRelay) {
			var msg = {'socketId': qrTmpSocketID, 'payload': JSON.stringify(data)};
			console.log('******** Sedning:: ', msg);
			QrTMPsocketRelay.emit('data', msg);
		}
	});

	socket.on('relayEndpoint', function (data) {
		socket.emit('ack', 'relayEndpoint');
		console.log('QR relayEndpoint', data);
		generateKeyPairs(function (error, keydata) {
			if (error) return;//send error to origin/show on browser
			if (!keyGenerated) {
				keyPair      = keydata.keyPair;
				keyPairSign  = keydata.keyPairSign;
				keyGenerated = true;
			}
			try {
				var parsedData  = JSON.parse(data);
				qrRelayEndpoint = parsedData['data'];
				var lclTarget   = "https://" + qrRelayEndpoint + "/control";
				if (qrRelayEndpoint) {
					//noinspection ES6ModulesDependencies,NodeModulesDependencies
					QrTMPsocketRelay = io.connect(lclTarget);
					QrTMPsocketRelay.on('connect', function () {
						console.log('Connected, ID = ', QrTMPsocketRelay.id);
						QrTMPsocketRelay.emit('register_server',
							{
								'payload': {
									'socketId':      null,
									'hostname':      UID,
									//'signedData':UID,
									'signature':     parsedData['signature'],
									//'signedBy':window.location.hostname,
									'type':          'HTTPS',
									'isVirtualHost': true
								}
							});
						initRelay(socket);
					});
				}
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

	socket.on('resetQR', function () {
		socket.emit('ack', 'resetQR');
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

	QrTMPsocketRelay.on('disconnect', function () {
		console.log('QR relay disconnected, ID = ', QrTMPsocketRelay.id);
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
		console.log('QR hostRegistered, ID = ', QrTMPsocketRelay.id, '.. hostname: ', data.Hostname);

		socket.emit('virtSrvConfig', data.Hostname);
		//noinspection JSUnresolvedFunction,JSUnresolvedVariabl
	});

	QrTMPsocketRelay.on('error', function () {
		console.log('QR error, ID = ', QrTMPsocketRelay.id);
	});

	QrTMPsocketRelay.on('_end', function () {
		console.log('QR end, ID = ', QrTMPsocketRelay.id);
	});
}
