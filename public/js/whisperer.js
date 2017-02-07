/**
 * Created by Alexz on 15/11/2016.
 */

"use strict";
/**
 * Created by filip on 18/07/2016.
 */
var WhPIN = null,
    WhUID = null,
    WhTMPSocketRelay,
    whTmpSocketId,
    WhRelayEndpoint,
	tmpHostArr=[],
	activeHosts = [],
	tmpHostNdx,
	pinRefreshRate,
	pairingSession;

var app = angular.module("WhispererWeb", []);

app.controller("MainCtrl", function ($scope) {
	tmpHostNdx = 0;

	if(auth_mode == 'Provision') return;

	var tryDigest = function (scope) {
		if (!scope.$phase) {
			try {
				scope.$digest();
			}
			catch (e) {
			}
		}
	};

	var whispererTimeout = 1000 * 60;

	$scope.showWelcome = true;
	$scope.showConn    = true;
	$scope.showMsg     = false;
	$scope.w_msg       = '';
	$scope.soundOn     = true;

	$scope.showPopup = function (msg) {
		$scope.showWelcome = false;
		$scope.showMsg     = true;
		if (msg) {
			$scope.w_msg = msg;
		}
		tryDigest($scope);
	};

	/*---------*/
	if (!window.btoa) {
		$scope.btoa = function (input) {
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

	$scope.nowPinging = false;


	$scope.startPlaying = function () {
		if ($scope.audio) {//} && $scope.socketAlive) {
			console.log('playing: ' + $scope.pinData);
			try {
				if ($scope.audio.playing === true) {
					$scope.audio.pause();
					$scope.audio.currentTime = 0;

				}
				$scope.audio.src  = $scope.audioData;
				$scope.audio.loop = true;
				$scope.audio.play();
				$scope.audio.playing = true;
				$scope.showMsg = false;
				tryDigest($scope);

			} catch (e) {
				console.error('start playing', e);
			}
		}
	};
	$scope.stopPlaying  = function () {
		try {
			if ($scope.audio) {
				$scope.audio.pause();
				$scope.audio.playing = false;
				$scope.audio.loop    = false;

				tryDigest($scope);
			}
		} catch (e) {
			console.error('stop playing', e);
		}

	};


	$scope.playPIN = false;

	$scope.socket = io.connect("/whisperer", socketio_options);

	$scope.socket.on('connect',function () {
		setOriginSocket('WH',$scope.socket);
	});

	$scope.socket.on('wh_timeout', function (timeout) {
		console.log('on whisperer timeout', timeout);
		whispererTimeout = timeout * 2;
	});

	$scope.socket.on('restartWhisperer', function () {
		console.log("restarting whisperer");
		location.reload();
	});


	$scope.socket.on('connect_ok', function (data) {
		console.log('Terminating audio with: ' + JSON.stringify(data));//XXX
		$scope.stopPlaying();
		$scope.showPopup('Code matched');
	});

	$scope.socket.on('init_mobile_session', function (data) {
		WhPIN = data.pin;
		getKeyPairs(function (error, keydata) {
			if (error) {
				console.log(error);
				return;
			}
			if(data && !sessionServiceData){/*do not factor out: AZ*/
				sessionServiceData = JSON.stringify({'matching':data.matching || matchingFqdn, 'service':data.service || serviceName, 'appId': data.appId});
				signArbitraryData(sessionServiceData, function (err, sign) {
					if(!err){
						sessionServiceDataSign = arrayBufferToBase64String(sign);
					}
					else{
						sessionServiceDataSign = err;
					}
				});
			}
			if(isAudioSession()) {
				WhUID = getVUID();
				console.log('Received init_mobile_session:', Date.now());
				$scope.socket.emit('virtSrvConfig', {'UID': vUID});
			}
		});

	});


	// function initRelay() {
	//
	// 	WhTMPSocketRelay.on('disconnect', function () {
	// 		console.log('disconnected, ID = ', WhTMPSocketRelay.id);
	// 		$scope.socket.emit('virtSrvConfig', {'UID': WhUID});
	// 	});
	//
	// 	WhTMPSocketRelay.on('data', function (data) {
	// 		whTmpSocketId = data.socketId;
	// 		processMobileData(WhTMPSocketRelay, $scope.socket, data);
	// 		WhTMPSocketRelay.beame_relay_socket_id = data.socketId;
	// 	});
	//
	// 	WhTMPSocketRelay.on('create_connection', function () {
	// 		console.log('Wh create_connection, ID = ', WhTMPSocketRelay.id);
	// 	});
	//
	// 	WhTMPSocketRelay.on('hostRegistered', function (data) {
	// 		console.log('Wh hostRegistered, ID = ', WhTMPSocketRelay.id, '.. hostname: ', data.Hostname);
	// 		if (keyGenerated) {
	// 			var WhUID = data.Hostname;
	// 			//noinspection JSUnresolvedFunction,JSUnresolvedVariable
	// 			sendQrDataToWhisperer('https://' + WhRelayEndpoint, WhUID, $scope.socket);
	//
	// 		}
	// 	});
	//
	// 	WhTMPSocketRelay.on('error', function () {
	// 		console.log('error, ID = ', WhTMPSocketRelay.id);
	// 	});
	//
	// 	WhTMPSocketRelay.on('_end', function () {
	// 		console.log('end, ID = ', WhTMPSocketRelay.id);
	// 	});
	// }

	$scope.socket.on('mobileProv1', function (data) {
		if (data.data && getRelaySocket() && getRelaySocketID()) {
			console.log('Whisperer mobileProv1:', data);
			if(!userImageRequired)
				window.getNotifManagerInstance().notify('STOP_PAIRING', null);
			sendEncryptedData(getRelaySocket(), getRelaySocketID(), str2ab(JSON.stringify(data)));
		}
	});

	// $scope.socket.on('relayEndpoint', function (data) {
	// 	if(isAudioSession()) {
	// 		console.log('relayEndpoint', data);
	// 		try {
	// 			if (WhTMPSocketRelay)WhTMPSocketRelay.disconnect();
	// 			var parsedData = JSON.parse(data);
	// 			WhRelayEndpoint = parsedData['data'];
	// 			var lclTarget = "https://" + WhRelayEndpoint + "/control";
	//
	// 			if (WhRelayEndpoint) {
	// 				//noinspection ES6ModulesDependencies,NodeModulesDependencies
	// 				WhTMPSocketRelay = io.connect(lclTarget);
	// 				WhTMPSocketRelay.on('connect', function () {
	// 					console.log('Connected, ID = ', WhTMPSocketRelay.id);
	// 					WhTMPSocketRelay.emit('register_server',
	// 						{
	// 							'payload': {
	// 								'socketId': null,
	// 								'hostname': WhUID,
	// 								//'signedData':WhUID,
	// 								'signature': parsedData['signature'],
	// 								//'signedBy':window.location.hostname,
	// 								'type': 'HTTPS',
	// 								'isVirtualHost': true
	// 							}
	// 						});
	// 					initRelay();
	// 				});
	// 			}
	// 		}
	// 		catch (e) {
	// 			$scope.socket.emit('browserFailure', {'error': 'relay fqdn get - failed'});
	// 			console.error('failed to parse data:', e);
	// 		}
	// 	}
	// });

	$scope.socket.on('mobile_network_error', function () {
		console.log('Mobile connection failed');
		//alert('Mobile connection failed');
	});

	$scope.socket.on('match_not_found', function () {
		$scope.stopPlaying();
		$scope.showPopup('Matching server not found');

	});

	$scope.socket.on('disconnect', function () {
		console.log('WHISPERER DISCONNECTED');
		//$scope.socketAlive = false;
		//$scope.stopPlaying();
		//    document.getElementById("player").innerHTML = "-- Server disconnected --";
	});

	$scope.socket.on('requestQrData',function () {
		sendQrDataToWhisperer(getRelayFqdn(), getVUID(),$scope.socket);
	});

	$scope.socket.on('userImageSign',function (data) {
		window.getNotifManagerInstance().notify('STOP_PAIRING', null);
		sendEncryptedData(getRelaySocket(), getRelaySocketID(), str2ab(JSON.stringify(data)));
	});

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
				$scope.socket.emit('pinRequest');
			}
		});

		activeHosts[sockId].sock.on('hostRegistered', function (data) {
			console.log('Virtual host registered:', data);
			activeHosts[sockId].name = data.Hostname;
			setBrowserforNewPin(srcData);
		});

		activeHosts[sockId].sock.on('data', function (data) {
			activeHosts[sockId].ID = data.socketId;
			activeHosts[sockId].isConnected = true;
			activeHosts[sockId].connectTimeout = setTimeout(function () {
				if(activeHosts[sockId])activeHosts[sockId].isConnected = false;
			}, 3000);
			// activeHosts[sockId].ID = data.socketId;
			var type          = data.payload.data.type;
			console.log(activeHosts[sockId],':',type);
			if(type == 'direct_mobile'){
				if(keyPair){
					events2promise(cryptoObj.subtle.exportKey('spki', keyPair.publicKey))
						.then(function (keydata) {
							var PK = arrayBufferToBase64String(keydata);
							var tmp_reg_data = (auth_mode == 'Provision') ? reg_data : "login";
							var tmp_type = (auth_mode == 'Provision') ? 'PROV' : "LOGIN";

							fullQrData       = JSON.stringify({
								'relay': getRelayFqdn(), 'PK': PK, 'UID': getVUID(), 'appId' : appId,
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
				destroyTmpHosts();
				(tmpHost) = undefined;
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

	function destroyTmpHosts() {
		stopAllRunningSessions = true;
		clearInterval(pairingSession);
		pairingSession = undefined;
		Object.keys(activeHosts).map(function (tmpHostX, index) {
			if(activeHosts[tmpHostX].sock){
				console.log('Done, deleting host <', index, '> :', activeHosts[tmpHostX].name);
				activeHosts[tmpHostX].sock.emit('cut_client',{'socketId':activeHosts[tmpHostX].ID});
				activeHosts[tmpHostX] = undefined;
			}
		});
		activeHosts = [];
	}

	function initTmpHost(data) {

		$scope.pinData = data.pin;

		if(!data.signature || !data.relay || !data.name || !data.appId ||
			(tmpHostArr[tmpHostNdx] && tmpHostArr[tmpHostNdx].isConnected) ||
			(tmpHostArr[!tmpHostNdx] && tmpHostArr[!tmpHostNdx].isConnected) ||
			!pairingSession)
			return;

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

	function setBrowserforNewPin(data) {
		getWAV(data.pin);
		console.log('PIN:' + data.pin);
		var pinElement = document.getElementById("pin");
		if (pinElement) {
			pinElement.innerHTML = data.pin;
		}
	}

	$scope.socket.on('startPairingSession',function (data) {
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
					$scope.socket.emit('pinRequest');
				}

			}, pinRefreshRate);
			$scope.showConn = false;
			tryDigest($scope);
			initTmpHost(parsed);
		}
	});

	$scope.socket.on('pindata', function (dataRaw) {
		var data = JSON.parse(dataRaw);
		if (!$scope.soundOn) return;

		initTmpHost(data);

	});

	//$scope.socket.on('data', function (data) {
	$scope.gotData = function (data) {
		if (stopAllRunningSessions) {
			closeSession();
		}
		else {
			//$scope.socketAlive = true;
			console.log("data received:" + data.length);

			$scope.audioData = "data:audio/wav;base64," + escape(btoa(data));
			if (!$scope.audio)
				$scope.audio = new Audio();
			$scope.startPlaying();
			//if (!$scope.nowPinging)
			//	$scope.pingSocket();
		}
	};

	$scope.socket.$on('newData', function (event, data) {
		$scope.gotData(data);
	});

	// Welcome screen actions
	$scope.turnSoundOn = function () {
		$scope.playPIN = true;
		$scope.soundOn = true;

		if ($scope.socket) {
			$scope.socket.emit("play_please");
		}

		$scope.startPlaying();
		tryDigest($scope);
	};

	$scope.turnSoundOff = function () {
		$scope.soundOn = false;
		$scope.playPIN = false;

		if ($scope.socket) {
			$scope.socket.emit("stop_please");
		}

		$scope.stopPlaying();
		tryDigest($scope);
	};

	// Popup actions
	$scope.hidePopup = function () {
		$scope.turnSoundOn();
	};

	var closeSession = function(){
		console.log('Audio: close_session received');
		$scope.socket.emit('close_session');
		$scope.stopPlaying();
		$scope.showPopup('Audio stopped');
	};

	window.getNotifManagerInstance().subscribe('STOP_PAIRING', closeSession, null);
	window.getNotifManagerInstance().subscribe('NEW_DATA', $scope.gotData, null);

});

var TmpQrData,
	fullQrData;
function sendQrDataToWhisperer(relay, uid, socket) {
	console.log('sendQrDataToWhisperer - entering');
	if(keyPair){
		events2promise(cryptoObj.subtle.exportKey('spki', keyPair.publicKey))
			.then(function (keydata) {
				var PK = arrayBufferToBase64String(keydata);
				var tmp_reg_data = (auth_mode == 'Provision') ? reg_data : "login";
				var tmp_type = (auth_mode == 'Provision') ? 'PROV' : "LOGIN";

				TmpQrData       = JSON.stringify({
					'relay': relay, 'PK': PK, 'UID': uid,
					'PIN':   WhPIN, 'TYPE': tmp_type, 'TIME': Date.now(), 'REG': tmp_reg_data
				});

				if(!fullQrData)fullQrData = TmpQrData;

				socket.emit('init_mobile_session', TmpQrData);
				console.log('sending qr data to whisperer:', TmpQrData);//XXX
			}).catch(function (err) {
			console.error('Export Public Key Failed', err);
		});
	}
}

app.filter('to_trusted', ['$sce', function ($sce) {
	return function (text) {
		return $sce.trustAsHtml(text);
	};
}]);

app.directive("welcomeTemplate", function () {
	return {
		restrict:    "E",
		templateUrl: "templates/welcome.tpl.html"
	};
});


