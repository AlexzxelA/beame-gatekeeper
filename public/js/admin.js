/**
 * Created by zenit1 on 23/11/2016.
 */
"use strict";

var settings = null,viewDash,viewUsers,viewRegs,layout;

function loadSettings(){

	var loadDash =  function(){
		viewDash  = new kendo.View("home",{model:settings});
		layout.showIn("#content", viewDash);
		$("#panelbar").kendoPanelBar({
			expandMode: "single"
		});
	};

	if(settings){
		loadDash();
	}
	else {
		$.getJSON('/settings/get',function(data){
			console.log('Settings data %j', data);
			settings = data;
			loadDash();
		})
	}


}

function loadRegs() {
	$("#reg-grid").kendoGrid({
		toolbar:    ["excel"],
		excel:      {
			fileName: "Registrations.xlsx",
			allPages: true
		},
		dataSource: {
			transport: {
				read:    {
					url: "/registration/list"
				},
				destroy: {
					url:      "/registration/destroy",
					method:   "POST",
					dataType: "json"
				}
			},
			schema:    {
				model: {
					id:     "id",
					fields: {
						id:        {type: "number"},
						name:      {type: "string"},
						email:     {type: "string"},
						fqdn:      {type: "string"},
						createdAt: {type: "date"},
						source:    {type: "string"},
						completed: {type: "boolean"}
					}
				}
			},
			pageSize:  20,
//                serverPaging:    true,
//                serverFiltering: true,
//                serverSorting:   true
		},
		height:     550,
		filterable: true,
		sortable:   true,
		editable:   {
			mode:         "inline",
			confirmation: true
		},
		dataBound: function(e) {
			var grid = e.sender;
			var data = grid.dataSource.data();
			$.each(data, function (i, item) {
				if (item.completed ) {
					$('tr[data-uid="' + item.uid + '"] ').find('.k-grid-delete').hide();//.addClass("disabled");
				}

			});
		},
		remove: function(e) {
			if (e.model.completed) {
				e.preventDefault();
				alert("Registration is completed, and can't be removed");

			}
		},
		pageable:   {
			pageSize: 20,
			refresh:  true
		},
		columns:    [{
			field:      "id",
			filterable: false
		},
			{
				field: "name",
				title: "Name"
			},
			{
				field: "email",
				title: "Email"
			},

			{
				field: "fqdn",
				title: "Fqdn"
			},
			{
				field: "source",
				title: "Source"
			},
			{
				field: "completed",
				title: "Completed"
			},
			{
				field:  "createdAt",
				title:  "Add On",
				format: "{0:MM/dd/yyyy}"
			},
			{command: "destroy", title: "&nbsp;", width: 100}
		]
	});
}

function loadUsers() {
	$("#user-grid").kendoGrid({
		toolbar:    ["excel"],
		excel:      {
			fileName: "Users.xlsx",
			allPages: true
		},
		dataSource: {
			transport: {
				read:   {
					url: "/user/list"
				},
				update: {
					url:      "/user/update",
					method:   "POST",
					dataType: "json"
				}
			},
			schema:    {
				model: {
					id:     "id",
					fields: {
						id:             {type: "number", "editable": false},
						name:           {type: "string", "editable": false},
						email:          {type: "string", "editable": false},
						fqdn:           {type: "string", "editable": false},
						isAdmin:        {type: "boolean"},
						isActive:       {type: "boolean"},
						lastActiveDate: {type: "date", "editable": false}
//
					}
				}
			},
			pageSize:  20,
//                serverPaging:    true,
//                serverFiltering: true,
//                serverSorting:   true
		},
		height:     550,
		filterable: true,
		sortable:   true,
		editable:   {
			mode:         "inline",
			confirmation: true
		},
		pageable:   {
			pageSize: 20,
			refresh:  true
		},
		columns:    [{
			field:      "id",
			filterable: false
		},
			{
				field: "name",
				title: "Name"
			},
			{
				field: "email",
				title: "Email"
			},

			{
				field: "fqdn",
				title: "Fqdn"
			},
			{
				field: "isActive",
				title: "Active"
			},
			{
				field: "isAdmin",
				title: "Admin"
			},
			{
				field:  "lastActiveDate",
				title:  "Last active",
				format: "{0:MM/dd/yyyy}"
			},
			{command: "edit", title: "&nbsp;", width: 100}
		]
	});
}

function initAdminRouters() {
	viewDash  = new kendo.View("home",{model:settings});
	viewUsers = new kendo.View("#user");
	viewRegs  = new kendo.View("#regs");

	console.log('dash %j', viewDash);
	console.log('user %j', viewUsers);
	console.log('reg %j', viewRegs);

	layout = new kendo.Layout("<section id='content'></section>");

	layout.render($("#app-wrapper"));


	$("#showDash").on("click", function () {
		layout.showIn("#content", viewDash);
		loadSettings();
	});
	$("#showUsers").on("click", function () {
		layout.showIn("#content", viewUsers);
		loadUsers();
	});
	$("#showRegs").on("click", function () {
		layout.showIn("#content", viewRegs);
		loadRegs();
	});

	var router = new kendo.Router({
		init: function () {
			console.log("router init");
			layout.render("#app-wrapper");
		}
	});
	router.route("/", function () {
		console.log("router root route");
		loadSettings();
	});
	router.route("/users", function () {
		console.log("router user route");
		layout.showIn("#content", viewUsers);
		loadUsers();
	});
	router.route("/regs", function () {
		console.log("router regs route");
		layout.showIn("#content", viewRegs);
		loadRegs();
	});

	router.start();
}


//region future use
//	    var templateLoader = (function ($, host) {
//		    //Loads external templates from path and injects in to page DOM
//		    return {
//			    loadExtTemplate: function (path) {
//				    var tmplLoader = $.get(path)
//					    .success(function (result) {
//						    //Add templates to DOM
//						    $("body").append(result);
//					    })
//					    .error(function (result) {
//						    alert("Error Loading Templates -- TODO: Better Error Handling");
//					    });
//
//				    tmplLoader.complete(function () {
//					    $(host).trigger("TEMPLATE_LOADED", [path]);
//				    });
//			    }
//		    };
//	    })(jQuery, document);

//templateLoader.loadExtTemplate("templates/dash.tmpl.html");
//templateLoader.loadExtTemplate("templates/users.tmpl.html");
//templateLoader.loadExtTemplate("templates/registrations.tmpl.html");
//endregion