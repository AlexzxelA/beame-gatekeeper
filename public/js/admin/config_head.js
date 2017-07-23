/**
 * Created by zenit1 on 13/05/2017.
 */
var ADMIN_TEMPLATES = {
	Dash:    {
		path:  "templates/admin/dash.tmpl.html",
		event: "dashLoaded"
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

	getSettings(function(){});

});


function showLoader(id){
	//document.getElementById(id || "overlay").style.display = "block";
	$('#'+(id || "overlay")).show();
}
function hideLoader(id){
	//document.getElementById(id || "overlay").style.display = "none";
	$('#'+(id || "overlay")).hide();
}