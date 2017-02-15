/**
 * Created by Alexz on 07/02/2017.
 */
const onPairedTimeout = 60000;//ms
var BITS_PER_WORD = 21;

var twoPi    = 6.28318530718;
var M_PI     = 3.14159265359;
var SR       = 44100;
var BIT0     = 17915;
var BIT1     = 18088;
var SYNC     = 17743;
var BIT_N    = 500;
var SHRT_MAX = 32767;
var audio,
	audioData,
	UID = null,
	RelayEndpoint,
	tmpHostArr=[],
	activeHosts = [],
	tmpHostNdx,
	pinRefreshRate,
	pairingSession,
	fullQrData,
	activeHost,
	tryToReconnect;

var bpf = [
	0.0054710543943477024,
	0.0040547458902157885,
	-0.0057670040125701975,
	-0.000420269477858772,
	0.0083101449460656479,
	-0.0094316312494859555,
	-0.00085337467579393997,
	0.019321089254230747,
	-0.036056446386691504,
	0.040575570927701025,
	-0.029111316718296438,
	0.0080225908019748802,
	0.0095672258114302307,
	-0.012393545345772288,
	-0.00043827074789732316,
	0.017048643633703134,
	-0.01908717711488702,
	-0.0062134875220540703,
	0.055444310421910982,
	-0.10711531788392055,
	0.13101476589622019,
	-0.10461944562931368,
	0.027517583158123228,
	0.074901277896690002,
	-0.16164355055964638,
	0.19552580900922636,
	-0.16164355055964638,
	0.074901277896690002,
	0.027517583158123228,
	-0.10461944562931368,
	0.13101476589622019,
	-0.10711531788392055,
	0.055444310421910982,
	-0.0062134875220540703,
	-0.01908717711488702,
	0.017048643633703134,
	-0.00043827074789732316,
	-0.012393545345772288,
	0.0095672258114302307,
	0.0080225908019748802,
	-0.029111316718296438,
	0.040575570927701025,
	-0.036056446386691504,
	0.019321089254230747,
	-0.00085337467579393997,
	-0.0094316312494859555,
	0.0083101449460656479,
	-0.000420269477858772,
	-0.0057670040125701975,
	0.0040547458902157885,
	0.0054710543943477024
];

var startingSession = setInterval(function () {
	if(keyGenerated){
		clearInterval(startingSession);
	}
	else if(!keyGenBusy){
		try {
			generateKeys();
		}
		catch (e){
			//nop
		}
	}
}, 100);

