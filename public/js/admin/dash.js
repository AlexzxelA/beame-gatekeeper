/**
 * Created by zenit1 on 14/05/2017.
 */
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
				data: settings,
				onSave:function(){
					showLoader();
					$.ajax({
						type: "POST",
						url: '/settings/save',
						data: {data: JSON.stringify(this.data)},
						success: function(result){
							hideLoader();
							alert(result.success ? 'Settings saved' : result.error);
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
							alert(result.success ? 'Settings saved' : result.error);
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
							alert(result.success ? 'Settings saved' : result.error);
						},
						dataType: 'json'
					});

				}
			})
		});
		layout.showIn("#content", viewDash);

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
	}
	else{
		loadDash();
	}

	console.log('huy');


}