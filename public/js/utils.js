/**
 * Created by zenit1 on 16/11/2016.
 */

function deleteCookie( name ) {
	document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function onStaticPageLoaded() {
	deleteCookie('beame_userinfo');

	var appData = getCookie('beame_service');
	if(!appData) return;

	var service = JSON.parse(decodeURIComponent(appData));

	var label = document.createElement("span");
	label.innerHTML = ('Current service: ' +  service.name + ', v. '+  service.version);
	label.className = "srvc";
	document.body.appendChild(label);

}

function getParameterByName(name, url) {
	if (!url) {
		url = window.location.href;
	}
	name = name.replace(/[\[\]]/g, "\\$&");
	var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
	    results = regex.exec(url);
	if (!results) return null;
	if (!results[2]) return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
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

function logout(){
	try {
		window.location.href = decodeURIComponent(getCookie('beame_logout_url'));
	} catch (e) {
	}
}