/**
 * Created by zenit1 on 13/05/2017.
 */
var ADMIN_TEMPLATES = {
	Dash:    {
		path:  "templates/admin/dash.tmpl.html",
		event: "dashLoaded"
	},
	User:    {
		path:  "templates/admin/users.tmpl.html",
		event: "userLoaded"
	},
	Regs:    {
		path:  "templates/admin/registrations.tmpl.html",
		event: "regsLoaded"
	},
	Invitation:    {
		path:  "templates/admin/invitations.tmpl.html",
		event: "invitationLoaded"
	},
	CredDetail:    {
		path:  "templates/admin/cred.detail.tmpl.html",
		event: "credDetailLoaded"
	},
	Creds:    {
		path:  "templates/admin/creds.tmpl.html",
		event: "credsLoaded"
	},
	Service: {
		path:  "templates/admin/services.tmpl.html",
		event: "serviceLoaded"
	},
	Vpn: {
		path:  "templates/admin/vpn.tmpl.html",
		event: "vpnLoaded"
	},
	GkLogin: {
		path:  "templates/admin/gk-login.tmpl.html",
		event: "loginsLoaded"
	}
};

//region future use
var templateLoader = (function ($, host, event) {
	//Loads external templates from path and injects in to page DOM
	return {
		loadExtTemplate: function (path, event) {
			var tmplLoader = $.get(path)
				.success(function (result) {
					//Add templates to DOM
					$("body").append(result);
					//console.log(path + ' loaded')
				})
				.error(function (result) {
					alert("Error Loading Templates -- TODO: Better Error Handling");
				});

			tmplLoader.complete(function () {
				$(host).trigger(event, [path]);
				//console.log(path + ' complete')
			});
		}
	};
})(jQuery, document);

templateLoader.loadExtTemplate(ADMIN_TEMPLATES.Dash.path, ADMIN_TEMPLATES.Dash.event);
templateLoader.loadExtTemplate(ADMIN_TEMPLATES.User.path, ADMIN_TEMPLATES.User.event);
templateLoader.loadExtTemplate(ADMIN_TEMPLATES.Regs.path, ADMIN_TEMPLATES.Regs.event);
templateLoader.loadExtTemplate(ADMIN_TEMPLATES.Invitation.path, ADMIN_TEMPLATES.Invitation.event);
templateLoader.loadExtTemplate(ADMIN_TEMPLATES.CredDetail.path, ADMIN_TEMPLATES.CredDetail.event);
templateLoader.loadExtTemplate(ADMIN_TEMPLATES.Creds.path, ADMIN_TEMPLATES.Creds.event);
templateLoader.loadExtTemplate(ADMIN_TEMPLATES.Service.path, ADMIN_TEMPLATES.Service.event);
templateLoader.loadExtTemplate(ADMIN_TEMPLATES.Vpn.path, ADMIN_TEMPLATES.Vpn.event);
templateLoader.loadExtTemplate(ADMIN_TEMPLATES.GkLogin.path, ADMIN_TEMPLATES.GkLogin.event);


function onMenuSelected(e){

	window.getNotifManagerInstance().notify('MenuClicked');
	$("#menu").find(".k-state-selected").removeClass("k-state-selected");
	$(e.item).addClass("k-state-selected");
}

$(document).ready(function () {

	$.get('templates/admin/notification.tmpl.html')
		.success(function (result) {
			//Add templates to DOM
			$("body").append(result);
			//console.log(path + ' loaded')
		})
		.error(function () {
			console.error("Error Loading Templates -- TODO: Better Error Handling");
		});

	try {
		if (window.parent) {
			window.parent.setPageTitle('Gatekeeper Config');
		}
		else {
			setPageTitle('Gatekeeper Config');
		}
	} catch (e) {
	}

	var menu = $("#menu").kendoMenu({
		select: onMenuSelected
	});
	getSettings(function(){
		var isLogin = settings.AppConfig.EnvMode == "DelegatedLoginMaster";
		if(!isLogin){
			$("#menu").data("kendoMenu").enable('#li-gk-login',false);
			$('#li-gk-login > a').unbind('click');
			$('#li-gk-login > a').attr("href","/#");

		}
	});
	var selectedMenuSet = false,
		hash = window.location.hash.substr(1);
	$.each(
		$("#menu").find(".k-link"),
		function (i, data) {
			if (!selectedMenuSet && (data.href == location.href || !hash)) {
				$(data).addClass("k-state-selected");
				selectedMenuSet = true;

			}
		}
	);
});


function showLoader(id){
	//document.getElementById(id || "overlay").style.display = "block";
	$('#'+(id || "overlay")).show();
}
function hideLoader(id){
	//document.getElementById(id || "overlay").style.display = "none";
	$('#'+(id || "overlay")).hide();
}

function exportToExcel(id) {
	$("#" + id).data("kendoGrid").saveAsExcel();
}