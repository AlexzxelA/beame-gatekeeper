/**
 * Created by Alexz on 15/04/2017.
 */
//*********** crypto **********

var cryptoObj = window.crypto || window.msCrypto,
	cryptoSubtle = cryptoObj.subtle || cryptoObj.webkitSubtle;
const frameSize = 1024;
var sessionServiceData     = null;
var	originTmpSocket, cmdIframe, userImageRequested = false, userData, temporaryBuffer, numDataChunks;

function events2promise(promise_or_operation) {
	if (promise_or_operation instanceof Promise) {
		return promise_or_operation;
	}
	return new Promise(function(resolve, reject) {
		promise_or_operation.onerror = reject;
		promise_or_operation.oncomplete = function operation_complete_cb(e) {
			resolve(e.target.result);
		}
	});
}

function passData2Mobile(type, cipheredData, ndx, cb) {

	var data2send = (cipheredData)?arrayBufferToBase64String(cipheredData):null;
	if(cmdIframe){
		cmdIframe.parentNode.removeChild(cmdIframe);
		cmdIframe = null;
	}
	if(ndx){
		ndx-=1;
		var startNdx = (numDataChunks - ndx)*frameSize;
		var chunkLength = temporaryBuffer.length - startNdx > frameSize?frameSize: temporaryBuffer.length - startNdx;
		data2send = temporaryBuffer.substring(startNdx, startNdx + chunkLength);
	}
	else if(data2send){
		temporaryBuffer = data2send;
		numDataChunks =  Math.round(data2send.length / frameSize - 0.5001);
		if(numDataChunks > 0)
			data2send = data2send.substring(0, frameSize);
		ndx = numDataChunks;
	}
	else{
		temporaryBuffer = null;
		numDataChunks = 0;
		cb && cb();
		return;
	}
	if(data2send && data2send.length){
		//window.alert('Sending to mobile: '+type+' '+data2send.length);
		cmdIframe = document.createElement("iframe");
		cmdIframe.setAttribute("src", "beame-call://?" + ndx + '//?' + data2send);
		document.body.appendChild(cmdIframe);
	}
	cb && cb();
}

function sendEncryptedData(x1, x2, data, cb) {

	passData2Mobile('external data', data);
	cb && cb();

}