var getWAV = function (pin) {

	try {
		var binaryMsg      = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
			msgWithHamming = [],
			message        = [],
			filteredMessage, i, j,
			dbgMsg         = "",
			digIn          = pin,
			dig            = [];

		dig[0] = 5;
		dig[3] = digIn[0];
		dig[2] = digIn[1];
		dig[1] = digIn[2];
		dig[4] = 5;
		dig[7] = digIn[3];
		dig[6] = digIn[4];
		dig[5] = digIn[5];

		message.push.apply(message, _setBit(SYNC, -M_PI / 2, 1050, 0));

		var iWord;
		var iOdd = 0, iEven = 0, iBit = 0;
		for (iWord = 0; iWord < 2; iWord++) {
			dbgMsg         = "";
			//var iOdd=0, iEven=0, iBit=0;
			dig[iWord * 4] = 0;
			for (j = 1; j < 4; j++) {
				dbgMsg += ">> " + dig[j + iWord * 4];
				for (i = 0; i < 4; i++) {
					//noinspection JSBitwiseOperatorUsage
					if ((dig[j + iWord * 4] >> i) & 1) {
						//noinspection JSBitwiseOperatorUsage
						if (iBit & 0x1)
							iOdd++;
						else
							iEven++;
					}
					iBit++;
				}
			}
			/*if(!(iOdd % 2))
			 dig[iWord*4] |= 0x2;
			 else
			 dig[iWord*4] |= 0x1;
			 if(!(iEven % 2))
			 dig[iWord*4] |= 0x2 << 2;
			 else
			 dig[iWord*4] |= 0x1 << 2;
			 console.log(dbgMsg+' = Even:'+iEven+',Odd:'+iOdd +'=>dig:'+dig[iWord*4]);*/
		}
		//logger.debug(dbgMsg + ' = Even:' + iEven + ',Odd:' + iOdd);

		dig[0] = iOdd;
		dig[4] = iEven;
		//get overall number of 1s on odd and even positions
		dbgMsg = "";
		for (iWord = 0; iWord < 2; iWord++) {
			var iMsg = 0;

			for (i = 3; i >= 0; i--) {
				dbgMsg += "<" +
					dig[i + iWord * 4] + ">";
				var ibit;
				//console.log(" dig%d (%d)",i+iWord*4, dig[i+iWord*4]);
				for (ibit = 3; ibit >= 0;
				     ibit--) {
					//noinspection JSBitwiseOperatorUsage
					if (dig[i + iWord * 4] & (1 << ibit)) {
						binaryMsg[i * 4 + ibit] = 1;
					}
					else {
						binaryMsg[i * 4 + ibit] = 0;
					}

					if (!iMsg) {
						msgWithHamming[iWord * BITS_PER_WORD + iMsg++] = 0;
					}

					//noinspection JSBitwiseOperatorUsage
					while ((iMsg < 21) && (iMsg != 0) && !(
					iMsg & (iMsg - 1))) {
						msgWithHamming[iWord * BITS_PER_WORD + (iMsg++)] = 0;
					}
					msgWithHamming[iWord * BITS_PER_WORD + iMsg - 1] = binaryMsg[i * 4 + ibit];
					iMsg++;
				}
			}
			for (var iParity = 0; iParity < 5; iParity++) {
				var bitValidation = 0;
				for (i = (Math.pow(2, iParity)) - 1; i < BITS_PER_WORD; i += 2 * Math.pow(2, iParity)) {
					for (var innerBits = 0; (innerBits < Math.pow(2, iParity)) && ((innerBits + i) < BITS_PER_WORD); innerBits++) {
						var parNdx = i + innerBits + 1;
						//noinspection JSBitwiseOperatorUsage
						if (!(parNdx - 1) || !(parNdx & (parNdx - 1))) {
							dbgMsg += ".";
							//control bit - we do not include it in parity check
						}
						else {
							bitValidation += msgWithHamming[iWord * BITS_PER_WORD + parNdx - 1];
						}
					}
				}
				var ndx                                     = Math.pow(2, iParity) - 1;
				msgWithHamming[ndx + iWord * BITS_PER_WORD] = bitValidation & 0x1;
				//set '1' if number of '1's is odd
			}

			//logger.debug(dbgMsg);

			dbgMsg = "";

			for (i = 0; i < BITS_PER_WORD; i++) {
				//dbgMsg += msgWithHamming[iWord*BITS_PER_WORD + i];
				if (i == -1) {
					//set bit No 0-19 to insert error, use bits not power of 2
					if (msgWithHamming[iWord * BITS_PER_WORD + i])
						message.push.apply(message, _setBit(BIT0, -M_PI / 2, BIT_N, 0));
					else
						message.push.apply(message, _setBit(BIT1, M_PI / 2, BIT_N, 0));

				}
				else {
					if (msgWithHamming[iWord * BITS_PER_WORD + i])
						message.push.apply(message, _setBit(BIT1, M_PI / 2, BIT_N, 0));
					else
						message.push.apply(message, _setBit(BIT0, -M_PI / 2, BIT_N, 0));
				}
			}
			//console.log(dbgMsg);
		}

		message.push.apply(message, message);//1 sec
		message.push.apply(message, message);//2 sec
		message.push.apply(message, message);//4 sec

		filteredMessage = _convolve(message, message.length, bpf, bpf.length);
		message         = _convolve(filteredMessage, filteredMessage.length, bpf, bpf.length);

		var scale = SHRT_MAX / 16;
		for (i = 0; i < filteredMessage.length; i++) {
			filteredMessage[i] = message[i] * scale;
		}
		gotData(_generateWAV(filteredMessage));
		//$emit('newData',_generateWAV(filteredMessage));
		//if(window.getNotifManagerInstance) window.getNotifManagerInstance().notify('NEW_DATA', _generateWAV(filteredMessage));

	} catch (e) {
		console.error(e);

	}

};

