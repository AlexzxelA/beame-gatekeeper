/**
 * Created by Alexz on 05/03/2017.
 */

var QrTMPsocketOrigin, WhTMPSocketRelay = null;
var qrRelayEndpoint = null;
var qrContainer     = null;
var qrSession       = null;
var sessionParams   = {};

$(document).ready(function () {
	if(delegatedUserId){
		console.log('*** Delegated ID: <', delegatedUserId, '> ***');
	}

	function test() {
		var algorithm = {
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: "2048",
			publicExponent: new Uint8Array([1, 0, 1]), // 2^16 + 1 (65537)
			hash: "SHA-512"
		};
		events2promise(cryptoSubtle.generateKey(algorithm, true, ['sign'])).then(function (generated) {
			console.log('Generated: ', generated);
			cryptoSubtle.exportKey('jwk', generated.publicKey || generated).then(function (key) {
				console.log('HUJ:::',key);
			}).catch(function (e) {
				console.error('Uebalis',e);
			});
		});

	}
	test();

	generateKeys();
	setQRStatus('QR initializing session');


	//noinspection ES6ModulesDependencies,NodeModulesDependencies
	var socket = io.connect("/qr", socketio_options || { transports: ['websocket']});

	socket.on('connect', function () {
		setOriginSocket('QR', socket);
		setQRStatus('Connected to origin');
		console.log('QR socket connected, ', qrRelayEndpoint);
		QrTMPsocketOrigin = socket;//remove towards prod

		var UID = getVUID();//generateUID(24) + VirtualPrefix;
		console.log('UID:', UID);
		try{
			var parsed = JSON.parse(delegatedUserId);
			sessionParams = {'uid':parsed.uid, 'relay':parsed.relay};
			var dataX = JSON.parse(parsed.token).signedData;
			if (!qrRelayEndpoint) {
				socket.emit('xprs_browser_connected', {uid:parsed.uid, token:JSON.parse(parsed.token).signedData.data});
			}
		}
		catch(e){
			window.location.href = window.location.origin;
		}

	});


	socket.on('edgeError', function (data) {
		socket.emit('ack', 'edgeError');
		console.log('Session failed from server. Network issue:', data);
	});

	socket.on('startQrSession',function (data) {
		socket.emit('ack', 'startQrSession');
		setQRStatus('Requesting data');
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

		setQRStatus('Got virtual host data');
		getKeyPairs(function (error, keydata) {
			if (error) {
				console.log(error);
				return;
			}
			try {
				var parsedData = (typeof data === 'object')?data : JSON.parse(data);
				var cleanData = (parsedData.data)?parsedData.data:parsedData;
				cleanData = (typeof cleanData === 'object')?cleanData: JSON.parse(cleanData);
				sessionServiceData = cleanData && JSON.stringify({
						'matching':cleanData.matching,
						'service':cleanData.service,
						'appId': cleanData.appId});

				userImageRequired = cleanData['imageRequired'];
				qrRelayEndpoint = sessionParams.relay || cleanData;
				if(!sessionParams || sessionParams && !sessionParams.uid) {
					verifyInputData('https://' + qrRelayEndpoint, function () {
						connectRelaySocket(qrRelayEndpoint, cleanData['signature']);
					});
				}
				else{
					importPublicKey(parsedData.pk, PK_RSAOAEP, ["encrypt"]).then(function (keydata) {
						console.log('Successfully imported mobile PK from origin');
						sessionRSAPK = keydata;
						connectRelaySocket(qrRelayEndpoint, cleanData['signature'], sessionParams.uid);
					}).catch(function (e) {
						console.error(e);
						//window.location.href = window.location.origin;
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

	socket.on('forceRedirect', function (target) {
		window.location.href = target;
	});


//window.location.host window.location.href
});




function setQRStatus(status){
	$('.qr-status').html(status);

}