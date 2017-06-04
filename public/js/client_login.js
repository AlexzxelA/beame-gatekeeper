/**
 * Created by zenit1 on 04/06/2017.
 */

function setIframeUrl(url) {
	if (url) {
		var iframe = document.getElementById('ifrm-content');

		if (url.indexOf('beame-gw/logout') > 0) {
			return;
		}

		iframe.src = "about:blank";

		iframe.style.display = 'block';

		iframe.src = url;
	}
}

function clientLoginLogout(){

		try {

			var logout = getCookie('beame_logout_url');
			var logoutObj = JSON.parse(decodeURIComponent(logout));
			window.location.href = logoutObj.url;
		}
		catch(e){
			console.log(e)
		}
}

function onPageLoaded(){
	var appData = getCookie('beame_service');
	if(appData){
		var service = JSON.parse(decodeURIComponent(appData)),
		    span = document.getElementById('wlcm-app');

		//span.innerHTML = service.name + ', v.' + service.version;
	}

	$.get('templates/app-menu.tmpl.html')
		.success(function (result) {
			$("body").append(result);
		})
		.error(function () {
			console.error("Error Loading Templates -- TODO: Better Error Handling");
		});

	$.getJSON('/apps/get',function(data){
		console.log('apps %j', data);
		for(var i =0;i< data.length;i++){
			$("#ul-apps").append("<li class='app-item' data-value=\"" + data[i].app_id + "\">" + data[i].name + "</li>");
		}

		$("#ul-apps").append("<li><i class='app-item-logout'>Logout</i></li>");

		$('.app-item-logout').on('click',clientLoginLogout);

		$("#ul-apps > .app-item").on('click',function(e){
			var app_id = $(e.currentTarget).attr('data-value');

			$.ajax({
				url:         'apps/get/' + app_id,
				cache:       false,
				type:        'Get',
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				, success:   function (response) {
					console.log(response);
					if(response.type=='redirect'){
						var payload = response.payload,
						    url = payload.url;

						setIframeUrl(url);
						/* Handle Apps Menu for mobile  */
						menuMob.classList.remove('isShownMob');
						menuMobBtn.classList.add('isShownMob');
						menuMobBtn.textContent = 'menu';
					}
				}
				,error:function(e){
					console.error(e);
				}
			});
		})

	});

	var userObj = getCookie('beame_userinfo');
	if (userObj) {
		try {
			console.log('userObj',userObj);
			var user = JSON.parse(decodeURIComponent(userObj));
			if (user.name) {
				var h4 = document.getElementById('wlcm-user');

				h4.innerHTML = user.name || user.fqdn;
			}
		} catch (e) {
		}
	}


	var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
	var eventer = window[eventMethod];
	var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

	eventer(messageEvent, function(event) {
		try {
			var data = event.data;
			if(data.event == 'logout'){
				clientLoginLogout();
			}
		} catch (e) {
		}
	});
}

/* Apps Menu for mobile  */
var menuMob = document.querySelector('.mobile-menu-wrapper'),
    menuMobBtn = document.querySelector('.mobile-menu-wrapper-btn');

menuMobBtn.addEventListener('click', function (e) {
	e.preventDefault();
	menuMob.classList.toggle('isShownMob');
	this.textContent = (this.textContent.toLowerCase() === 'menu') ? this.textContent = 'close' : this.textContent = 'menu';
});

document.addEventListener("DOMContentLoaded", onPageLoaded);