var _generateWAV = function (dataIn) {
	var channels      = 1,
		sampleRate    = 44100,
		bitsPerSample = 16,
		seconds       = 4,
		data          = [],
		samples       = sampleRate;

	// Generate the sine waveform
	for (var i = 0; i < sampleRate * seconds; i++) {
		//for (var c = 0; c < channels; c++) {
		var v = dataIn[i];//volume * Math.sin((2 * Math.PI) * (i / sampleRate) * frequency);
		data.push(_pack("v", v));
		samples++;
		//}
	}

	data = data.join('');

	// Format sub-chunk
	var chunk1 = [
		"fmt ", // Sub-chunk identifier
		_pack("V", 16), // Chunk length
		_pack("v", 1), // Audio format (1 is linear quantization)
		_pack("v", channels),
		_pack("V", sampleRate),
		_pack("V", sampleRate * channels * bitsPerSample / 8), // Byte rate
		_pack("v", channels * bitsPerSample / 8),
		_pack("v", bitsPerSample)
	].join('');

	// Data sub-chunk (contains the sound)
	var chunk2 = [
		"data", // Sub-chunk identifier
		_pack("V", samples * channels * bitsPerSample / 8), // Chunk length
		data
	].join('');

	// Header
	var header = [
		"RIFF",
		_pack("V", 4 + (8 + chunk1.length) + (8 + chunk2.length)), // Length
		"WAVE"
	].join('');

	return [header, chunk1, chunk2].join('');

};

var _pack = function (fmt) {
	var output = '',
		argi   = 1;

	for (var i = 0; i < fmt.length; i++) {
		var c   = fmt.charAt(i),
			arg = arguments[argi];

		argi++;

		switch (c) {
			case "a":
				output += arg[0] + "\0";
				break;
			case "A":
				output += arg[0] + " ";
				break;
			case "C":
			case "c":
				output += String.fromCharCode(arg);
				break;
			case "n":
				output += String.fromCharCode((arg >> 8) & 255, arg & 255);
				break;
			case "v":
				output += String.fromCharCode(arg & 255, (arg >> 8) & 255);
				break;
			case "N":
				output += String.fromCharCode((arg >> 24) & 255, (arg >> 16) & 255, (arg >> 8) & 255, arg & 255);
				break;
			case "V":
				output += String.fromCharCode(arg & 255, (arg >> 8) & 255, (arg >> 16) & 255, (arg >> 24) & 255);
				break;
			case "x":
				argi--;
				output += "\0";
				break;
			default:
				throw new Error("Unknown _pack format character '" + c + "'");
		}
	}

	return output;
};

var _setBit = function (freq, phase, samples, padding) {
	var data = [];
	var i;
	for (i = 0; i < samples; i++) {
		if (i < samples - padding)
			data[i] = (Math.sin(phase + i * twoPi * (freq / SR)) +
			(Math.sin(phase + i * twoPi * ((freq - 10) / SR))) +
			(Math.sin(phase + i * twoPi * ((freq + 10) / SR))) +
			(Math.sin(phase + i * twoPi * ((freq + 20) / SR))));
		else
			data[i] = 0;
	}
	return data;
};

var _convolve = function (x, x_length, h, h_length) {
	var n,
		output    = [],
		halfFiler = Math.round(h_length / 2 + 0.5),
		nVal      = 0;

	for (n = 0; n < x_length + h_length - 1; n++) {
		var k;

		nVal             = 0;
		var filter_stage = (n < h_length) ? n : h_length - 1;
		for (k = 0; k <= filter_stage; k++) {
			nVal += h[k] * x[n - k];
		}
		if (n >= halfFiler && n < x_length + halfFiler) {
			output[n - halfFiler] = nVal;
		}
	}
	return output;
};

var originSocket = io.connect("/beame_login", socketio_options);

if (!window.btoa) {
	var btoa = function (input) {
		var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

		var output = "";
		var chr1, chr2, chr3;
		var enc1, enc2, enc3, enc4;
		var i      = 0;

		do {
			chr1 = input.charCodeAt(i++);
			chr2 = input.charCodeAt(i++);
			chr3 = input.charCodeAt(i++);

			enc1 = chr1 >> 2;
			enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
			enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
			enc4 = chr3 & 63;

			if (isNaN(chr2)) {
				enc3 = enc4 = 64;
			} else if (isNaN(chr3)) {
				enc4 = 64;
			}

			output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) +
				keyStr.charAt(enc3) + keyStr.charAt(enc4);
		} while (i < input.length);

		return output;
	}
}

var startPlaying = function () {
	if (audio) {//} && socketAlive) {
		console.log('playing: ' + pinData);
		try {
			if (audio.playing === true) {
				audio.pause();
				audio.currentTime = 0;

			}
			audio.src  = audioData;
			audio.loop = true;
			audio.play();
			audio.playing = true;

		} catch (e) {
			console.error('start playing', e);
		}
	}
};

var stopPlaying  = function () {
	try {
		if (audio) {
			audio.pause();
			audio.playing = false;
			audio.loop    = false;
		}
	} catch (e) {
		console.error('stop playing', e);
	}
};

