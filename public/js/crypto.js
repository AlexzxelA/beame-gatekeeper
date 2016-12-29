/**
 * Created by Alexz on 15/11/2016.
 */

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
var sessionRSAPK;
var sessionRSAPKverify;

var sessionServiceData     = null;
var sessionServiceDataSign = null;
var originTmpSocket = null;
var userImageRequired = false,
	userImageRequested = false;


function generateUID(length) {
	var text     = "";
	var possible = "_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef.ghijklmnopqrstuvwxyz0123456789.";
	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function generateKeys() {
	window.crypto.subtle.generateKey(RSAOAEP, true, ["encrypt", "decrypt"])
		.then(function (key) {
			console.log('RSA KeyPair', key);
			window.crypto.subtle.generateKey(RSAPKCS, true, ["sign"])
				.then(function (key1) {
					console.log('RSA Signing KeyPair', key1);
					keyPair = key;
					keyPairSign = key1;
					keyGenerated = true;
				})
				.catch(function (error) {
					console.error('Generate Signing Key Failed', error);
				});
		})
		.catch(function (error) {
			console.error('Generate Key Failed', error);
		});
}

function getKeyPairs(cb) {
	if(!keyGenerated){
		var keyTimeout = 20;
		var wait4key = setInterval(function () {
			if(keyPair && keyPairSign && keyGenerated){
				clearInterval(keyTimeout);
				cb(null, {
					keyPair:     keyPair,
					keyPairSign: keyPairSign
				});
			}
			else if(--keyTimeout < 1){
				clearInterval(keyTimeout);
				cb('Key generation failed', null);
			}
		},100);
	}
	else{
		cb(null, {
			keyPair:     keyPair,
			keyPairSign: keyPairSign
		});
	}
}

function signArbitraryData(data, cb) {
	window.crypto.subtle.sign(
		{name: "RSASSA-PKCS1-v1_5"},
		keyPairSign.privateKey,
		str2ab(data)
	)
		.then(function(signature){
			//console.log('signData:',data,'..sign:',arrayBufferToBase64String(signature));
			cb(null, signature);
		})
		.catch(function(err){
			console.error(err);
			cb(err,null);
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
	Promise.all(inputArray.map(function(inData) {return window.crypto.subtle.encrypt(PK_RSAOAEP, sessionRSAPK, inData)})).then(function(values) {
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

function decryptMobileData(msgParsed, encryption, SK, cb) {
	try {
		if(msgParsed['data'] && msgParsed['metadata']){
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

			Promise.all(inputArray.map(function(inData) {
				return window.crypto.subtle.decrypt(encryption, SK, inData)})).then(function(values) {
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
				var parsed = JSON.parse(atob(outData));

				if(parsed['key'] && parsed['iv']){
					var rawAESkey = base64StringToArrayBuffer(parsed['key']);
					window.crypto.subtle.importKey(
						"raw", //can be "jwk" or "raw"
						rawAESkey.slice(0,AESkeySize),//remove b64 padding
						{name: "AES-CBC"},
						false, //extractable (i.e. can be used in exportKey)
						["encrypt", "decrypt"] //can be "encrypt", "decrypt", "wrapKey", or "unwrapKey"
					).then(function(key){
						console.log('imported aes key <ok>');
						var rawIV = base64StringToArrayBuffer(parsed['iv']).slice(0,AESkeySize);
						window.crypto.subtle.decrypt(
							{ name: 'AES-CBC',
								iv: rawIV },
							key,
							msgParsed['data']
						).then(function (decrypted) {
							var outData = (ab2str(decrypted));
							console.log('decrypted data: ',outData);
							cb(null, outData);
						}).catch(function(err){
							console.error(err);
						});

					}).catch(function(err){
						console.error(err);
					});
				}
				else{
					cb(null, outData);
				}

			}).catch(function (error) {
				console.log('Failed to decrypt: ', error);
				cb(error, null);
			});
		}
	}
	catch(e){
		cb(e, null);
	}
}

function encryptWithSymK(data, plainData, cb) {
	if (sessionAESkey) {
		var abData = str2ab(data);
		window.crypto.subtle.encrypt(
			{name: 'AES-CBC', iv: sessionIV}
			, sessionAESkey
			, abData
		).then(function (encrypted) {
			//plaindata will be signed but not encrypted
			var cipheredValue = (plainData) ? plainData + arrayBufferToBase64String(encrypted) : arrayBufferToBase64String(encrypted);
			console.log('Signing data: <', cipheredValue, '>');
			window.crypto.subtle.sign(
				{name: "RSASSA-PKCS1-v1_5"},
				keyPairSign.privateKey, //from generateKey or importKey above
				str2ab(cipheredValue)
				)
				.then(function (signature) {
					console.log(signature);//new Uint8Array(signature));
					cb(null, cipheredValue, signature);
				})
				.catch(function (err) {
					console.error(err);
					cb(err, null, null);
				});

		}).catch(function (err) {
			console.error(err);
			cb(err, null, null);
		});
	}
}

function base64StringToArrayBuffer(b64str) {
	var byteStr = atob(b64str);

	var bytes = new Uint8Array(byteStr.length);
	console.log('byteStr.length:', byteStr.length);

	for (var i = 0; i < byteStr.length; i++) {
		//var xxx = byteStr.charCodeAt(i);
		bytes[i] = byteStr.charCodeAt(i);
	}
	return bytes.buffer;
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
		var importer = window.crypto.subtle.importKey("spki", convertPemToBinary(pemKey), encryptAlgorithm, false, usage);
		importer.then(function (keydata) {
				resolve(keydata);
			})
			.catch(function (error) {
				console.log('Failed to import PK: ', error);
			});
	});
}


function processMobileData(TMPsocketRelay, originSocketArray, data, cb) {

	var type = data.payload.data.type;
	var tmpSocketID   = data.socketId;
	var encryptedData = data.payload.data;
	var decryptedData;

	switch (type) {
		case 'info_packet_response':
			console.log('info_packet_response data = ', data.payload.data);

			var onPublicKeyImported = function (keydata) {
				console.log("Successfully imported RSAOAEP PK from external source..", decryptedData);
				sessionRSAPK = keydata;
				initCryptoSession(TMPsocketRelay, originSocketArray, data, decryptedData);
			};

			function onError() {
				console.log('Import *Encrypt Key* failed');
			}

			function onMessageDecryptedKey(err, decryptedDataB64) {
				if (!err) {
					decryptedData = JSON.parse(atob(decryptedDataB64));

					if (cb) {
						cb(decryptedData);
						return;
					}

					var key2import = decryptedData.pk;

					importPublicKey(key2import, PK_RSAOAEP, ["encrypt"]).then(onPublicKeyImported).catch(onError());
					importPublicKey(key2import, PK_PKCS, ["verify"]).then(function (keydata) {
						console.log("Successfully imported RSAPKCS PK from external source");
						sessionRSAPKverify = keydata;
					}).catch(function (err) {
						console.error('Import *Verify Key* Failed', err);
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

			decryptMobileData((encryptedData), RSAOAEP, keyPair.privateKey, onMessageDecryptedKey);
			return;
		case 'session_data':
			console.log('session_data');
		function onMessageDecrypted(err, decryptedDataB64) {
			if (!err) {
				decryptedData = atob(decryptedDataB64);

				if (cb) {
					cb(decryptedData);
				}
				else{
					try{
						var parsedData = JSON.parse(decryptedData);
						if(parsedData.type && parsedData.type == 'userImage'){
							originTmpSocket.emit('userImage',parsedData.payload.image);
							var src = 'data:image/jpeg;base64,' + parsedData.payload.image;

							window.getNotifManagerInstance().notify('SHOW_USER_IMAGE',
								{
									src: src
								});
						}
					}
					catch (e){
						console.error(e);
					}
				}
			}
			else {
				console.log('failed to decrypt session data');
				TMPsocketRelay.emit('data', {
					'socketId': tmpSocketID,
					'payload':  'failed to decrypt data'
				});
			}
		}
			decryptMobileData((encryptedData), RSAOAEP, keyPair.privateKey, onMessageDecrypted);
			return;
		case 'registration_complete':
			logout();
			return;
		default:
			console.error('unknown payload type ' + type);
			return;
	}
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


function initCryptoSession(relaySocket, originSocketArray, data, decryptedData) {
	originTmpSocket = originSocketArray.GW;
	console.log('...Got message from mobile:',decryptedData);
	if(decryptedData.source){
		originTmpSocket = (decryptedData.source == 'qr') ? originSocketArray.QR : originSocketArray.WH;
	}
	window.crypto.subtle.exportKey('spki', keyPair.publicKey)
		.then(function (mobPK) {
			if(!userImageRequested) {
				userImageRequested = true;
				switch (auth_mode) {
					case 'Provision':
						originTmpSocket.emit('InfoPacketResponse',
							{
								'pin':       decryptedData.reg_data.pin,
								'otp':       decryptedData.otp,
								'pk':        arrayBufferToBase64String(mobPK),
								'edge_fqdn': decryptedData.edge_fqdn,
								'email':     decryptedData.reg_data.email,
								'name':      decryptedData.reg_data.name,
								'nickname':  null,
								'user_id':   decryptedData.reg_data.user_id
							});

						validateSession(userImageRequired).then(function () {
							userImageRequested = false;

						}).catch(function () {
							userImageRequested = false;

						});
						break;

					case 'Session':
						validateSession(userImageRequired).then(function () {
							userImageRequested = false;
							TMPsocketOriginQR && TMPsocketOriginQR.emit('_disconnect');
							TMPsocketOriginWh && TMPsocketOriginWh.emit('_disconnect');
							startGatewaySession(decryptedData.payload.token, relaySocket, decryptedData.uid, decryptedData.relay);
						}).catch(function () {
							userImageRequested = false;
							window.alert('Session failure : image validation');
						});
						return;

					default:
						alert('Unknown Auth mode');
						logout();
						return;
				}


			}
		})
		.catch(function (error) {
			originTmpSocket.emit('InfoPacketResponseError',
				{'pin': data.payload.data.otp, 'error': 'mobile PK failure'});
			console.log('<*********< error >*********>:', error);
		});

	window.crypto.subtle.exportKey('spki', keyPairSign.publicKey)
		.then(function (keydata1) {
			console.log('SignKey: ', arrayBufferToBase64String(keydata1));
			sendEncryptedData(relaySocket, data.socketId,
				str2ab(JSON.stringify({'type': 'sessionSecData',
					'data': {
						'pk':arrayBufferToBase64String(keydata1),
						'sign':sessionServiceDataSign,
						'sessionData':sessionServiceData
			}})));
		})
		.catch(function (err) {
			console.error('Export Public Sign Key Failed', err);
		});

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
	var bytes = new Uint8Array( buffer );
	var len = bytes.byteLength;
	for (var i = 0; i < len; i++) {
		binary += String.fromCharCode( bytes[ i ] );
	}
	return window.btoa( binary );
}

function arrayBufferToBase64String(arrayBuffer) {
	var byteArray  = new Uint8Array(arrayBuffer);
	var byteString = '';
	for (var i = 0; i < byteArray.byteLength; i++) {
		byteString += String.fromCharCode(byteArray[i]);
	}
	return btoa(byteString);
}