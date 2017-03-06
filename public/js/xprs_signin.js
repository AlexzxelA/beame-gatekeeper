/**
 * Created by Alexz on 05/03/2017.
 */

var QrTMPsocketOrigin, WhTMPSocketRelay = null;
var qrRelayEndpoint = null;
var qrContainer     = null;
var qrSession       = null;

$(document).ready(function () {
	if(delegatedUserId){
		console.log('*** Delegated ID: <', delegatedUserId, '> ***');
	}

	generateKeys();
	setQRStatus('QR initializing session');


	//noinspection ES6ModulesDependencies,NodeModulesDependencies
	var socket = io.connect("/qr", socketio_options);

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
	});


	socket.on('edgeError', function (data) {
		socket.emit('ack', 'edgeError');
		console.log('Session failed from server. Network issue.');
	});

	socket.on('startQrSession',function (data) {
		socket.emit('ack', 'startQrSession');
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

	});

	socket.on('relayEndpoint', function (data) {
		socket.emit('ack', 'relayEndpoint');
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


//window.location.host window.location.href
});




function setQRStatus(status){
	$('.qr-status').html(status);

}