var gotData = function (data) {
	if (stopAllRunningSessions) {
		console.log('Audio: close_session received');
		stopPlaying();
	}
	else {
		console.log("data received:" + data.length);

		audioData = "data:audio/wav;base64," + escape(btoa(data));
		if (!audio)
			audio = new Audio();
		startPlaying();
	}
};

function processTmpHost(tmpHost, srcData) {
	var sockId = tmpHost.sock.id;
	var appId = srcData.appId;

	activeHosts[sockId] = tmpHost;
	console.log('Socket <',sockId,'> Connected, ID = ', activeHosts[sockId].sock.id);

	activeHosts[sockId].sock.on('hostRegisterFailed',function (msg) {
		if(msg.error && (msg.error != 'Invalid payload type')){
			console.log('hostRegisterFailed: ', msg);
			activeHosts[sockId].sock.removeAllListeners();
			activeHosts[sockId] = undefined;
			tmpHost = undefined;
			originSocket.emit('pinRequest');
		}
	});

	activeHosts[sockId].sock.on('hostRegistered', function (data) {
		console.log('Virtual host registered:', data);
		activeHosts[sockId].name = data.Hostname;
		setBrowserforNewPin(srcData);
	});

	activeHosts[sockId].sock.on('data', function (data) {
		if(!activeHosts[sockId]){
			window.alert('Session inactive: reload');
			window.location.reload();
		}
		else{
			activeHosts[sockId].ID = data.socketId;
			activeHosts[sockId].isConnected = true;
			activeHosts[sockId].connectTimeout = setTimeout(function () {
				if(activeHosts[sockId])activeHosts[sockId].isConnected = false;
			}, 3000);
			// activeHosts[sockId].ID = data.socketId;
			var type          = data.payload.data.type;
			console.log(activeHosts[sockId],':',type);
			UID = activeHosts[sockId].name;
			if(type == 'direct_mobile'){
				if(keyPair){
					events2promise(cryptoObj.subtle.exportKey('spki', keyPair.publicKey))
						.then(function (keydata) {
							var PK = arrayBufferToBase64String(keydata);
							var tmp_reg_data = "login";
							var tmp_type = "BEAME_LOGIN";

							fullQrData       = JSON.stringify({
								'relay': RelayEndpoint, 'PK': PK, 'UID': activeHosts[sockId].name, 'appId' : appId,
								'PIN':   activeHosts[sockId].pin, 'TYPE': tmp_type, 'TIME': Date.now(), 'REG': tmp_reg_data
							});


							activeHosts[sockId].sock.emit('data',
								{'socketId': activeHosts[sockId].ID, 'payload':fullQrData});
							console.log('tmpHost: sending qr data to mobile:', fullQrData);//XXX
						}).catch(function (err) {
						console.error('Export Public Key Failed', err);
					});
				}

			}
			else if(type == 'done'){
				stopAllRunningSessions = true;
				activeHost = activeHosts[sockId];
				activeHosts[sockId].sock.removeAllListeners();
				// destroyTmpHosts();
				initComRelay(activeHosts[sockId].sock);
				setTimeout(function () {
					activeHosts && activeHosts[sockId] && activeHosts[sockId].sock.emit('data',
						{'socketId': activeHosts[sockId].ID, 'payload':'sessionTimeout'});
					window.alert('Timed out waiting for mobile directive');
					window.location.reload();
				}, onPairedTimeout);
			}
		}

	});

	activeHosts[sockId].sock.on('disconnect', function () {
		activeHosts[sockId].sock.emit('cut_client',{'socketId':tmpHost.ID});
		activeHosts[sockId] = undefined;
	});

	activeHosts[sockId].sock.emit('register_server',
		{
			'payload': {
				'socketId': null,
				'hostname': srcData['name'],
				'signature': srcData['signature'],
				'type': 'HTTPS',
				'isVirtualHost': true
			}
		});

}

function destroyTmpHosts(cb) {
	stopAllRunningSessions = true;
	clearInterval(pairingSession);
	pairingSession = undefined;
	Object.keys(activeHosts).map(function (tmpHostX, index) {
		if(activeHosts[tmpHostX] && activeHosts[tmpHostX].sock){
			console.log('Done, deleting host <', index, '> :', activeHosts[tmpHostX].name);
			activeHosts[tmpHostX].sock.emit('cut_client',{'socketId':activeHosts[tmpHostX].ID});
			activeHosts[tmpHostX] = undefined;
		}
	});
	activeHosts = [];
	cb && cb();
}