function str2ab(str) {
	var buf     = new ArrayBuffer(str.length);//* 2); // 2 bytes for each char
	var bufView = new Uint8Array(buf);//Uint16Array(buf);
	for (var i = 0, strLen = str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
}

function initDirectCryptoSession( data, decryptedData) {

	setQRStatus('...Got message from mobile, initializing session');

	if (!userImageRequested) {
		userImageRequested = true;
		switch (auth_mode) {

			case 'Session':
				validateSession(userImageRequired).then(function () {
					if(getCookie('usrInData')){
						setCookie('usrInData',
							JSON.stringify({token:decryptedData.payload.token,uid:getVUID()}), 0.24);
					}
					userImageRequested = false;
					originTmpSocket.emit('_disconnect');
					userData = decryptedData.userID;
					startGatewaySession(decryptedData.token, userData, null, decryptedData.uid);
				}).catch(function (e) {
					userImageRequested = false;
					window.alert('Session failure X: image validation:'+e);
				});
				return;

			default:
				window.alert('Unknown Auth mode');
				allowLogout && logout();
				return;
		}
	}
}

function initDrctSession(socket) {
	originTmpSocket = socket;
}

function sha256(data) {
	try{
		return events2promise(cryptoSubtle.digest("SHA-256", str2ab(data))).then(function (hash) {
			return arrayBufferToBase64String(hash);
		}).catch(function (e) {
			window.alert('sha256 failed:' + e);
		});
	}
	catch(e){
		window.alert('hash error:'+e);
	}

}

function processMobileData(TMPsocketRelay, data, cb) {

	var type          = data.data.type;

	var encryptedData = data.data;
	var decryptedData = encryptedData.payload;//direct session is open between native app and browser


	function onMessageDecryptedData(err, decryptedDataB64) {

		if (!err) {
			var decryptedData = typeof decryptedDataB64 === 'object'?decryptedDataB64: JSON.parse(decryptedDataB64);
			switch (decryptedData.type){
				case 'beamePing':
					passData2Mobile('beamePong',str2ab(JSON.stringify(
						{'type':'beamePong'}
					)));
					break;
				case 'userImage':
				case 'sessionData':
					try {

						var parsedData = (typeof decryptedData === 'object')? decryptedData:JSON.parse(decryptedData);
						if (parsedData.type && parsedData.type === 'userImage') {
							if(parsedData.payload)parsedData = parsedData.payload;
							var src       = 'data:image/jpeg;base64,' + parsedData.image;

							sha256(parsedData.image).then(function(imageData){

								userData = parsedData.userID;

								originTmpSocket.emit('userImageVerify', JSON.stringify({
									'signedData': imageData,
									'signature':  parsedData.imageSign,
									'signedBy':   parsedData.imageSignedBy,
									'userID':     parsedData.userID
								}));

								originTmpSocket.on('userImageStatus', function (status) {
									setQRStatus('User image verification: '+status);
									if (status === 'pass' && src) {
										window.getNotifManagerInstance().notify('SHOW_USER_IMAGE',
											{
												src:       src,
												imageData: imageData,
												userID:    parsedData.userID
											});
									}
									else {
										onUserAction(false);
									}
								});

							}).catch(function(error){
								window.alert('userImage error: '+error);
							});
						}
					}
					catch (e) {
						console.error(e);
					}
					break;
				default:
					setQRStatus('Got unexpected data:' + decryptedData);
			}
		}
		else {
			console.log('failed to decrypt session data');
			passData2Mobile('session data error',str2ab(JSON.stringify({
				'type': 'error',
				'payload':  'failed to decrypt session_data'
			})));
		}

	}
	function onMessageDecryptedToken(err, decryptedDataB64) {
		if (!err) {
			decryptedData = (typeof decryptedDataB64 === 'object')?decryptedDataB64: JSON.parse(atob(decryptedDataB64));
			initDirectCryptoSession(null, decryptedData);

			//cb && cb(decryptedData);
		}
		else {
			window.alert('failed to decrypt login token');
			passData2Mobile('login token error',str2ab(JSON.stringify({
				'type': 'error',
				'payload':  'failed to decrypt mobile PK'
			})));
		}

	}

	switch (type) {
		case 'msg_ack':
			cmdIframe.parentNode.removeChild(cmdIframe);
			cmdIframe = null;
			return;
		case 'userImage':
			decryptMobileData((encryptedData), null, null, onMessageDecryptedData);
			break;
		case 'login_token':
			setQRStatus('Got login token');
			if(decryptedData.token && decryptedData.uid)
				onMessageDecryptedToken(null, decryptedData);
			//decryptMobileData((encryptedData), null, null, onMessageDecryptedToken);
			return;
		case 'restart_pairing':
			window.location.reload();
			break;
		case 'session_data':
			decryptMobileData((encryptedData), null, null, onMessageDecryptedData);
			break;
		case 'choose':
		case 'logout':
		case 'loggedOut':
			processInSessionDataFromMobile(encryptedData);
			break;
		default:
			setQRStatus('unknown payload type for Beame-Login' + type);
			return;
	}
}

function decryptMobileData(msgParsed, encryption, SK, cb) {
	try {

			cb(null, msgParsed);

	}
	catch (e) {
		cb(e, null);
	}
}


function arrayBufferToBase64String(arrayBuffer) {
	var byteArray  = new Uint8Array(arrayBuffer);
	var byteString = '';
	for (var i = 0; i < byteArray.byteLength; i++) {
		byteString += String.fromCharCode(byteArray[i]);
	}
	return btoa(byteString);
}