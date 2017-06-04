/**
 * Created by zenit1 on 13/05/2017.
 */
var settings = null, viewDash, viewUsers,viewCreds, viewRegs, viewInvs, viewService ,viewVpn, viewGkLogin,layout;

function initAdminRouters() {

	console.log('load admin routes');

	viewDash  = new kendo.View("#home", {model: settings});
	viewUsers = new kendo.View("#user");
	viewRegs  = new kendo.View("#regs");
	viewInvs  = new kendo.View("#inv");
	viewCreds  = new kendo.View("#tmpl-creds");
	viewVpn  = new kendo.View("#tmpl-vpn");
	viewService  = new kendo.View("#services");
	viewGkLogin  = new kendo.View("#gk-login");

	layout = new kendo.Layout("<section id='content'></section>");

	layout.render($("#app-wrapper"));


	function subscribe(event, callback) {
		$(document).bind(event, function (e, path) {
			//console.log(event + ' completed',path);
			callback();
		});
	}

	var initDash = function () {
		layout.showIn("#content", viewDash);
		loadSettings();
	};

	var initUsers = function () {
		layout.showIn("#content", viewUsers);
		loadUsers();
	};

	var initCreds = function () {
		layout.showIn("#content", viewCreds);
		loadCreds();
	};

	var initRegs = function () {
		layout.showIn("#content", viewRegs);
		loadRegs();
	};

	var initInvitations = function () {
		layout.showIn("#content", viewInvs);
		loadInvitations();
	};

	var initServices = function () {
		layout.showIn("#content", viewService);
		loadServices();
	};

	var initVpn = function () {
		layout.showIn("#content", viewVpn);
		loadVpn();
	};

	var initGkLogins = function () {
		layout.showIn("#content", viewGkLogin);
		loadGkLogins();
	};

	$("#showDash").on("click", function () {
		initDash();
	});
	$("#showUsers").on("click", function () {
		initUsers();
	});
	$("#showCreds").on("click", function () {
		initCreds();
	});
	$("#showRegs").on("click", function () {
		initRegs();
	});
	$("#showInvs").on("click", function () {
		initInvitations();
	});
	$("#showSrv").on("click", function () {
		initServices();
	});
	$("#showVpn").on("click", function () {
		initVpn();
	});
	$("#showGkLogins").on("click", function () {
		initGkLogins();
	});

	var router = new kendo.Router({
		init: function () {
			layout.render("#app-wrapper");
		}
	});

	router.route("/", function () {
		subscribe(ADMIN_TEMPLATES.Dash.event, initDash);
	});

	router.route("/creds", function () {
		subscribe(ADMIN_TEMPLATES.Creds.event, initCreds);
	});

	router.route("/users", function () {
		subscribe(ADMIN_TEMPLATES.User.event, initUsers);
	});

	router.route("/regs", function () {
		subscribe(ADMIN_TEMPLATES.Regs.event, initRegs);
	});

	router.route("/inv", function () {
		subscribe(ADMIN_TEMPLATES.Invitation.event, initInvitations);
	});

	router.route("/srvc", function () {
		subscribe(ADMIN_TEMPLATES.Service.event, initServices);
	});

	router.route("/vpn", function () {
		subscribe(ADMIN_TEMPLATES.Vpn.event, initVpn);
	});

	router.route("/gk-login", function () {
		subscribe(ADMIN_TEMPLATES.GkLogin.event, initGkLogins);
	});

	router.start();
}

initAdminRouters();

function getSettings(cb){
	$.getJSON('/settings/get',function(data){
		console.log('Admin Settings data %j', data);
		settings = data;

		cb && cb();
	})
}

function notifyAdminLogout(){
	//e.preventDefault();
	try {
		if(window.self != window.top){
			window.top.postMessage({event:'logout'});
		}
	} catch (e) {

	}

	setTimeout(function(){
		window.location.href = '/beame-gw/logout';
	},50);


}
