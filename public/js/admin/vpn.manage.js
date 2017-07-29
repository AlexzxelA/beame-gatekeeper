/**
 * Created by zenit1 on 21/05/2017.
 */
var vpnQrWnd;
function initVpnQrWindow(url) {
	if (url) {
		vpnQrWnd.kendoWindow({
			width:   "320px",
			height:  "320px",
			title:   "Scan QR",
			visible: false,
			modal:   true,
			actions: [
				"Close"
			]
		});

		$('#download-vpn-qr').empty().kendoQRCode({
			value:           url,
			errorCorrection: "L",
			color:           "#000",
			background:      "transparent",
			padding:         0,
			size:            300
		});
	}
}

function loadVpn() {
	console.log('huy');

	vpnQrWnd = $("#vpn-qr-window");

	var vpnSettingsModel = kendo.observable({
		init:                 function () {
			var $this = this;

			showLoader();

			$.ajax({
				url:         '/vpn/settings',
				cache:       false,
				type:        'Get',
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				, success:   function(data){
					hideLoader();
					console.log(data);
					if(data.error){
						showNotification(false, data.error);
					}
					else{
						$this.set("fqdn",data.fqdn);
						$this.set("name",data.name);
						$this.set("vpnId",data.vpn_id);
						$this.set("download_ios_profile_url",data.download_ios_profile_url);
						$this.set('iosVpnProfileVisible', data.download_ios_profile_url != null);
						$('#ios-profile-form').attr('action', $this.iosProfileLink());
						$this.set("showOptions",data.vpn_id == null);
						$this.set("showNew",data.vpn_id == null && $this.set == $this.vpnMethods.New);
					}

					$("#vpn_fqdn").kendoComboBox({
						dataTextField:  "name",
						dataValueField: "fqdn",
						filter:         "contains",
						minLength:      1,
						dataSource:     {
							serverFiltering: true,
							transport:       {
								read: "/creds/filter"
							}
						},
						dataBound:function(e){
							var fqdn = $this.get("fqdn");
							if(fqdn){
								e.sender.value(fqdn);
							}
							else{
								e.sender.select(-1);
							}
							e.sender.enable(fqdn == null);
						}
					});
				}
			});



			this.set('selectedVpnMethod', this.vpnMethods.Existing);

		},
		vpnId:     null,
		name:      null,
		fqdn:null,
		showOptions:true,
		iosVpnProfileVisible: false,
		selectedVpnMethod:    null,
		showNew:              false,
		onVpnMethodChanged:   function (e) {
			var m = parseInt($(e.currentTarget).val());

			if (m == this.vpnMethods.Existing) {

				this.set("showNew", false);
			}
			else {

				this.set("showNew", true);
			}

			this.set("selectedVpnMethod", m);
		},
		vpnMethods:           {
			Existing: 0,
			New:      1
		},
		openQrWnd:            function (url) {
			initVpnQrWindow(url);
			vpnQrWnd.data("kendoWindow").center().open();
		},
		showIosProfileQr:     function () {
			if (!this.download_ios_profile_url) {
				showNotification(false, 'Ios Profile download url not defined', 1000);
				return;
			}
			this.openQrWnd(this.download_ios_profile_url);
		},
		iosProfileLink:       function () {
			return "/cred/ios-profile/" + this.fqdn;
		},
		saveVpn: function (e) {
			e.preventDefault();
			var $this = this;

			var form = $('#frm-create-vpn'),formData = {
				createCred:$this.get("selectedVpnMethod") == $this.vpnMethods.New,
				vpn_id:$this.get("vpnId"),
				vpn_name:$this.get("name"),
				fqdn:$this.get("fqdn") || $("#vpn_fqdn").data("kendoComboBox").value(),
				cred:{
					name:    form.find('input[name="name"]').val(),
					email:   form.find('input[name="email"]').val(),
					user_id: form.find('input[name="user_id"]').val()
				}
			};

			if(!formData.vpn_name){
				showNotification(false, 'set vpn name', 1000);
				return;
			}

			if(!formData.fqdn){
				showNotification(false, 'Select credential', 1000);
				return;
			}
			showLoader();

			$.ajax({
				url:         '/cred/set-vpn/create',
				cache:       false,
				data:        JSON.stringify(formData),
				type:        'Post',
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				,success:   function(){
					hideLoader();
					$this.init();
				}
			});
		},
		deleteVpn: function (e) {
			e.preventDefault();
			var $this = this;
			if(!window.confirm('Are you sure?')){
				return;
			}

			showLoader();

			var formData = {
				vpn_id:$this.get("vpnId"),
				name:$this.get("name"),
				fqdn:$this.get("fqdn")
			};

			$.ajax({
				url:         '/cred/set-vpn/delete',
				cache:       false,
				data:        JSON.stringify(formData),
				type:        'Post',
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				,success:   function(response){
					hideLoader();
					if(response.responseCode == 1){
						$this.init();
					}
					else{
						showNotification(false, response.responseDesc);
					}
				}
			});
		}
	});

	vpnSettingsModel.init();
	kendo.bind($('#vpn-settings-container'), vpnSettingsModel);
}