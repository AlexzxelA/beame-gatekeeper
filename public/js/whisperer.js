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
    WhRelayEndpoint;

var app = angular.module("WhispererWeb", []);

app.controller("MainCtrl", ["$scope", function ($scope) {

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
	/*function changeCode() {
	 if($scope.socketAlive){
	 console.log("Force change code");
	 socket.emit("changeCode");
	 }
	 }*/
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

		// if ($scope.showWelcome)
		// 	document.getElementById("pin").innerHTML = "audio from server stopped";
	};
	/*$scope.pingSocket   = function () {
	 if (!$scope.socketAlive) {
	 $scope.nowPinging = false;
	 return;
	 }
	 $scope.nowPinging = true;


	 setTimeout(function () {
	 if (--$scope.keepAlive > 0) {
	 $scope.pingSocket();
	 }
	 else {
	 $scope.socketAlive = false;
	 $scope.stopPlaying();
	 console.log('Socket disconnected. Audio stopped');
	 }
	 }, whispererTimeout);
	 };*/

	//pingSocket();
	//$scope.keepAlive = 5;

	//$scope.socketAlive = false;
	$scope.playPIN = false;

	$scope.socket = io.connect("/whisperer", socketio_options);

	$scope.socket.on('wh_timeout', function (timeout) {
		console.log('on whisperer timeout', timeout);
		whispererTimeout = timeout * 2;
	});

	$scope.socket.on('restartWhisperer', function () {
		console.log("restarting whisperer");
		location.reload();
	});


	$scope.socket.on('connect_ok', function (data) {
		console.log('DATA >>>>>>> ' + JSON.stringify(data));//XXX
		$scope.stopPlaying();
		$scope.showPopup('Code matched');
	});

	$scope.socket.on('init_mobile_session', function (data) {
		console.log('init_mobile_session %j', data);
		$scope.stopPlaying();
		$scope.showPopup('Code matched');

		WhPIN = data.pin;
		WhUID = generateUID(24) + VirtualPrefix;

		generateKeyPairs(function (error, data) {
			if (error) return;
			if (!keyGenerated) {
				keyPair      = data.keyPair;
				keyPairSign  = data.keyPairSign;
				keyGenerated = true;
			}
			$scope.socket.emit('virtSrvConfig', {'UID': WhUID});
		});

	});


	function initRelay() {

		WhTMPSocketRelay.on('disconnect', function () {
			console.log('disconnected, ID = ', WhTMPSocketRelay.id);
		});

		WhTMPSocketRelay.on('data', function (data) {
			whTmpSocketId = data.socketId;
			processMobileData(WhTMPSocketRelay, $scope.socket, data);
			WhTMPSocketRelay.beame_relay_socket_id = data.socketId;
		});

		WhTMPSocketRelay.on('create_connection', function () {
			console.log('Wh create_connection, ID = ', WhTMPSocketRelay.id);
		});

		WhTMPSocketRelay.on('hostRegistered', function (data) {
			console.log('Wh hostRegistered, ID = ', WhTMPSocketRelay.id, '.. hostname: ', data.Hostname);
			if (keyGenerated) {
				var WhUID = data.Hostname;
				//noinspection JSUnresolvedFunction,JSUnresolvedVariable
				window.crypto.subtle.exportKey('spki', keyPair.publicKey)
					.then(function (keydata) {
						var PK = arrayBufferToBase64String(keydata);
						console.log('Public Key Is Ready:', PK, '==>', PK);
						if (WhRelayEndpoint.indexOf(WhTMPSocketRelay.io.engine.hostname) < 0) {
							console.log('Crap(w)::', WhRelayEndpoint, '..', WhTMPSocketRelay.io.engine.hostname);
							window.alert('Warning! Suspicious content, please verify domain URL and reload the page..');
						}
						else {
							var tmp_reg_data = (auth_mode == 'Provision') ? reg_data : "login";
							var tmp_type = (auth_mode == 'Provision') ? 'PROV' : "LOGIN";

							var qrData       = JSON.stringify({
								'relay': 'https://' + WhRelayEndpoint, 'PK': PK, 'UID': WhUID,
								'PIN':   WhPIN, 'TYPE': tmp_type, 'TIME': Date.now(), 'REG': tmp_reg_data
							});
							console.log('sending qr data to whisperer %j', qrData);//XXX
							$scope.socket.emit('init_mobile_session', qrData);
						}

					})
					.catch(function (err) {
						console.error('Export Public Key Failed', err);
					});
			}
		});

		WhTMPSocketRelay.on('error', function () {
			console.log('error, ID = ', WhTMPSocketRelay.id);
		});

		WhTMPSocketRelay.on('_end', function () {
			console.log('end, ID = ', WhTMPSocketRelay.id);
		});
	}

	$scope.socket.on('mobileProv1', function (data) {
		if (data.data && WhTMPSocketRelay) {
			var msg = {'socketId': whTmpSocketId, 'payload': JSON.stringify(data)};
			console.log('******** Sedning:: ', msg);
			WhTMPSocketRelay.emit('data', msg);
		}
	});

	$scope.socket.on('relayEndpoint', function (data) {
		console.log('relayEndpoint', data);
		try {
			var parsedData  = JSON.parse(data);
			WhRelayEndpoint = parsedData['data'];
			var lclTarget   = "https://" + WhRelayEndpoint + "/control";

			if (WhRelayEndpoint) {
				//noinspection ES6ModulesDependencies,NodeModulesDependencies
				WhTMPSocketRelay = io.connect(lclTarget);
				WhTMPSocketRelay.on('connect', function () {
					console.log('Connected, ID = ', WhTMPSocketRelay.id);
					WhTMPSocketRelay.emit('register_server',
						{
							'payload': {
								'socketId':      null,
								'hostname':      WhUID,
								//'signedData':WhUID,
								'signature':     parsedData['signature'],
								//'signedBy':window.location.hostname,
								'type':          'HTTPS',
								'isVirtualHost': true
							}
						});
					initRelay();
				});
			}
		}
		catch (e) {
			$scope.socket.emit('browserFailure', {'error': 'relay fqdn get - failed'});
			console.error('failed to parse data:', e);
		}
	});

	$scope.socket.on('mobile_network_error', function () {
		console.log('Mobile connection failed');
		alert('Mobile connection failed');
	});

	$scope.socket.on('match_not_found', function () {
		$scope.stopPlaying();
		$scope.showPopup('Matching server not found');

	});

	$scope.socket.on('disconnect', function () {
		console.log('DISCONNECTED');
		//$scope.socketAlive = false;
		//$scope.stopPlaying();
		//    document.getElementById("player").innerHTML = "-- Server disconnected --";
	});

	$scope.socket.on('pindata', function (data) {
		if (!$scope.soundOn) return;
		$scope.showConn = false;
		tryDigest($scope);
		$scope.pinData = data;
		//$scope.keepAlive = 5;
		console.log('PIN:' + data);
		var pinElement = document.getElementById("pin");
		if (pinElement) {
			pinElement.innerHTML = data;
		}
	});

	$scope.socket.on('data', function (data) {
		if (stopAllRunningSessions) {
			$scope.socket.emit('close_session');
			$scope.stopPlaying();
			$scope.showPopup('Audio stopped');
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

}]);

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


