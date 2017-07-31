/**
 * Created by zenit1 on 14/05/2017.
 */

function hintElement(element) { // Customize the hint

	var grid = $("#prov-settings-grid").data("kendoGrid"),
	    table = grid.table.clone(), // Clone Grid's table
	    wrapperWidth = grid.wrapper.width(), //get Grid's width
	    wrapper = $("<div class='k-grid k-widget'></div>").width(wrapperWidth),
	    hint;

	table.find("thead").remove(); // Remove Grid's header from the hint
	table.find("tbody").empty(); // Remove the existing rows from the hint
	table.wrap(wrapper); // Wrap the table
	table.append(element.clone().removeAttr("uid")); // Append the dragged element

	hint = table.parent(); // Get the wrapper

	return hint; // Return the hint element
}

function loadSettings(){
	var loadDash =  function(){

		viewDash  = new kendo.View("home",{
			model: new kendo.observable({
				role_ds: new kendo.data.DataSource({
				transport: {
					read:    {
						url: "/role/list"
					},
					create:  {
						url:      "/role/create",
						method:   "POST",
						dataType: "json"
					},
					update:  {
						url:      "/role/update",
						method:   "POST",
						dataType: "json"
					},
					destroy: {
						url:      "/role/destroy",
						method:   "POST",
						dataType: "json"
					}
				},
				schema:    {
					model: {
						id:     "id",
						fields: {
							id:       {type: "number", "editable": false},
							name:     {type: "string"}
						}
					}
				},
				pageSize:  20
			}),
			provision_ds: new kendo.data.DataSource({
				transport: {
					read:    {
						url: "/provision/config/list"
					},
					update:  {
						url:      "/provision/config/update",
						method:   "POST",
						dataType: "json"
					},
					parameterMap: function(options, operation) {
						console.log('huy');
						if (operation !== "read" && options.models) {
							return {models: kendo.stringify(options.models)};
						}
					}
				},
				schema:    {
					model: {
						id:     "FieldName",
						fields: {
							Order: { type:"numeric" },
							FieldName: { editable: false },
							Label: {  editable: true} ,
							IsActive: { type: "boolean" },
							Required: { type: "boolean" }
						}
					}
				},
				sort: { field: "Order", dir: "asc" },
				pageSize:  20,
				batch: true
			}),
				data: settings,
				onSave:function(){
					showLoader();
					$.ajax({
						type: "POST",
						url: '/settings/save',
						data: {data: JSON.stringify(this.data)},
						success: function(result){
							hideLoader();
							showNotification(result.success, result.success ? 'Settings saved' : result.error);
						},
						dataType: 'json'
					});
				},
				onDbSave:function(){
					if(this.data.DbConfig.supported.indexOf(this.data.DbConfig.provider) < 0){
						showNotification(false, 'Please select supported DB provider');
						return;
					}
					showLoader();

					$.ajax({
						type: "POST",
						url: '/db-provider/save',
						data: {data: JSON.stringify(this.data.DbConfig.provider)},
						success: function(result){
							hideLoader();
							showNotification(result.success, result.success ? 'DB Settings saved' : result.error);
						},
						dataType: 'json'
					});
				},
				onProxySave:function(){
					showLoader();

					var data = JSON.stringify(this.data.AppConfig.ProxySettings);
					console.log(data);

					$.ajax({
						type: "POST",
						url: '/proxy/save',
						data: {data: data},
						success: function(result){
							hideLoader();
							showNotification(result.success, result.success ? 'AD Domains saved' : result.error);
						},
						dataType: 'json'
					});

				},
				onAdDomainsSave:function(){
					showLoader();
					var data = this.data.AdDomains != undefined && this.data.AdDomains.length > 2 ? JSON.stringify(this.data.AdDomains) : null;
					console.log(data);

					$.ajax({
						type: "POST",
						url: '/ad-domain/save',
						data: {data: data},
						success: function(result){
							hideLoader();
							showNotification(result.success, result.success ? 'Proxy Settings saved' : result.error);
						},
						dataType: 'json'
					});

				}
			})
		});

		layout.showIn("#content", viewDash);

		var grid = $("#prov-settings-grid").data("kendoGrid");


		grid.table.kendoSortable({
			hint: hintElement,
			cursor: "move",
			placeholder: function(element) {
				return element.clone().addClass("k-state-hover").css("opacity", 0.65);
			},
			container: "#prov-settings-grid tbody",
			filter: " > tbody > tr",
			change: function(e) {
				var grid = $("#prov-settings-grid").data("kendoGrid"),
				    oldIndex = e.oldIndex , // The old position
				    newIndex = e.newIndex , // The new position
				    view = grid.dataSource.view(),
				    dataItem = grid.dataSource.getByUid(e.item.data("uid")); // Retrieve the moved dataItem

				dataItem.Order = newIndex; // Update the order
				dataItem.dirty = true;

				// Shift the order of the records
				if (oldIndex < newIndex) {
					for (var i = oldIndex + 1; i <= newIndex; i++) {
						view[i].Order--;
						view[i].dirty = true;
					}
				} else {
					for (var i = oldIndex - 1; i >= newIndex; i--) {
						view[i].Order++;
						view[i].dirty = true;
					}
				}

				grid.dataSource.sync();
			}
		});

		$("#config-tabstrip").kendoTabStrip({
			animation:  {
				open: {
					effects: "fadeIn"
				}
			}
		});

		setTimeout(function () {
			$("#config-tabstrip").show();
		},50);

		$('#save-app-config-btn').kendoButton();
	};
	if(!settings){
		getSettings(loadDash);
		//
	}
	else{
		loadDash();
	}

}

