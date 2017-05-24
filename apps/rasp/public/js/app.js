/**
 * Created by zenit1 on 28/11/2016.
 */
"use strict";

var imgLight,raspMsgContainer, toggleSwitch , _socket = null;

function sendCmd(cmd){


	_socket.emit('switch',{cmd:cmd});

	var xhr = new XMLHttpRequest();
	var url = "/switch/" + cmd;
	xhr.open("POST", url, true);

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

function switchLighter(isOn){
	if(isOn){
		imgLight.src = 'img/light-on.png';

	} else {
		imgLight.src = 'img/light-off.png';
	}

	toggleSwitch.checked = isOn;
}

function onRaspLoaded(){

	imgLight = document.getElementById('img-light');
	raspMsgContainer= document.getElementById('rasp-msg');

	toggleSwitch = document.getElementById('switcher');

	var state = getCookie('beame_led_state');

	switchLighter(state == 1);

	toggleSwitch.addEventListener('click', function(){
		var cmd;
		if(toggleSwitch.checked == true){

			cmd = 'on';
		} else {

			cmd = 'off';
		}

		switchLighter(cmd == 'on');

		sendCmd(cmd);
	});

	_socket = io.connect('/light', {'force new connection': true});

	_socket.on('switch',function(data){
		if(data && data.cmd){
			switchLighter(data.cmd == 'on');
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
function getCookie(cname) {
	var name = cname + "=";
	var ca = document.cookie.split(';');
	for(var i = 0; i <ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length,c.length);
		}
	}
	return "";
}

document.addEventListener("DOMContentLoaded", onRaspLoaded);