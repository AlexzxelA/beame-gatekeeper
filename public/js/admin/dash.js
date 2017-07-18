/**
 * Created by zenit1 on 14/05/2017.
 */
function loadSettings(){
	var loadDash =  function(){

		viewDash  = new kendo.View("home",{
			model: new kendo.observable({
				data: settings,
				proxyKinds:[{name:'Both Http/Https',value:1},{name:'Separate Http/Https',value:2}],
				showProxyBothPanel:function(kind){

					return  this.get("data.AppConfig.ProxySettings.kind") == 1;
				},
				showProxySeparatePanel:function(){

					return  this.get("data.AppConfig.ProxySettings.kind") == 2;
				},
				onKindChanged:function(e){

					this.set("data.AppConfig.ProxySettings.kind", parseInt(e.sender.value()));
					console.log(this.get("data.AppConfig.ProxySettings.kind"));
				},
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
}