/**
 * Created by zenit1 on 16/11/2016.
 */
var engineFlag   = (!navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Firefox'));
var exportPKtype = engineFlag ? 'jwk' : 'spki';

function setCookie(cname, cvalue, exdays) {
	var d = new Date();
	d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
	var expires     = "expires=" + d.toUTCString();
	document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function deleteCookie(name) {
	document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function verifyInputData(relay, cb) {
	if (delegatedUserId) {
		cb(true);
		var qrData                 = 'none';
		waitingForMobileConnection = setTimeout(function () {
			window.alert('Timed out waiting for mobile connection');
			window.location.href = window.location.origin;//TODO restart local login page without parameters?
		}, wait4MobileTimeout);
		var sock                   = TMPsocketOriginQR || TMPsocketOriginWh || TMPsocketOriginAp;
		events2promise(cryptoSubtle.exportKey(exportPKtype, keyPair.publicKey))
			.then(function (keydata) {
				var PK = null;
				if (engineFlag)
					PK = jwk2pem(JSON.parse(atob(arrayBufferToBase64String(keydata))));
				else
					PK = arrayBufferToBase64String(keydata);
				var imgReq = (reg_data && reg_data.userImageRequired) ? reg_data.userImageRequired : userImageRequired;
				qrData     = JSON.stringify({
					'relay':         relay, 'PK': PK, 'UID': getVUID(),
					'PIN':           getParameterByName('pin') || 'none', 'TYPE': 'LOGIN',
					'TIME':          Date.now(), 'REG': 'LOGIN',
					'imageRequired': imgReq, 'appId': JSON.parse(sessionServiceData).appId
				});
				console.log('* notifyMobile:', qrData);
				sock && sock.emit('notifyMobile', JSON.stringify(Object.assign((JSON.parse(delegatedUserId)), {qrData: qrData})));
				delegatedUserId = undefined;

			}).catch(function (e) {
			setTimeout(function () {
				sock && sock.emit('notifyMobile', JSON.stringify(Object.assign((JSON.parse(delegatedUserId)), {
					qrData: 'NA',
					error:  e
				})));
				delegatedUserId      = undefined;
				window.location.href = window.location.origin;//TODO restart local login page without parameters?
			}, 30000);
		});
	}
	else cb(false);
}

function onStaticPageLoaded() {
	deleteCookie('beame_userinfo');

	var appData = getCookie('beame_service');
	if (!appData) return;

	var service = JSON.parse(decodeURIComponent(appData));

	var label       = document.createElement("span");
	label.innerHTML = ('Current service: ' + service.name + ', v. ' + service.version);
	label.className = "srvc";
	document.body.appendChild(label);

}

function onFatalError(message) {
	setQRStatus(message);
	setTimeout(function () {
		$('#qr').hide();
		$('.qr-status').css({'font-size': '22px'});
	}, 500);
}

function processVirtualHostRegistrationError(data, cb) {
	try {
		var parsed = (typeof data === 'object') ? data : JSON.parse(data);
		parsed.message && console.warn('VirtualHostRegistrationError:', parsed.message);
		if (parsed.code) {
			switch (parsed.code) {
				case 'signature':
				case 'subdomain':
				case 'panic':
					console.error('fatal :', parsed.code);
					onFatalError('Unable to proceed with provided credentials');
					window.stopAllRunningSessions = true;
					cb('fatal');
					break;
				case 'expired':
					cb('expired');
					break;
				case 'hostname':
					cb('retry');
					break;
				case 'payload':
					console.log('VirtualHostRegistration failed: payload');
					break;
				default:
					console.error('fatal default:', parsed.code);
					onFatalError('Unexpected error');
					cb('fatal');
					break;
			}
		}
	}
	catch (e) {
		console.error('fatal :', e);
		cb('fatal');
	}
}

function getParameterByName(name, url) {
	if (!url) {
		url = window.location.href;
	}
	name        = name.replace(/[\[\]]/g, "\\$&");
	var regex   = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
	    results = regex.exec(url);
	if (!results) return null;
	if (!results[2]) return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function getCookie(cname) {
	var name = cname + "=";
	var ca   = document.cookie.split(';');
	for (var i = 0; i < ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0) == ' ') {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length, c.length);
		}
	}
	return "";
}

function logout() {
	try {
		var usrData          = getCookie('usrInData');
		var target           = (usrData && (usrData.length > 0)) ? 'beame_logout_to_login_url' : 'beame_logout_url';
		window.location.href = decodeURIComponent(getCookie(target));
	} catch (e) {
	}
}

function setPageTitle(title) {
	document.title = title;
}

function setClientCertLoginBtn() {
	var clientLogin = getCookie('beame_client_login_url');
	try {


		var clObj = JSON.parse(decodeURIComponent(clientLogin));
		if (clObj.url) {
			var btn              = document.getElementById('cls-link');
			btn.href             = (clObj.url + location.search);
			btn.style.visibility = 'visible';
		}
	}
	catch (e) {

	}

}

function loadGwBundle() {

	var head = document.getElementsByTagName('head')[0];
	var js   = document.createElement("script");

	js.type = "text/javascript";

	if (engineFlag) {
		js.src = "js/jwk-bundle.js";
		head.appendChild(js);
		console.log('jwk-bundle loaded');
	}
	else
		console.log(navigator.userAgent);
}

function _addAttribute(element, attr, value) {
	var att   = document.createAttribute(attr);
	att.value = value;
	element.setAttributeNode(att);

	return element;
}

function buildRegistrationForm(container_selector, exclude) {


	var settings = getCookie('beame_prov_settings');
	if (!settings) return;

	var excludeLoginProvider = exclude === undefined ? true : exclude;

	var data = JSON.parse(decodeURIComponent(settings));

	console.log('Provision Settings data %j', data);

	var container = document.querySelector(container_selector);

	for (var i = 0; i < data.length; i++) {
		var filed = data[i];

		if(filed.LoginProvider && excludeLoginProvider) continue;

		var input = document.createElement("input");
		input     = _addAttribute(input, 'class', 'form-input');
		input     = _addAttribute(input, 'name', filed.FiledName);
		input     = _addAttribute(input, 'data-bind', "value:" + filed.FiledName);


		input     = _addAttribute(input, 'placeholder', filed.Label);
		input     = _addAttribute(input, 'type', filed.IsPassword ? 'password' : 'text');
		if (filed.Required === true) {
			input = _addAttribute(input, 'required', 'required');
		}
		container.appendChild(input);
	}
}

function setZendesk() {
	var settings = getCookie('beame_settings');


	if (!settings) return;

	var s = JSON.parse(decodeURIComponent(settings));

	if (s.showZendesk === 'true' || s.showZendesk === true) {
		var zendesk_script = document.createElement('script');

		zendesk_script.setAttribute('src', 'js/zendesk-widget.js');

		document.head.appendChild(zendesk_script);
	}
}

setZendesk();