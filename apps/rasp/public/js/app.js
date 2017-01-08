/**
 * Created by zenit1 on 28/11/2016.
 */
"use strict";

var imgLight, showSupportMessage = true;

function sendCmd(args){

	if(! args || !args.cmd){
		return;
	}

	var cmd = args.cmd;

	switch (cmd){
		case 'on':
			imgLight.src = 'img/light-on.png';
		break;
		case 'off':
			imgLight.src = 'img/light-off.png';
			break;
	}

	var xhr = new XMLHttpRequest();
	var url = "/switch/" + cmd;
	xhr.open("POST", url, true);
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4 && xhr.status == 200) {
			var resp = JSON.parse(xhr.responseText);

			if(resp.status == 200){
				//todo move button logic here
			}
			else if(resp.status == 500){
				if(showSupportMessage){
					alert(resp.message);
					showSupportMessage = false;
				}

			}
		}
	};
	xhr.send();
}

function onRaspLoaded(){
	imgLight = document.getElementById('img-light');

	window.parent.getNotifManagerInstance().subscribe('RASP_CMD', sendCmd);
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