function initTmpHost(data) {

	pinData = data.pin;

	if(!data.signature || !data.relay || !data.name || !data.appId ||
		(tmpHostArr[tmpHostNdx] && tmpHostArr[tmpHostNdx].isConnected) ||
		(tmpHostArr[!tmpHostNdx] && tmpHostArr[!tmpHostNdx].isConnected) ||
		!pairingSession)
		return;

	var usrData = getCookie('usrInData');
	if(usrData){
		document.cookie = 'usrInData=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;';
		var usrDataObj = JSON.parse(usrData);
		originSocket.emit('notifyMobile',JSON.stringify(Object.assign(usrDataObj,{qrData:data})));
	}

	RelayEndpoint = data.relay;
	var lclNdx = tmpHostNdx;
	tmpHostNdx = (tmpHostNdx & 1)?0:1;

	if(tmpHostArr[lclNdx] && tmpHostArr[lclNdx].sock && tmpHostArr[tmpHostNdx] && tmpHostArr[tmpHostNdx].sock){
		console.log('Killing host:', lclNdx);
		if(activeHosts[tmpHostArr[lclNdx].sock.id]){
			console.log('Closing sockets for host:', lclNdx);
			activeHosts[tmpHostArr[lclNdx].sock.id].sock.emit('cut_client',{'socketId':activeHosts[tmpHostArr[lclNdx].sock.id].ID});
			activeHosts[tmpHostArr[lclNdx].sock.id].sock.removeAllListeners();
			delete (activeHosts[tmpHostArr[lclNdx].sock.id]);
		}

		tmpHostArr[lclNdx].sock.removeAllListeners();
		delete(tmpHostArr[lclNdx]);
	}
	tmpHostArr[lclNdx] = {};
	tmpHostArr[lclNdx].pin = data.pin;
	tmpHostArr[lclNdx].name = data.name;
	tmpHostArr[lclNdx].sock = io.connect(data.relay);
	tmpHostArr[lclNdx].sock.on('connect',function () {
		processTmpHost(tmpHostArr[lclNdx], data);
	});
}

function setQr(pin) {
	qrContainer = $('#qr');
	try {
		var qrCode = JSON.stringify(pin);
		if (qrCode.length > 10) {

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
			console.log('data is short:', qrCode.length);//resend qr
		}
	}
	catch (e) {
		console.log('Invalid QR data:', pin);
	}
}

function setBrowserforNewPin(data) {
	setQr(data.pin);
	getWAV(data.pin);
	console.log('PIN:' + data.pin);
	var pinElement = document.getElementById("pin");
	if (pinElement) {
		pinElement.innerHTML = data.pin;
	}
}

originSocket.on('mobileIsOnline',function (status) {
	console.log('mobile status: <<', status, '>>');
});

originSocket.on('startPairingSession',function (data) {
	console.log('Starting pairing session with data:', data);
	if (!pairingSession) {
		var parsed = JSON.parse(data);

		pinRefreshRate = parsed.refresh_rate || 10000;
		pairingSession = setInterval(function () {
			if(stopAllRunningSessions){
				destroyTmpHosts();
			}
			else{
				console.log('Tmp Host requesting data');
				originSocket.emit('pinRequest');
			}

		}, pinRefreshRate);
		showConn = false;
		initTmpHost(parsed);
	}
});

originSocket.on('pindata', function (dataRaw) {
	var data = JSON.parse(dataRaw);

	initTmpHost(data);

});

originSocket.on('tokenVerified', function (data) {
	console.log('tokenVerified', data);
	var parsed = JSON.parse(data);
	if(parsed.success){
		if(parsed.target != 'none'){
			//var target = JSON.parse(parsed.token).signedData;
			//document.cookie = "beame_userid=" + JSON.stringify({token:parsed.token,uid:UID}) + ";path=/;domain="+target.data;
			destroyTmpHosts(function () {
				var l = 'https://' + parsed.target + "?usrInData=" + encodeURIComponent(window.btoa(JSON.stringify({token:parsed.token,uid:UID})));
				window.location.href = l;
			});
		}
	}
	else{
		console.log('Token validation failed:',parsed.error);
	}
});
//*********** crypto **********
var cryptoObj = window.crypto || window.msCrypto;

var PK_RSAOAEP = {//encrypt only
	name: "RSA-OAEP",
	hash: {name: "SHA-1"}
};

var PK_PKCS = {//verify signature only
	name: "RSASSA-PKCS1-v1_5",
	hash: {name: "SHA-256"}
};

