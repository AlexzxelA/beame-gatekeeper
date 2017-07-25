/**
 * Created by zenit1 on 13/05/2017.
 */
var settings = null, viewDash, layout;

function initAdminRouters() {

	console.log('load admin routes');

	viewDash  = new kendo.View("#home", {model: settings});


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



	$("#showDash").on("click", function () {
		initDash();
	});


	var router = new kendo.Router({
		init: function () {
			layout.render("#app-wrapper");
		}
	});

	router.route("/", function () {
		subscribe(ADMIN_TEMPLATES.Dash.event, initDash);
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

