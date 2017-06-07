/**
 * Created by zenit1 on 14/05/2017.
 */
function loadSettings(){
	var loadDash =  function(){

		viewDash  = new kendo.View("home",{
			model: new kendo.observable({
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