var RSAOAEP = {//encrypt only
	name:           "RSA-OAEP",
	modulusLength:  2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash:           {name: "SHA-1"}
};

var RSAPKCS         = {//verify signature only
	name:           "RSASSA-PKCS1-v1_5",
	modulusLength:  2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash:           {name: "SHA-256"}
};
var keyPair;
var keyPairSign;
var keyGenerated    = false;
var VirtualPrefix   = ".virt.beameio.net";
var PKBlockSize     = 256;
//noinspection JSUnusedGlobalSymbols
var AESkeySize      = 16;
//noinspection JSUnusedGlobalSymbols
var IVsizeBruttoB64 = 24;
var keyBlockSize    = 256;
var padOffset       = 42;
var keyGenBusy      = false;
var sessionServiceData     = null;
var sessionServiceDataSign = null;

var sessionRSAPK;
var sessionRSAPKverify;

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

function generateKeys() {
	keyGenBusy = true;
	events2promise(cryptoObj.subtle.generateKey(RSAOAEP, true, ["encrypt", "decrypt"]))
		.then(function (key) {
			console.log('RSA KeyPair', key);
			events2promise(cryptoObj.subtle.generateKey(RSAPKCS, true, ["sign"]))
				.then(function (key1) {
					console.log('RSA Signing KeyPair', key1);
					keyPair      = key;
					keyPairSign  = key1;
					keyGenerated = true;
					keyGenBusy = false;
				})
				.catch(function (error) {
					console.error('Generate Signing Key Failed', error);
					keyGenBusy = false;
				});
		})
		.catch(function (error) {
			console.error('Generate Key Failed', error);
			keyGenBusy = false;
		});
}

function encryptWithPK(data, cb) {

	var dataSize          = data.byteLength;
	var dataToEncryptSize = keyBlockSize - padOffset;
	var inputArray        = [];
	var i, j;
	for (i = 0; i * dataToEncryptSize < dataSize; i++) {
		var chunkSize     = (dataSize - i * dataToEncryptSize > dataToEncryptSize) ? dataToEncryptSize : dataSize - i * dataToEncryptSize;
		var dataToEncrypt = data.slice(i * dataToEncryptSize, i * dataToEncryptSize + chunkSize);
		inputArray.push(dataToEncrypt);
	}
	Promise.all(inputArray.map(function (inData) {
		return events2promise(cryptoObj.subtle.encrypt(PK_RSAOAEP, sessionRSAPK, inData))
	})).then(function (values) {
		var finalLength = 0;

		for (j = 0; j < values.length; j++) {
			finalLength += values[j].byteLength;
		}
		var joinedData = new Uint8Array(finalLength);
		var offset     = 0;
		for (j = 0; j < values.length; j++) {

			joinedData.set(new Uint8Array(values[j]), offset);
			offset += values[j].byteLength;
		}
		//
		cb(null, ab2str(joinedData));
	});
}

function convertPemToBinary(pem) {
	var lines   = pem.split('\n');
	var encoded = '';
	for (var i = 0; i < lines.length; i++) {
		/*if (lines[i].trim().length > 0 &&
		 lines[i].indexOf('-BEGIN RSA PRIVATE KEY-') < 0 &&
		 lines[i].indexOf('-BEGIN RSA PUBLIC KEY-') < 0 &&
		 lines[i].indexOf('-BEGIN PUBLIC KEY-') < 0 &&
		 lines[i].indexOf('-END PUBLIC KEY-') < 0 &&
		 lines[i].indexOf('-END RSA PRIVATE KEY-') < 0 &&
		 lines[i].indexOf('-END RSA PUBLIC KEY-') < 0) {
		 encoded += lines[i].trim();
		 }*/
		encoded += lines[i].trim();
	}
	console.log('PK:', encoded);
	return base64StringToArrayBuffer(encoded);
}

function importPublicKey(pemKey, encryptAlgorithm, usage) {
	if (pemKey.length == 360)
		pemKey = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A" + pemKey;
	return new Promise(function (resolve) {
		var importer = events2promise(cryptoObj.subtle.importKey("spki", convertPemToBinary(pemKey), encryptAlgorithm, false, usage));
		importer.then(function (keydata) {
			resolve(keydata);
		})
			.catch(function (error) {
				console.log('Failed to import PK: ', error);
			});
	});
}

function base64StringToArrayBuffer(b64str) {
	var byteStr = atob(b64str);

	var bytes = new Uint8Array(byteStr.length);
	console.log('byteStr.length:', byteStr.length);

	for (var i = 0; i < byteStr.length; i++) {
		bytes[i] = byteStr.charCodeAt(i);
	}
	return bytes.buffer;
}

