/**
 * Created by zenit1 on 28/11/2016.
 */
"use strict";

var imgLight,btnLightOn,btnLightOff,raspMsgContainer , _socket = null;

function sendCmd(sender,cmd, sendMessage){

	// if(hasClass(sender,'disabled')){
	// 	return;
	// }

	switch (cmd){
		case 'on':
			imgLight.src = 'img/light-on.png';
			addClass(btnLightOn,'disabled');
			removeClass(btnLightOff,'disabled');
			break;
		case 'off':
			imgLight.src = 'img/light-off.png';
			addClass(btnLightOff,'disabled');
			removeClass(btnLightOn,'disabled');
			break;
	}

	var xhr = new XMLHttpRequest();
	var url = "/switch/" + cmd;
	xhr.open("POST", url, true);
	if(sendMessage){
		_socket.emit('switch',{cmd:cmd});
	}
	xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded");
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4 && xhr.status == 200) {
			var resp = JSON.parse(xhr.responseText);

			if(resp.status == 200){
				//todo move button logic here
			}
			else if(resp.status == 500){

				raspMsgContainer.innerHTML = resp.message;

			}
		}
	};
	xhr.send();
}

function onRaspLoaded(){
	imgLight = document.getElementById('img-light');
	btnLightOn = document.getElementById('btn-light-on');
	btnLightOff = document.getElementById('btn-light-off');
	raspMsgContainer= document.getElementById('rasp-msg');

	_socket = io.connect('/light', {'force new connection': true});

	_socket.on('switch',function(data){
		if(data && data.cmd){
			sendCmd(data.cmd == 'on' ? btnLightOn : btnLightOff,data.cmd, false);
		}
	});

	_socket.on('connect', function () {

		console.log('light socket connected, ');
	});
}

function hasClass(el, className) {
	if (el.classList)
		return el.classList.contains(className);
	else
		return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'))
}

function addClass(el, className) {
	if (el.classList)
		el.classList.add(className);
	else if (!hasClass(el, className)) el.className += " " + className
}

function removeClass(el, className) {
	if (el.classList)
		el.classList.remove(className);
	else if (hasClass(el, className)) {
		var reg = new RegExp('(\\s|^)' + className + '(\\s|$)');
		el.className=el.className.replace(reg, ' ')
	}
}

document.addEventListener("DOMContentLoaded", onRaspLoaded);