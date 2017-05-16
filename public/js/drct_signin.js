/**
 * Created by Alexz on 05/03/2017.
 */


var DrctTMPSocketOrigin, WhTMPSocketRelay = null, drctSessionId, sessionServiceData, userImageRequired;

$(document).ready(function () {

	//if(stopAllRunningSessions)return;
	var socket = io.connect("/drct", socketio_options);
		socket.on('connect', function () {

			setQRStatus('Connected to origin');

			drctSessionId = getCookie('b3am3-1d');//generateUID(24) + VirtualPrefix;

			try{
				if (!DrctTMPSocketOrigin) {
					initDrctSession(socket);
					DrctTMPSocketOrigin = socket;//remove towards prod
					socket.emit('drct_browser_connected', drctSessionId);
				}
			}
			catch(e){
				window.alert('Exception'+e);
				window.location.href = window.location.origin;
			}

		});


		socket.on('edgeError', function (data) {
			console.log('Session failed from server. Network issue:', data);
		});

		socket.on('hujPopadew', function (data) {
			processDrctMessage(data);
		});

		socket.on('sessionData', function (data) {
			console.log('QR relayEndpoint', data);

			setQRStatus('Got session data');

			try {
				var parsedData = (typeof data === 'object')?data : JSON.parse(data);
				var cleanData = (parsedData.service && parsedData.appId)?parsedData:(parsedData.data)?parsedData.data:parsedData;
				cleanData = (typeof cleanData === 'object')?cleanData: JSON.parse(cleanData);
				userImageRequired = cleanData['imageRequired'];
				if(userImageRequired){
					//window.alert('Direct session not allowed: image validation');
					//logout();
				}
				if(cleanData && !sessionServiceData){/*do not factor out: AZ*/
					sessionServiceData = JSON.stringify({
						'service':cleanData.service,
						'appId': cleanData.appId});

					passData2Mobile('directRequest',str2ab(JSON.stringify({type:'directRequest',
						'appId' : cleanData.appId,
						'token':   cleanData.sign, 'PIN': drctSessionId
					})));
				}


			}
			catch (e) {
				socket.emit('browserFailure', {'error': 'relay fqdn get - failed'});
				setQRStatus('failed to parse data:' + e);
			}


		});

		socket.on('disconnect', function () {
			setQRStatus('Session handled by GW');
			//resetQR();
		});

		socket.on('beamePong', function () {
			// setQRStatus('beamePong');
			// setTimeout(function () {
			// 	socket.emit('beamePing');
			// 	setQRStatus('beamePing');
			// },1000);
		});

		socket.on('forceRedirect', function (target) {
			window.alert('forced Redirect:'+target);
			window.location.href = target;
		});
	});


function processDrctMessage(msg) {
	if(stopAllRunningSessions && DrctTMPSocketOrigin && DrctTMPSocketOrigin.connected){
		DrctTMPSocketOrigin.disconnect();
	}
	msg.length>128?console.log('processDrctMessage: ' + msg.length):console.log('processDrctMessage: ' + msg);
	var parsed = (typeof msg === 'object')?msg: JSON.parse(msg);
	processMobileData(null, (parsed));
}


function setQRStatus(status){

	$('.qr-status').html(status);

}