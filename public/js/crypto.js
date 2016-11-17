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
	name: "RSA-OAEP",
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: {name: "SHA-1"}
};

var RSAPKCS = {//verify signature only
	name: "RSASSA-PKCS1-v1_5",
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: {name: "SHA-256"}
};

const VirtualPrefix =".virt.beameio.net";
const PKBlockSize     = 256;
//noinspection JSUnusedGlobalSymbols
const AESkeySize      = 16;
//noinspection JSUnusedGlobalSymbols
const IVsizeBruttoB64 = 24;
const keyBlockSize    = 256;
const padOffset       = 42;



function generateUID(length) {
	var text = "";
	var possible = "_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef.ghijklmnopqrstuvwxyz0123456789.";
	for(var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function generateKeyPairs(cb) {
	//noinspection JSUnresolvedFunction,JSUnresolvedVariable
	window.crypto.subtle.generateKey(RSAOAEP, true, ["encrypt", "decrypt"])
		.then(function (key) {
			console.log('RSA KeyPair', key);
			//noinspection JSUnresolvedFunction,JSUnresolvedVariable
			window.crypto.subtle.generateKey(RSAPKCS, true, ["sign"])
				.then(function (key1) {
					console.log('RSA Signing KeyPair', key1);
					cb(null,{
						keyPair : key,
						keyPairSign : key1
					});
				})
				.catch(function (error) {
					console.error('Generate Signing Key Failed', error);
					cb(error,null);
				});
		})
		.catch(function (error) {
			console.error('Generate Key Failed', error);
			cb(error,null);
		});
}

function encryptWithPK(data, cb) {

	var dataSize = data.byteLength;
	var dataToEncryptSize = keyBlockSize - padOffset;
	var inputArray = [];
	var i,j;
	for(i=0; i*dataToEncryptSize < dataSize; i++){
		var chunkSize = (dataSize - i*dataToEncryptSize > dataToEncryptSize)? dataToEncryptSize : dataSize - i*dataToEncryptSize;
		var dataToEncrypt = data.slice(i*dataToEncryptSize,i*dataToEncryptSize+chunkSize);
		inputArray.push(dataToEncrypt);
	}
	//noinspection JSUnresolvedFunction,JSUnresolvedVariable
	Promise.all(inputArray.map(inData => window.crypto.subtle.encrypt(PK_RSAOAEP, sessionRSAPK, inData))).then(values => {
		var finalLength = 0;

		for(j=0; j< values.length;j++){
			console.log('Value>>>>>>>> ',ab2str(values[j]));
			finalLength += values[j].byteLength;
		}
		var joinedData = new Uint8Array(finalLength);
		var offset = 0;
		for(j=0; j< values.length;j++){

			joinedData.set(new Uint8Array(values[j]),offset);
			offset += values[j].byteLength;
		}
		//console.log('data::::::: ',Array.apply([],joinedData).join(","));
		cb(null,ab2str(joinedData));
	});
}

function decryptDataWithRSAkey(msgParsed, encryption, SK, cb) {

	var keyBA = str2ab(window.atob(msgParsed));
	var dataSize = keyBA.byteLength;
	var j;
	var offs = dataSize % PKBlockSize;
	console.log("Encrypted DataPK::",msgParsed," , offs:",offs," keyBA.length:",keyBA.byteLength);

	var inputArray = [];

	for(var i=0; i*PKBlockSize < dataSize; i++){
		var chunkSize = (dataSize - i*PKBlockSize > PKBlockSize)? PKBlockSize : dataSize - i*PKBlockSize;
		if(chunkSize >= PKBlockSize){
			var dataToEncrypt = keyBA.slice(i*PKBlockSize,i*PKBlockSize+chunkSize);
			inputArray.push(dataToEncrypt);
		}
		else{
			console.log('found padding <',chunkSize,'>');
		}
	}
	Promise.all(inputArray.map(inData => window.crypto.subtle.decrypt(encryption, SK, inData))).then(values => {
		var finalLength = 0;

		for(j=0; j< values.length;j++){
			console.log('ValuePK>>>>>>>> ',ab2str(values[j]));
			finalLength += values[j].byteLength;
		}
		var joinedData = new Uint8Array(finalLength);
		var offset = 0;
		for(j=0; j< values.length;j++){
			joinedData.set(new Uint8Array(values[j]),offset);
			offset += values[j].byteLength;
		}

		cb(null,ab2str(joinedData));
	}).catch(function(error){
		console.log('Failed to decrypt: ', error);
		cb(error,null);
	});
}

//noinspection JSUnusedGlobalSymbols
function encryptWithSymK(data, plainData, cb) {
	if(sessionAESkey){
		var abData = str2ab(data);
		window.crypto.subtle.encrypt(
			{ name: 'AES-CBC', iv: sessionIV }
			, sessionAESkey
			, abData
		).then(function (encrypted) {
			//plaindata will be signed but not encrypted
			var cipheredValue = (plainData)?plainData+arrayBufferToBase64String(encrypted):arrayBufferToBase64String(encrypted);
			console.log('Signing data: <',cipheredValue,'>');
			window.crypto.subtle.sign(
				{name: "RSASSA-PKCS1-v1_5"},
				keyPairSign.privateKey, //from generateKey or importKey above
				str2ab(cipheredValue)
			)
				.then(function(signature){
					console.log(signature);//new Uint8Array(signature));
					cb(null, cipheredValue, signature);
				})
				.catch(function(err){
					console.error(err);
					cb(err,null,null);
				});

		}).catch(function(err){
			console.error(err);
			cb(err, null,null);
		});
	}
}

function base64StringToArrayBuffer(b64str) {
	var byteStr = atob(b64str);

	var bytes = new Uint8Array(byteStr.length);
	console.log('byteStr.length:',byteStr.length);

	for (var i = 0; i < byteStr.length; i++) {
		//var xxx = byteStr.charCodeAt(i);
		bytes[i] = byteStr.charCodeAt(i);
	}
	return bytes.buffer;
}

function convertPemToBinary(pem) {
	var lines = pem.split('\n');
	var encoded = '';
	for(var i = 0;i < lines.length;i++){
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
	console.log('PK:',encoded);
	return base64StringToArrayBuffer(encoded);
}

function importPublicKey(pemKey, encryptAlgorithm, usage) {
	if(pemKey.length == 360)
		pemKey = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A" + pemKey;
	return new Promise(function(resolve) {
		var importer = window.crypto.subtle.importKey("spki", convertPemToBinary(pemKey), encryptAlgorithm, false, usage);
		importer.then(function(keydata) {
			resolve(keydata);
		})
			.catch(function (error) {
				console.log('Failed to import PK: ',error);
			});
	});
}
function processMobileData(TMPsocketRelay,TMPsocketOrigin,keyPair,keyPairSign, data){

	var type = data.payload.data.type;

	switch (type) {
		case 'info_packet_response':
			console.log('info_packet_response data = ', data.payload.data);
			tmpSocketID       = data.socketId;
			var encryptedData = data.payload.data.data;
			var decryptedData;

			var onPublicKeyImported = function (keydata) {
				console.log("Successfully imported RSAOAEP PK from external source..", decryptedData);
				sessionRSAPK = keydata;
				initCryptoSession(TMPsocketRelay,TMPsocketOrigin,keyPair,keyPairSign, data, decryptedData);
			};

			function onError(e) {
				console.log('Import *Encrypt Key* failed:',e);
			}



			var onMessageDecrypted = function (err, decryptedDataB64) {
				if (!err) {
					decryptedData = JSON.parse(atob(decryptedDataB64));
					var key2import    = decryptedData.pk;

					importPublicKey(key2import, PK_RSAOAEP, ["encrypt"]).then(onPublicKeyImported).catch(onError(e));
				}
				else {
					console.log('failed to decrypt mobile PK');
					TMPsocketRelay.emit('data', {
						'socketId': tmpSocketID,
						'payload':  'failed to decrypt mobile PK'
					});
				}
			};

			decryptDataWithRSAkey(encryptedData, RSAOAEP, keyPair.privateKey, onMessageDecrypted );
			return;
		case 'registration_complete':
			logout();
			return;
		default:
			console.error('unknown payload type ' + type);
			return;
	}
}
function initCryptoSession(relaySocket, originSocket,  keysEncrypt, keysSign,  data, decryptedData) {
	window.crypto.subtle.exportKey('spki', keysEncrypt.publicKey)
		.then(function (mobPK) {

			switch (auth_mode) {
				case 'Provision':
					console.log('InfoPacketResponse to ');
					originSocket.emit('InfoPacketResponse',
						{
							'pin':       decryptedData.reg_data.pin,
							'otp':       decryptedData.otp,
							'pk':        arrayBufferToBase64String(mobPK),
							'edge_fqdn': decryptedData.edge_fqdn,
							'email':     decryptedData.reg_data.email,
							'name':      decryptedData.reg_data.name,
							'user_id':   decryptedData.reg_data.user_id
						});
					break;
				case 'Session':
					startGatewaySession(decryptedData.token,relaySocket);
					//TODO add ui logic
					return;
				default:
					alert('Unknown Auth mode');
					logout();
					return;
			}

		})
		.catch(function (error) {
			originSocket.emit('InfoPacketResponseError',
				{'pin': data.payload.data.otp, 'error': 'mobile PK failure'});
			console.log('<*********< error >*********>:', error);
		});

	window.crypto.subtle.exportKey('spki', keysSign.publicKey)
		.then(function (keydata1) {
			console.log('SignKey: ', arrayBufferToBase64String(keydata1));
			encryptWithPK(keydata1, function (error, cipheredData) {
				if (!error) {
					console.log('Sending SignKey: ', JSON.stringify({
						'type':    'signkey',
						'payload': {'data': (cipheredData)}
					}));
					relaySocket.emit('data', {
						'socketId': data.socketId,
						'payload':  JSON.stringify({'type': 'signkey', 'data': (cipheredData)})
					});
				}
				else {
					console.error('Data encryption failed: ', error);
				}
			});
		})
		.catch(function (err) {
			console.error('Export Public Sign Key Failed', err);
		});

	importPublicKey(key2import, PK_PKCS, ["verify"]).then(function (keydata) {
		console.log("Successfully imported RSAPKCS PK from external source");
		sessionRSAPKverify = keydata;
	}).catch(function (err) {
		success = false;
		console.error('Import *Verify Key* Failed', err);
	});
}

function str2ab(str) {
	var buf = new ArrayBuffer(str.length );//* 2); // 2 bytes for each char
	var bufView = new Uint8Array(buf);//Uint16Array(buf);
	for (var i = 0, strLen = str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
}

function ab2str(buf) {
	return window.btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
}

function arrayBufferToBase64String(arrayBuffer) {
	var byteArray = new Uint8Array(arrayBuffer);
	var byteString = '';
	for (var i=0; i<byteArray.byteLength; i++) {
		byteString += String.fromCharCode(byteArray[i]);
	}
	return btoa(byteString);
}