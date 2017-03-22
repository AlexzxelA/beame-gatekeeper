/**
 * Created by Alexz on 15/11/2016.
 */
var allowLogout = false;
var cryptoObj = window.crypto || window.msCrypto,
	cryptoSubtle = cryptoObj.subtle || cryptoObj.webkitSubtle;

var CryptoAlg = 'RSASSA-PKCS1-v1_5';//(engineFlag)?'HMAC':'RSASSA-PKCS1-v1_5';

var PK_RSAOAEP = engineFlag?{//encrypt only
	name: "RSA-OAEP",
	hash: {name: "SHA-1"}
}:{//encrypt only
	name: "RSA-OAEP",
	hash: {name: "SHA-1"}
};

var PK_PKCS = engineFlag?
{//verify signature only
	name: CryptoAlg,
	hash: {name: "SHA-256"}
}:{//verify signature only
	name: CryptoAlg,
	hash: {name: "SHA-256"}
};

var RSAOAEP = engineFlag?{//encrypt only
	name:           "RSA-OAEP",
	modulusLength:  2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: {name: "SHA-1"}}:
{
	name:           "RSA-OAEP",
	modulusLength:  2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: {name: "SHA-1"}
};

var RSAPKCS         = engineFlag?{//verify signature only
	name: "RSASSA-PKCS1-v1_5",
	modulusLength: "2048",
	publicExponent: new Uint8Array([1, 0, 1]), // 2^16 + 1 (65537)
	hash: { name: "SHA-256" }
}:{//verify signature only
	name: "RSASSA-PKCS1-v1_5",
	modulusLength: "2048",
	publicExponent: new Uint8Array([1, 0, 1]), // 2^16 + 1 (65537)
	hash: { name: "SHA-256" }
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
var originTmpSocket        = null;
var userImageRequired      = false,
    userImageRequested     = false,
    userData               = null;

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


function generateUID(length) {
	var text     = "";
	var possible = "_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef.ghijklmnopqrstuvwxyz0123456789.";
	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function generateKeys() {
	events2promise(cryptoSubtle.generateKey(RSAOAEP, true, ["encrypt", "decrypt"]))
		.then(function (key) {
			console.log('RSA KeyPair', key);
			events2promise(cryptoSubtle.generateKey(RSAPKCS, true, ["sign", "verify"]))
				.then(function (key1) {
					console.log('RSA Signing KeyPair', key1);
					keyPair      = key;
					if(!keyPair.privateKey) keyPair.privateKey = keyPair;
					keyPairSign  = key1;
					if(!keyPairSign.privateKey) keyPairSign.privateKey = keyPairSign;
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
	if (!keyGenerated) {
		var keyTimeout = 300;
		var wait4key   = setInterval(function () {
			if (keyPair && keyPairSign && keyGenerated) {
				clearInterval(wait4key);
				cb(null, {
					keyPair:     keyPair,
					keyPairSign: keyPairSign
				});
			}
			else if (--keyTimeout < 1) {
				clearInterval(wait4key);
				cb('Key generation failed', null);
			}
		}, 100);
	}
	else {
		cb(null, {
			keyPair:     keyPair,
			keyPairSign: keyPairSign
		});
	}
}

function signArbitraryData(data, cb) {
	events2promise(cryptoSubtle.sign(
		PK_PKCS,
		keyPairSign.privateKey,
		str2ab(data)
		))
		.then(function (signature) {
			//console.log('signData:',data,'..sign:',arrayBufferToBase64String(signature));
			cb(null, signature);
		})
		.catch(function (err) {
			console.error(err);
			cb(err, null);
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
		return events2promise(cryptoSubtle.encrypt(PK_RSAOAEP, sessionRSAPK, inData))
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
				return events2promise(cryptoSubtle.decrypt(encryption, SK, inData))
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
					events2promise(cryptoSubtle.importKey(
						"raw", //can be "jwk" or "raw"
						rawAESkey.slice(0, AESkeySize),//remove b64 padding
						{name: "AES-CBC"},
						false, //extractable (i.e. can be used in exportKey)
						["encrypt", "decrypt"] //can be "encrypt", "decrypt", "wrapKey", or "unwrapKey"
					)).then(function (key) {
						console.log('imported aes key <ok>');
						var rawIV = base64StringToArrayBuffer(parsed['iv']).slice(0, AESkeySize);
						events2promise(cryptoSubtle.decrypt(
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

function encryptWithSymK(data, plainData, cb) {
	if (sessionAESkey) {
		var abData = str2ab(data);
		events2promise(cryptoSubtle.encrypt(
			{name: 'AES-CBC', iv: sessionIV}
			, sessionAESkey
			, abData
		)).then(function (encrypted) {
			//plaindata will be signed but not encrypted
			var cipheredValue = (plainData) ? plainData + arrayBufferToBase64String(encrypted) : arrayBufferToBase64String(encrypted);
			console.log('Signing data: <', cipheredValue, '>');
			events2promise(cryptoSubtle.sign(
				PK_PKCS,
				keyPairSign.privateKey, //from generateKey or importKey above
				str2ab(cipheredValue)
				))
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
		if(engineFlag)
			pemKey = str2ab(JSON.stringify(pkcs2jwk(base64StringToArrayBuffer(pemKey))));
		else
			pemKey = convertPemToBinary(pemKey);
		var importer = events2promise(cryptoSubtle.importKey(exportPKtype, pemKey, encryptAlgorithm, false, usage));
		importer.then(function (keydata) {
				resolve(keydata);
			})
			.catch(function (error) {
				console.log('Failed to import PK: ', error);
			});
	});
}


function processMobileData(TMPsocketRelay, originSocketArray, data, cb) {
	var payloadX = data.payload?data.payload:data;
	var type          = payloadX.data.type;
	var tmpSocketID   = data.socketId;
	var encryptedData = payloadX.data;
	var decryptedData;

	function onMessageDecryptedToken(err, decryptedDataB64) {
		if (!err) {
			decryptedData = JSON.parse(atob(decryptedDataB64));
			initCryptoSession(TMPsocketRelay, originSocketArray, data, decryptedData);

			//cb && cb(decryptedData);
		}
		else {
			console.log('failed to decrypt login token');
			TMPsocketRelay.emit('data', {
				'socketId': tmpSocketID,
				'payload':  'failed to decrypt mobile PK'
			});
		}

	}

	function onMessageDecryptedKey(err, decryptedDataB64) {
		if (!err) {
			decryptedData = JSON.parse(atob(decryptedDataB64));

			var key2import = decryptedData.pk;

			importPublicKey(key2import, PK_RSAOAEP, ["encrypt"]).then(function (keydata) {
				console.log("Successfully imported RSAOAEP PK from external source..", decryptedData);
				sessionRSAPK = keydata;
				initCryptoSession(TMPsocketRelay, originSocketArray, data, decryptedData);

				importPublicKey(key2import, PK_PKCS, ["verify"]).then(function (keydata) {
					console.log("Successfully imported RSAPKCS PK from external source");
					sessionRSAPKverify = keydata;
					if (cb) {
						cb(decryptedData);
					}
				}).catch(function (err) {
					console.error('Import *Verify Key* Failed', err);
				});

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
		case 'login_token':
			console.log('Got login token');
			decryptMobileData((encryptedData), RSAOAEP, keyPair.privateKey, onMessageDecryptedToken);
			return;
		case 'approval_request':
			console.log('Registration approval started');
			cb = function () {
				console.log('Registration validation requesting image');
				validateSession(userImageRequired).then(function () {
					userImageRequested = false;

				}).catch(function () {
					userImageRequested = false;

				});
			};
			decryptMobileData((encryptedData), RSAOAEP, keyPair.privateKey, onMessageDecryptedKey);
			return;
		case 'info_packet_response':
			console.log('info_packet_response data = ', payloadX.data);
			waitingForMobileConnection && clearTimeout(waitingForMobileConnection);
			// var onPublicKeyImported = function (keydata) {
			// 	console.log("Successfully imported RSAOAEP PK from external source..", decryptedData);
			// 	sessionRSAPK = keydata;
			// 	initCryptoSession(TMPsocketRelay, originSocketArray, data, decryptedData);
			// };



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
					else {
						try {
							var parsedData = JSON.parse(decryptedData);
							if (parsedData.type && parsedData.type == 'userImage') {
								var src       = 'data:image/jpeg;base64,' + parsedData.payload.image;
								sha256(parsedData.payload.image).then(function(imageData){
									switch (auth_mode) {
										case 'Provision':
											console.log('Provision: sending image data for confirmation');


											window.getNotifManagerInstance().notify('SHOW_USER_IMAGE',
												{
													src:       src,
													imageData: imageData
												});
											break;
										case 'Session':
											userData = parsedData.payload.userID;

											originTmpSocket.emit('userImageVerify', JSON.stringify({
												'signedData': imageData,
												'signature':  parsedData.payload.imageSign,
												'signedBy':   parsedData.payload.imageSignedBy,
												'userID':     parsedData.payload.userID
											}));

											originTmpSocket.on('userImageStatus', function (status) {
												console.log('User image verification: ', status);
												if (status == 'pass' && src) {
													window.getNotifManagerInstance().notify('SHOW_USER_IMAGE',
														{
															src:       src,
															imageData: imageData,
															userID:    parsedData.payload.userID
														});
												}
												else {
													onUserAction(false);
												}
											});
											break;
										default:
											console.error('invalid mode');

									}
								}).catch(function(error){
									console.error(error);
								});
							}
						}
						catch (e) {
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
		case 'restart_pairing':
			logout();
			return;
		default:
			console.error('unknown payload type ' + type);
			return;
	}
}

function sendEncryptedData(target, socketId, data, cb, uid) {
	encryptWithPK(data, function (error, cipheredData) {
		if (!error) {
			if(uid)
				target.emit('data', {
					'socketId': socketId,
					'data':  cipheredData,
					'host': uid
				});
			else
				target.emit('data', {
					'socketId': socketId,
					'payload':  cipheredData
				});
		}
		else {
			console.error('Data encryption failed: ', error);
			target.emit('data', {
				'socketId': socketId,
				'payload':  'Data encryption failed',
				'host': uid
			});
		}
		cb && cb();
	});
}


function initCryptoSession(relaySocket, originSocketArray, data, decryptedData) {
	originTmpSocket = originSocketArray.GW;
	console.log('...Got message from mobile:', decryptedData);
	if (decryptedData.source) {
		originTmpSocket = (decryptedData.source == 'qr') ? originSocketArray.QR : (decryptedData.source == 'sound') ? originSocketArray.WH : originSocketArray.AP;
	}



	events2promise(cryptoSubtle.exportKey(exportPKtype, keyPair.publicKey))
		.then(function (mobPK) {
			var PK = null;
			if(engineFlag)
				PK = jwk2pem(JSON.parse(atob(arrayBufferToBase64String(mobPK))));
			else
				PK = arrayBufferToBase64String(mobPK);
			if (!userImageRequested) {
				userImageRequested = true;
				switch (auth_mode) {
					case 'Provision':
						if (decryptedData.reg_data) {
							var user_hash = null;

							try {
								user_hash = JSON.parse(decodeURIComponent(getCookie('beame_reg_data'))).hash;
							} catch (e) {
							}

							originTmpSocket.emit('InfoPacketResponse',
								{
									'pin':       decryptedData.reg_data.pin,
									'otp':       decryptedData.otp,
									'pk':        PK,
									'edge_fqdn': decryptedData.edge_fqdn,
									'email':     decryptedData.reg_data.email,
									'name':      decryptedData.reg_data.name,
									'nickname':  null,
									'user_id':   decryptedData.reg_data.user_id,
									'hash':      user_hash
								});
						}
						validateSession(userImageRequired).then(function () {
							userImageRequested = false;

						}).catch(function () {
							userImageRequested = false;

						});
						break;

					case 'Session':
						validateSession(userImageRequired).then(function () {
							if(getCookie('usrInData')){
								setCookie('usrInData',
									JSON.stringify({token:decryptedData.payload.token,uid:getVUID()}), 0.24);
							}
							userImageRequested = false;
							TMPsocketOriginQR && TMPsocketOriginQR.emit('_disconnect');
							TMPsocketOriginWh && TMPsocketOriginWh.emit('_disconnect');
							userData = decryptedData.payload.userID;
							startGatewaySession(decryptedData.payload.token, userData, relaySocket, decryptedData.uid);
						}).catch(function () {
							userImageRequested = false;
							window.alert('Session failure : image validation');
						});
						return;

					default:
						window.alert('Unknown Auth mode');
						allowLogout && logout();
						return;
				}


			}
		})
		.catch(function (error) {
			originTmpSocket.emit('InfoPacketResponseError',
				{'pin': data.payload.data.otp, 'error': 'mobile PK failure'});
			console.log('<*********< error >*********>:', error);
		});

	events2promise(cryptoSubtle.exportKey(exportPKtype, keyPairSign.publicKey || keyPairSign))
		.then(function (keydata) {
			var PK = null;
			if(engineFlag)
				PK = jwk2pem(JSON.parse(atob(arrayBufferToBase64String(keydata))));
			else
				PK = arrayBufferToBase64String(keydata);

			sendEncryptedData(relaySocket, data.socketId,
				str2ab(JSON.stringify({
					'type': 'sessionSecData',
					'data': {
						'pk':          PK,
						'sign':        sessionServiceDataSign,
						'sessionData': sessionServiceData
					}
				})));
		})
		.catch(function (err) {
			console.error('Export Public Sign Key Failed', err);
		});

}

function sha256(data) {
	return events2promise(cryptoSubtle.digest("SHA-256", str2ab(data))).then(function (hash) {
		return arrayBufferToBase64String(hash);
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

//https://github.com/vibornoff/webcrypto-shim/blob/master/LICENSE
function b2der ( buf, ctx ) {
	if ( buf instanceof ArrayBuffer ) buf = new Uint8Array(buf);
	if ( !ctx ) ctx = { pos: 0, end: buf.length };

	if ( ctx.end - ctx.pos < 2 || ctx.end > buf.length ) throw new RangeError("Malformed DER");

	var tag = buf[ctx.pos++],
		len = buf[ctx.pos++];

	if ( len >= 0x80 ) {
		len &= 0x7f;
		if ( ctx.end - ctx.pos < len ) throw new RangeError("Malformed DER");
		for ( var xlen = 0; len--; ) xlen <<= 8, xlen |= buf[ctx.pos++];
		len = xlen;
	}

	if ( ctx.end - ctx.pos < len ) throw new RangeError("Malformed DER");

	var rv;

	switch ( tag ) {
		case 0x02: // Universal Primitive INTEGER
			rv = buf.subarray( ctx.pos, ctx.pos += len );
			break;
		case 0x03: // Universal Primitive BIT STRING
			if ( buf[ctx.pos++] ) throw new Error( "Unsupported bit string" );
			len--;
		case 0x04: // Universal Primitive OCTET STRING
			rv = new Uint8Array( buf.subarray( ctx.pos, ctx.pos += len ) ).buffer;
			break;
		case 0x05: // Universal Primitive NULL
			rv = null;
			break;
		case 0x06: // Universal Primitive OBJECT IDENTIFIER
			var oid = btoa( b2s( buf.subarray( ctx.pos, ctx.pos += len ) ) );
			if ( !( oid in oid2str ) ) throw new Error( "Unsupported OBJECT ID " + oid );
			rv = oid2str[oid];
			break;
		case 0x30: // Universal Constructed SEQUENCE
			rv = [];
			for ( var end = ctx.pos + len; ctx.pos < end; ) rv.push( b2der( buf, ctx ) );
			break;
		default:
			throw new Error( "Unsupported DER tag 0x" + tag.toString(16) );
	}

	return rv;
}
var oid2str = { 'KoZIhvcNAQEB': '1.2.840.113549.1.1.1' },
	str2oid = { '1.2.840.113549.1.1.1': 'KoZIhvcNAQEB' };

function pkcs2jwk ( k ) {
	var info = b2der(k), prv = false;
	if ( info.length > 2 ) prv = true, info.shift(); // remove version from PKCS#8 PrivateKeyInfo structure
	var jwk = { 'ext': true };
	switch ( info[0][0] ) {
		case '1.2.840.113549.1.1.1':
			var rsaComp = [ 'n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi' ],
				rsaKey  = b2der( info[1] );
			if ( prv ) rsaKey.shift(); // remove version from PKCS#1 RSAPrivateKey structure
			for ( var i = 0; i < rsaKey.length; i++ ) {
				if ( !rsaKey[i][0] ) rsaKey[i] = rsaKey[i].subarray(1);
				jwk[ rsaComp[i] ] = s2a( b2s( rsaKey[i] ) );
			}
			jwk['kty'] = 'RSA';
			break;
		default:
			throw new TypeError("Unsupported key type");
	}
	return jwk;
}

function s2a ( s ) {
	return btoa(s).replace(/\=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b2s ( b ) {
	if ( b instanceof ArrayBuffer ) b = new Uint8Array(b);
	return String.fromCharCode.apply( String, b );
}

function jwk2pem ( k ) {
	var key, info = [ [ '', null ] ], prv = false;
	switch ( k.kty ) {
		case 'RSA':
			var rsaComp = [ 'n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi' ],
				rsaKey = [];
			for ( var i = 0; i < rsaComp.length; i++ ) {
				if ( !( rsaComp[i] in k ) ) break;
				var b = rsaKey[i] = s2b( a2s( k[ rsaComp[i] ] ) );
				if ( b[0] & 0x80 ) rsaKey[i] = new Uint8Array(b.length + 1), rsaKey[i].set( b, 1 );
			}
			if ( rsaKey.length > 2 ) prv = true, rsaKey.unshift( new Uint8Array([0]) ); // add version to PKCS#1 RSAPrivateKey structure
			info[0][0] = '1.2.840.113549.1.1.1';
			key = rsaKey;
			break;
		default:
			throw new TypeError("Unsupported key type");
	}
	info.push( new Uint8Array( der2b(key) ).buffer );
	if ( !prv ) info[1] = { 'tag': 0x03, 'value': info[1] };
	else info.unshift( new Uint8Array([0]) ); // add version to PKCS#8 PrivateKeyInfo structure
	return arrayBufferToBase64String( new Uint8Array( der2b(info) ).buffer);
}

function der2b ( val, buf ) {
	if ( !buf ) buf = [];

	var tag = 0, len = 0,
		pos = buf.length + 2;

	buf.push( 0, 0 ); // placeholder

	if ( val instanceof Uint8Array ) {  // Universal Primitive INTEGER
		tag = 0x02, len = val.length;
		for ( var i = 0; i < len; i++ ) buf.push( val[i] );
	}
	else if ( val instanceof ArrayBuffer ) { // Universal Primitive OCTET STRING
		tag = 0x04, len = val.byteLength, val = new Uint8Array(val);
		for ( var i = 0; i < len; i++ ) buf.push( val[i] );
	}
	else if ( val === null ) { // Universal Primitive NULL
		tag = 0x05, len = 0;
	}
	else if ( typeof val === 'string' && val in str2oid ) { // Universal Primitive OBJECT IDENTIFIER
		var oid = s2b( atob( str2oid[val] ) );
		tag = 0x06, len = oid.length;
		for ( var i = 0; i < len; i++ ) buf.push( oid[i] );
	}
	else if ( val instanceof Array ) { // Universal Constructed SEQUENCE
		for ( var i = 0; i < val.length; i++ ) der2b( val[i], buf );
		tag = 0x30, len = buf.length - pos;
	}
	else if ( typeof val === 'object' && val.tag === 0x03 && val.value instanceof ArrayBuffer ) { // Tag hint
		val = new Uint8Array(val.value), tag = 0x03, len = val.byteLength;
		buf.push(0); for ( var i = 0; i < len; i++ ) buf.push( val[i] );
		len++;
	}
	else {
		throw new Error( "Unsupported DER value " + val );
	}

	if ( len >= 0x80 ) {
		var xlen = len, len = 4;
		buf.splice( pos, 0, (xlen >> 24) & 0xff, (xlen >> 16) & 0xff, (xlen >> 8) & 0xff, xlen & 0xff );
		while ( len > 1 && !(xlen >> 24) ) xlen <<= 8, len--;
		if ( len < 4 ) buf.splice( pos, 4 - len );
		len |= 0x80;
	}

	buf.splice( pos - 2, 2, tag, len );

	return buf;
}
function s2b ( s ) {
	var b = new Uint8Array(s.length);
	for ( var i = 0; i < s.length; i++ ) b[i] = s.charCodeAt(i);
	return b;
}

function a2s ( s ) {
	s += '===', s = s.slice( 0, -s.length % 4 );
	return atob( s.replace(/-/g, '+').replace(/_/g, '/') );
}