function sendEncryptedData(target, socketId, data) {
	encryptWithPK(data, function (error, cipheredData) {
		if (!error) {
			target.emit('data', {
				'socketId': socketId,
				'payload':  cipheredData
			});
		}
		else {
			console.error('Data encryption failed: ', error);
			target.emit('data', {
				'socketId': socketId,
				'payload':  'Data encryption failed'
			});
		}
	});
}

function processMobileData(TMPsocketRelay, data, cb) {

	var type          = data.payload.data.type;
	var tmpSocketID   = data.socketId;
	var encryptedData = data.payload.data;
	var decryptedData;

	function onMessageDecryptedKey(err, decryptedDataB64) {
		if (!err) {
			decryptedData = JSON.parse(atob(decryptedDataB64));

			var key2import = decryptedData.pk;

			importPublicKey(key2import, PK_RSAOAEP, ["encrypt"]).then(function (keydata) {
				console.log("Successfully imported RSAOAEP PK from external source..", decryptedData);
				sessionRSAPK = keydata;
				console.log('...Got message from mobile:', decryptedData);

				originSocket.emit('verifyToken',decryptedData.payload.token);
				//startGatewaySession(decryptedData.payload.token, userData, relaySocket, decryptedData.uid);

				// importPublicKey(key2import, PK_PKCS, ["verify"]).then(function (keydata) {
				// 	console.log("Successfully imported RSAPKCS PK from external source");
				// 	sessionRSAPKverify = keydata;
				// 	if (cb) {
				// 		cb(decryptedData);
				// 	}
				// }).catch(function (err) {
				// 	console.error('Import *Verify Key* Failed', err);
				// });

			}).catch(function (err) {
				console.error('Import *Encrypt Key* Failed', err);
			});


		}
		else {
			console.log('failed to decrypt mobile PK');
			TMPsocketRelay.emit('data', {
				'socketId': tmpSocketID,
				'payload':  'failed to decrypt mobile PK'
			});
		}

	}

	switch (type) {
		case 'info_packet_response':
			console.log('info_packet_response data = ', data.payload.data);
			decryptMobileData((encryptedData), RSAOAEP, keyPair.privateKey, onMessageDecryptedKey);
			return;
		case 'direct_mobile':
			// var xhr = new XMLHttpRequest();
			// xhr.open('GET', "https://gsvewupg9e8tl75r.kl9gozbgs9nlfxpw.v1.p.beameio.net/", true);
			// xhr.withCredentials = false;
			// //xhr.setRequestHeader('Access-Control-Allow-Origin','*');
			// //xhr.setRequestHeader('Access-Control-Allow-Methods','GET');
			// xhr.send();
			// xhr.onreadystatechange = processRequest;
			// function processRequest(e) {
			// 	if (xhr.readyState == 4) {
			// 		window.alert('xhr READY:'+xhr.status)
			// 	}
			// }
			break;
		case 'restart_pairing':
			window.location.reload();
			break;
		default:
			console.error('unknown payload type for Beame-Login' + type);
			return;
	}
}

