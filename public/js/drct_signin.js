/**
 * Created by Alexz on 05/03/2017.
 */

var QrTMPsocketOrigin, WhTMPSocketRelay = null;

$(document).ready(function () {

	function test() {
		var c = getCookie('b3am3-1d');
		window.alert(c || 'huj');
	}
	//test();

	generateKeys();
	setQRStatus('QR initializing session');

	//noinspection ES6ModulesDependencies,NodeModulesDependencies
	var socket = io.connect("/drct", socketio_options);// || { transports: ['websocket']});

	socket.on('connect', function () {
		setOriginSocket('QR', socket);
		setQRStatus('Connected to origin');

		var UID = getCookie('b3am3-1d');//generateUID(24) + VirtualPrefix;
		window.alert(UID || 'huj');
		try{
			if (!QrTMPsocketOrigin) {
				QrTMPsocketOrigin = socket;//remove towards prod
				socket.emit('drct_browser_connected', UID);
			}
		}
		catch(e){
			window.location.href = window.location.origin;
		}

	});


	socket.on('edgeError', function (data) {
		console.log('Session failed from server. Network issue:', data);
	});


	socket.on('sessionData', function (data) {
		console.log('QR relayEndpoint', data);

		setQRStatus('Got virtual host data');
		getKeyPairs(function (error, keydata) {
			if (error) {
				console.log(error);
				return;
			}
			try {
				var parsedData = (typeof data === 'object')?data : JSON.parse(data);
				var cleanData = (parsedData.service && parsedData.appId)?parsedData:(parsedData.data)?parsedData.data:parsedData;
				cleanData = (typeof cleanData === 'object')?cleanData: JSON.parse(cleanData);
				sessionServiceData = cleanData && JSON.stringify({
						'service':cleanData.service,
						'appId': cleanData.appId});

				userImageRequired = cleanData['imageRequired'];

				importPublicKey(parsedData.pk, PK_RSAOAEP, ["encrypt"]).then(function (keydata) {
					window.alert('Imported mobile PK from origin');
					sessionRSAPK = keydata;
				}).catch(function (e) {
					console.error(e);
					//window.location.href = window.location.origin;
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