function decryptMobileData(msgParsed, encryption, SK, cb) {
	try {
		if (msgParsed['data'] && msgParsed['metadata']) {
			var msgBA    = str2ab(window.atob(msgParsed['metadata']));
			var dataSize = msgBA.byteLength;
			var j;
			var offs     = dataSize % PKBlockSize;
			console.log("Encrypted DataPK::", msgParsed, " , offs:", offs, " msgBA.length:", msgBA.byteLength);

			var inputArray = [];

			for (var i = 0; i * PKBlockSize < dataSize; i++) {
				var chunkSize = (dataSize - i * PKBlockSize > PKBlockSize) ? PKBlockSize : dataSize - i * PKBlockSize;
				if (chunkSize >= PKBlockSize) {
					var dataToEncrypt = msgBA.slice(i * PKBlockSize, i * PKBlockSize + chunkSize);
					inputArray.push(dataToEncrypt);
				}
				else {
					console.log('found padding <', chunkSize, '>');
				}
			}

			Promise.all(inputArray.map(function (inData) {
				return events2promise(cryptoObj.subtle.decrypt(encryption, SK, inData))
			})).then(function (values) {
				var finalLength = 0;

				for (j = 0; j < values.length; j++) {
					finalLength += values[j].byteLength;
				}
				var joinedData = new Uint8Array(finalLength);
				var offset     = 0;
				for (j = 0; j < values.length; j++) {
					joinedData.set(new Uint8Array(values[j]), offset);
					offset += values[j].byteLength;
				}
				var outData = ab2str(joinedData);
				var parsed  = JSON.parse(atob(outData));

				if (parsed['key'] && parsed['iv']) {
					var rawAESkey = base64StringToArrayBuffer(parsed['key']);
					events2promise(cryptoObj.subtle.importKey(
						"raw", //can be "jwk" or "raw"
						rawAESkey.slice(0, AESkeySize),//remove b64 padding
						{name: "AES-CBC"},
						false, //extractable (i.e. can be used in exportKey)
						["encrypt", "decrypt"] //can be "encrypt", "decrypt", "wrapKey", or "unwrapKey"
					)).then(function (key) {
						console.log('imported aes key <ok>');
						var rawIV = base64StringToArrayBuffer(parsed['iv']).slice(0, AESkeySize);
						events2promise(cryptoObj.subtle.decrypt(
							{
								name: 'AES-CBC',
								iv:   rawIV
							},
							key,
							msgParsed['data']
						)).then(function (decrypted) {
							var outData = (ab2str(decrypted));
							if (outData.length > 256) {
								console.log('decrypted data (length): ', outData.length);
							}
							else {
								console.log('decrypted data: ', outData);
							}
							cb(null, outData);
						}).catch(function (err) {
							console.error(err);
						});

					}).catch(function (err) {
						console.error(err);
					});
				}
				else {
					cb(null, outData);
				}

			}).catch(function (error) {
				console.log('Failed to decrypt: ', error);
				cb(error, null);
			});
		}
	}
	catch (e) {
		cb(e, null);
	}
}

function str2ab(str) {
	var buf     = new ArrayBuffer(str.length);//* 2); // 2 bytes for each char
	var bufView = new Uint8Array(buf);//Uint16Array(buf);
	for (var i = 0, strLen = str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
}

function ab2str(buffer) {
	//return window.btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
	var binary = '';
	var bytes  = new Uint8Array(buffer);
	var len    = bytes.byteLength;
	for (var i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
}

function arrayBufferToBase64String(arrayBuffer) {
	var byteArray  = new Uint8Array(arrayBuffer);
	var byteString = '';
	for (var i = 0; i < byteArray.byteLength; i++) {
		byteString += String.fromCharCode(byteArray[i]);
	}
	return btoa(byteString);
}

//******************** virt_host_controller
var TmpSocketID,
	virtHostAlive,
	vUID;

function initComRelay(virtRelaySocket) {

	virtRelaySocket.on('disconnect', function () {
		//setQRStatus && setQRStatus('Virtual host disconnected');
		console.log('relay disconnected, ID = ', virtRelaySocket.id);
	});

	virtRelaySocket.on('data', function (data) {
		console.log('QR relay data');
		TmpSocketID = data.socketId;
		processMobileData(virtRelaySocket, data);
		virtRelaySocket.beame_relay_socket_id = data.socketId;
	});

	virtRelaySocket.on('create_connection', function () {
		console.log('create_connection, ID = ', virtRelaySocket.id);
	});

	virtRelaySocket.on('hostRegistered', function (data) {
		clearInterval(connectToRelayRetry);
		virtHostAlive = virtHostTimeout;
		vUID = data.Hostname;
		//TMPsocketOriginWh && sendQrDataToWhisperer(RelayPath, vUID, TMPsocketOriginWh);
		//TMPsocketOriginAp && sendQrDataToApprover(RelayPath, vUID, TMPsocketOriginAp);
		console.log('QR hostRegistered, ID = ', virtRelaySocket.id, '.. hostname: ', data.Hostname);
		// TMPsocketOriginQR && setQRStatus && setQRStatus('Virtual host registration complete');
		// TMPsocketOriginQR && TMPsocketOriginQR.emit('virtSrvConfig', vUID);
		// TMPsocketOriginQR && keepVirtHostAlive(TMPsocketOriginQR);
		controlWindowStatus();
	});

	virtRelaySocket.on('hostRegisterFailed',function (data) {
		if(data && data.Hostname){
			console.log('Requesting virtual host signature renewal');
			originSocket.emit('browser_connected');
		}
	});

	virtRelaySocket.on('error', function () {
		console.log('Relay error, ID = ', virtRelaySocket.id);
	});

	virtRelaySocket.on('_end', function () {
		console.log('Relay end, ID = ', virtRelaySocket.id);
	});

}

function beameLoginData(){
	return "huy";

}

