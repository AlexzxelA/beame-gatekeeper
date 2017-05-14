/**
 * Created by zenit1 on 14/05/2017.
 */
var credDetailViewModel, vpnDetailViewModel, createCredViewModel,createInvitationViewModel,
    qrWnd,vpnWnd,certWnd,credWnd,invWnd,regtokenWnd;

function showNotification(success,message,hideAfter){

	var wWidth = $(window).width(),
	    wHeight = $(window).height(),
	    newTop, newLeft;

	newLeft = Math.floor(wWidth / 2 - 240 / 2);

	var notification = $("#d-notif").kendoNotification({
		position: {
			top: 50,
			left: newLeft
		},
		autoHideAfter: hideAfter || 5000,
		button: true,
		templates: [{
			type: "error",
			template: $("#errorTemplate").html()
		}, {
			type: "success",
			template: $("#successTemplate").html()
		}]
	}).data("kendoNotification");

	notification.show({message:message}, success ? "success" : "error");
}

function closeWnd() {
	$(".k-window .k-window-content").each(function (index, element) {
		$(element).data("kendoWindow").close();
	});
}

function bindEmailEvent() {

	$('#btn-send-pfx-email').off('click').on('click', function (e) {

		e.preventDefault();

		showLoader();

		var form     = $('#frm-send-pfx-email'),
		    url      = form.attr('action'),
		    method   = form.attr('method'),
		    formData = {
			    fqdn:  form.find('input[name="fqdn"]').val(),
			    email: form.find('input[name="email"]').val()
		    };
		console.log('form data', formData);
		$.ajax({
			url:         url,
			cache:       false,
			data:        JSON.stringify(formData),
			type:        method,
			datatype:    "json",
			contentType: "application/json; charset=utf-8"
			, success:   function (response) {

				hideLoader();
				if (response.responseCode == 1) {
					response.responseDesc = 'Email sent to ' + ( $('#frm-send-pfx-email input[name="email"]').val());
					$("#send_pfx_form_info").removeClass('ad-error').addClass('ad-success');
					if (response.data && credDetailViewModel) {
						credDetailViewModel.set("data", response.data);
					}

				}
				else {
					$("#send_pfx_form_info").removeClass('ad-success').addClass('ad-error');

				}
				$("#send_pfx_form_info").html(response.responseDesc);
			}
		});
	});
}

function setVpn() {
	showLoader('wnd-overlay');

	var handleSendCredResponse = function (response) {
		hideLoader('wnd-overlay');

		if (response.responseCode == 1) {
			response.responseDesc = 'Vpn settings saved';
			$("#frm-vpn-detail_info").removeClass('ad-error').addClass('ad-success');
			if (response.data) {
				if (credDetailViewModel) {
					credDetailViewModel.set("data", response.data);
				}


				vpnDetailViewModel.set("data", response.data);
				vpnDetailViewModel.init();
			}
		}
		else {
			$("#frm-vpn-detail_info").removeClass('ad-success').addClass('ad-error');

		}
		$("#frm-vpn-detail_info").html(response.responseDesc);
	};


	$(this).ajaxSubmit({
		error:   handleSendCredResponse,
		success: handleSendCredResponse
	});

	return false;
}

function initVpnWindow() {
	var template = kendo.template($("#vpn-detail").html());
	vpnWnd.empty();
	vpnWnd.kendoWindow({
		width:   "450px",
		height:  "400px",
		title:   "Set VPN",
		visible: false,
		modal:   true,
		content: {
			template: template
		},
		actions: [
			"Close"
		],
		open:    function () {
			vpnDetailViewModel.init();
			kendo.bind($("#vpn-window"), vpnDetailViewModel);
			$('#frm-vpn-detail').submit(setVpn);
			$('#frm-vpn-delete').submit(setVpn);
		}
	});
}

function initCredWindow() {
	var template = kendo.template($("#tmpl-create-child-cred").html());
	credWnd.empty();
	credWnd.kendoWindow({
		width:   "440px",
		height:  "500px",
		title:   "Create Child Credential",
		visible: false,
		modal:   true,
		content: {
			template: template
		},
		actions: [
			"Close"
		],
		open:    function () {

			createCredViewModel.init();
			kendo.bind($("#create-child-cred-window"), createCredViewModel);
		}
	});
}

function initInvitationWindow() {
	var template = kendo.template($("#tmpl-create-invitation").html());
	invWnd.empty();
	invWnd.kendoWindow({
		width:   "400px",
		height:  "450px",
		title:   "Create Invitation",
		visible: false,
		modal:   true,
		content: {
			template: template
		},
		actions: [
			"Close"
		],
		open:    function () {

			createInvitationViewModel.init();
			kendo.bind($("#create-invitation-window"), createInvitationViewModel);

		}
	});
}

function reinitModel(response,closeWindows) {
	if (response.data && credDetailViewModel) {
		credDetailViewModel.set("data", response.data);
		credDetailViewModel.init(closeWindows);
	}
}

function initRegtokenWindow(fqdn, name) {
	var template     = kendo.template($("#tmpl-create-regtoken").html());
	var fqdnTemplate = template({fqdn: fqdn, name: name});
	regtokenWnd.empty();
	regtokenWnd.kendoWindow({
		width:   "440px",
		height:  "450px",
		title:   "Create Child Credential",
		visible: false,
		modal:   true,
		content: {
			template: fqdnTemplate
		},
		actions: [
			"Close"
		],
		close:function(){

		},
		open:    function () {
			new Clipboard('#copy-btn');
			$('#copy-btn').attr("data-clipboard-target", "#reg_token");
			$('#btn-regtoken-back').off('click').on('click', function () {
				$('#frm-create-regtoken').show();
				$('#reg-token-container').hide();
			});

			$('#btn-create-regtoken').off('click').on('click', function (e) {
				showLoader('wnd-overlay');
				e.preventDefault();


				$('#reg_token').html(null);
				$('#reg-token-container').hide();

				var form     = $('#frm-create-regtoken'),
				    url      = form.attr('action'),
				    method   = form.attr('method'),
				    formData = {
					    fqdn:    form.find('input[name="fqdn"]').val(),
					    name:    form.find('input[name="name"]').val(),
					    email:   form.find('input[name="email"]').val(),
					    user_id: form.find('input[name="user_id"]').val(),
					    ttl:     form.find('input[name="ttl"]').val()
				    };

				$.ajax({
					url:         url,
					cache:       false,
					data:        JSON.stringify(formData),
					type:        method,
					datatype:    "json",
					contentType: "application/json; charset=utf-8"
					, success:   function (response) {
						hideLoader('wnd-overlay');
						console.log(response);
						if (response.responseCode == 1) {

							$("#token-info").removeClass('ad-error').addClass('ad-success');

							$('#reg_token').html(response.token);
							reinitModel(response,false);

							$('#frm-create-regtoken').hide();
							$('#reg-token-container').show();
						}
						else {
							$("#token-info").removeClass('ad-success').addClass('ad-error');
						}
						$("#token-info").html(response.responseDesc);
					}
				});

			});
		}
	});
}

function initCertWindow(certData) {
	var template     = kendo.template($("#tmpl-cert-detail").html());
	var certTemplate = template(certData);
	console.log('certData', certData);
	certWnd.empty();
	certWnd.kendoWindow({
		width:   "750px",
		height:  "600px",
		title:   "Certificate Details",
		visible: false,
		modal:   true,
		content: {
			template: certTemplate
		},
		actions: [
			"Close"
		]
	});
}

function initQrWindow(url) {
	if (url) {
		qrWnd.kendoWindow({
			width:   "320px",
			height:  "320px",
			title:   "Scan QR",
			visible: false,
			modal:   true,
			actions: [
				"Close"
			]
		});

		$('#download-qr').empty().kendoQRCode({
			value:           url,
			errorCorrection: "L",
			color:           "#000",
			background:      "transparent",
			padding:         0,
			size:            300
		});
	}
}

function handleDnsResponse(response) {
	hideLoader();

	if (response.responseCode == 1) {

		$("#frm-dns-info").removeClass('ad-error').addClass('ad-success');

		reinitModel(response,true);

		if (response.data) {
			credDetailViewModel.set("data", response.data);
			credDetailViewModel.set('dnsRecords', response.data.dnsRecords || []);
			credDetailViewModel.set("dnsFqdn", null);
			credDetailViewModel.set("dnsValue", null);
			credDetailViewModel.set("availableDnsRecords", credDetailViewModel.getAvailableDnsRecords());
		}
	}
	else {
		$("#frm-dns-info").removeClass('ad-success').addClass('ad-error');
	}
	$("#frm-dns-info").html(response.responseDesc);
}

function loadCredDetail(data) {

		qrWnd       = $("#qr-window");
		vpnWnd      = $('#vpn-window');
		certWnd     = $('#cert-window');
		credWnd     = $('#create-child-cred-window');
		invWnd      = $('#create-invitation-window');
		regtokenWnd = $('#create-regtoken-window');

	window.getNotifManagerInstance().subscribe('MenuClicked', function () {
		closeWnd();
	});

	credDetailViewModel = kendo.observable({
		init: function (closeWindows) {

			if(closeWindows) closeWnd();

			new Clipboard('#copy-fqdn-btn');
			$('#copy-fqdn-btn').attr("data-clipboard-target", "#hid-fqdn");

			this.set('revokeDisabled', this.data.hasChildren || this.data.revoked);
			this.set('commonButtonDisabled', this.data.revoked);
			this.set('renewButtonDisabled', this.data.revoked || !this.data.isLocal);
			this.set('emailFormVisible', !this.data.revoked && this.data.pwd);
			this.set('iosVpnProfileVisible', this.data.vpn_server_fqdn);
			this.set('showValidCertForms', !this.data.revoked);
			this.set('showDns', !this.data.revoked && data.isLocal);

			bindEmailEvent();

			$('#ios-profile-form').attr('action', this.iosProfileLink());

			this.initDnsModel();
		},

		revokeDisabled:       true,
		commonButtonDisabled: false,
		renewButtonDisabled:  false,
		emailFormVisible:     true,
		iosVpnProfileVisible: false,
		showValidCertForms:   true,
		showDns:              true,
		data:                 data,

		parentName:       function () {
			return this.data.parent_name ? (this.data.parent_name +  '(' + this.data.parent_fqdn +')'): this.data.parent_fqdn
		},
		sendPfxUrl:       function () {
			return '/send/pfx/' + this.data.fqdn
		},
		showCredQr:       function () {
			if (!this.data.download_cred_url) {
				alert('Cred download url not defined');
				return;
			}
			this.operQrWnd(this.data.download_cred_url);
		},
		showIosProfileQr: function () {
			if (!this.data.download_ios_profile_url) {
				alert('Ios Profile download url not defined');
				return;
			}
			this.operQrWnd(this.data.download_ios_profile_url);
		},
		operQrWnd:        function (url) {
			initQrWindow(url);
			closeWnd();
			qrWnd.data("kendoWindow").center().open();
		},
		iosProfileLink:   function () {
			return "/cred/ios-profile/" + this.data.fqdn;
		},
		opneVPN:          function () {
			initVpnWindow();
			vpnWnd.data("kendoWindow").center().open();
		},
		openCredWnd:      function () {
			initCredWindow();
			credWnd.data("kendoWindow").center().open();
		},
		openInvitationWnd:      function () {
			initInvitationWindow();
			invWnd.data("kendoWindow").center().open();
		},
		openRegtokenWnd:  function () {
			initRegtokenWindow(this.data.fqdn, this.data.name);
			regtokenWnd.data("kendoWindow").center().open();
		},
		openCertWnd:      function () {

			var certData     = this.data.certData;
			certData.revoked = this.data.revoked;
			certData.expired = this.data.expired;
			certData.isValid = !certData.revoked && !certData.expired;
			initCertWindow(certData);
			certWnd.data("kendoWindow").center().open();
		},
		renewCert:        function () {

			showLoader();
			$.ajax({
				url:         '/cred/renew/' + this.data.fqdn,
				cache:       false,
				type:        "Post",
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				, success:   function (response) {

					hideLoader();

					if (response.responseCode == 1) {
						$("#cred-info").removeClass('ad-error').addClass('ad-success');
						reinitModel(response,true);
					}
					else {
						$("#cred-info").removeClass('ad-success').addClass('ad-error');

					}
					$("#cred-info").html(response.responseDesc);
				}
			});
		},
		revokeCert:       function () {
			if (!confirm("Are you sure?")) return;
			var $this = this;
			showLoader();
			$.ajax({
				url:         '/cred/revoke/' + this.data.fqdn,
				cache:       false,
				type:        "Post",
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				, success:   function (response) {

					hideLoader();

					if (response.responseCode == 1) {
						$("#cred-info").removeClass('ad-error').addClass('ad-success');
						reinitModel(response,true);
						$('#creds-tree').find('div[data-fqdn="' + $this.data.fqdn + '"]').addClass('revoked');
					}
					else {
						$("#cred-info").removeClass('ad-success').addClass('ad-error');

					}
					$("#cred-info").html(response.responseDesc);
				}
			});
		},
		checkOcsp:        function () {
			var $this = this;
			showLoader();
			$.ajax({
				url:         '/cred/ocsp/' + this.data.fqdn,
				cache:       false,
				type:        "Get",
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				, success:   function (response) {

					hideLoader();

					if (response.responseCode == 1) {
						showNotification(response.data.status,response.data.status ? "Certificate OCSP status is OK" : "Certificate is revoked");
					}
					else {
						showNotification(false,response.responseDesc);
					}

				}
			});
		},

		//DNS record
		dnsRecords:             [],
		availableDnsRecords:    [],
		dnsFqdn:                null,
		dnsValue:               null,
		dnsMethods:{
			BeameEdge:0,
			Custom:1
		},
		selectedDnsMethod:null,
		dnsValueEnabled:function(){
			return this.get("selectedDnsMethod") == this.dnsMethods.Custom;
		},
		onDnsMethodChanged:function(e){
			var m = parseInt($(e.currentTarget).val());

			if(m == this.dnsMethods.BeameEdge) {
				this.set("dnsValue",null);
			}

			this.set("selectedDnsMethod",m);
		},
		initDnsModel:           function () {
			var $this = this;

			this.set('selectedDnsMethod', this.dnsMethods.BeameEdge);

			this.set('dnsRecords', this.data.dnsRecords || []);

			$('#btn-create-dns').off('click').on('click',function () {

				var form     = $('#frm-create-dns'),
				    url      = form.attr('action'),
				    method   = form.attr('method'),
				    dnsMethod = parseInt($('input[name="dns-method-radio"]:checked').val()),
				    formData = {
					    fqdn:credDetailViewModel.get('data.fqdn'),
					    dnsFqdn:  form.find('#dnsFqdn').data('kendoComboBox').value(),
					    dnsValue: form.find('input[name="dnsValue"]').val()
				    };

				if(dnsMethod == credDetailViewModel.dnsMethods.Custom && !formData.dnsValue){
					form.find('input[name="dnsValue"]').focus();
					showNotification(false,'Set DNS value',1000);
					return;
				}
				showLoader();
				$.ajax({
					url:         '/dns/create',
					cache:       false,
					data:        JSON.stringify(formData),
					type:        'Post',
					datatype:    "json",
					contentType: "application/json; charset=utf-8"
					,success:   handleDnsResponse
				});

			})

			this.set("availableDnsRecords", this.getAvailableDnsRecords());

		},
		getAvailableDnsRecords: function () {
			try {
				var dnsRec = this.dnsRecords || [];

				var list = this.data.certData.altNames.filter(function (el) {
					return !dnsRec.map(function (item) {
						return item.fqdn;
					}).includes(el);
				}).map(function (item) {
					return {fqdn: item};
				});

				console.log(list);

				if (list.length) {
					this.set("dnsFqdn", list[0]);
				}

				return list;
			} catch (e) {
				return [];
			}
		},
		updateDns:              function (model) {

			showLoader();

			var fqdn     = this.get("fqdn"),
			    formData = {
				    fqdn:     this.get('data.fqdn'),
				    dnsFqdn:  model.fqdn,
				    dnsValue: model.value
			    };

			$.ajax({
				url:         '/dns/create',
				cache:       false,
				data:        JSON.stringify(formData),
				type:        'Post',
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				, success:   handleDnsResponse
			});
		},
		confirmDelete:          function (e) {
			e.preventDefault();
		},
		deleteDns:              function (e) {
			e.preventDefault();
			if (!confirm("Are you sure?")) return;
			var data = e.data;
			console.log('delete', data);

			showLoader();

			formData = {
				fqdn:    credDetailViewModel.get('data.fqdn'),
				dnsFqdn: data.fqdn
			};
			console.log('form data', formData);
			$.ajax({
				url:         '/dns/delete',
				cache:       false,
				data:        JSON.stringify(formData),
				type:        'Post',
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				, success:   handleDnsResponse
			});
		},
		onDnsEdit:              function (e) {

			var updBtn = e.item.find('.dns-update'),
			    disabled = this.get('commonButtonDisabled');

			disabled ? updBtn.hide() :	updBtn.off('click').on('click', this.updateDns.bind(credDetailViewModel, e.model));
		}

	});

	credDetailViewModel.init(true);
	kendo.bind($("#cred-form-container"), credDetailViewModel);

	vpnDetailViewModel = kendo.observable({
		init:      function () {
			var vpns = this.data.vpn;
			if (!vpns || !vpns.length) {
				this.set('vpnId', null);
				this.set('name', null);
				return;
			}

			var vpn = vpns[0];

			this.set('vpnId', vpn.id);
			this.set('name', vpn.name);
		},
		vpnId:     null,
		name:      null,
		data:      data,
		deleteVpn: function () {
			this.set('name', null);
			$('#frm-vpn-delete').submit();
		}
	});

	createCredViewModel = kendo.observable({
		init:       function () {
			this.set("fqdn", data.fqdn);
		},
		data:       data,
		fqdn:       null,
		email:      null,
		name:       null,
		password:   null,
		sendEmail:  false,
		createCred: function (e) {

			showLoader('wnd-overlay');
			e.preventDefault();
			var form     = $('#frm-create-child-cred'),
			    url      = form.attr('action'),
			    method   = form.attr('method'),
			    fqdn     = this.get("fqdn"),
			    formData = {
				    fqdn:      fqdn,
				    name:      this.get("name"),
				    email:     this.get("email"),
				    password:  this.get("password"),
				    sendEmail: this.get("sendEmail")
			    };
			console.log('form data', formData);
			$.ajax({
				url:         url,
				cache:       false,
				data:        JSON.stringify(formData),
				type:        method,
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				, success:   function (response) {

					hideLoader('wnd-overlay');
					var info = $('#create-child-cred-info');
					console.log(response);
					if (response.responseCode == 1) {

						info.removeClass('ad-error').addClass('ad-success');
						setTimeout(function(){
							console.log('huy');
							reinitModel(response,false);
						},300);
						window.getNotifManagerInstance().notify('credsChanged', {fqdn: fqdn,data:formData,newFqdn:response.newFqdn})
					}
					else {
						info.removeClass('ad-success').addClass('ad-error');

					}
					info.html(response.responseDesc);
				}
			});
		}
	});

	createInvitationViewModel = kendo.observable({
		init:       function () {
			this.set("fqdn", data.fqdn);
		},
		data:       data,
		fqdn:       null,
		email:      null,
		name:       null,
		user_id:    null,
		sendEmail:  false,
		back:function(){
			$('#inv-form-container').show();
			$('#inv-qr-container').hide();
			$('#inv-qr').empty();
		},
		createInvitation: function (e) {

			showLoader('wnd-overlay');
			e.preventDefault();
			var form     = $('#frm-create-invitation'),
			    fqdn     = this.get("fqdn"),
			    url = '/cred/invite/' + this.get("fqdn"),
			    formData = {
				    fqdn:      fqdn,
				    name:      this.get("name"),
				    email:     this.get("email"),
				    user_id:     this.get("user_id"),
				    sendEmail: this.get("sendEmail")
			    };
			console.log('form data', formData);

			$.ajax({
				url:         url,
				cache:       false,
				data:        JSON.stringify(formData),
				type:        'Post',
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				, success:   function (response) {
					console.log(response);
					hideLoader('wnd-overlay');

					if (response.responseCode == 1) {
						$('#inv-form-container').hide();
						$('#inv-qr-container').show();
						$('#inv-qr').empty().kendoQRCode({
							value:           response.data.url,
							errorCorrection: "L",
							color:           "#000",
							background:      "transparent",
							padding:         0,
							size:            250
						});

						if(response.data.message){
							showNotification(true,response.data.message);
						}
					}
					else {
						showNotification(false,response.responseDesc);
					}

				}
			});
		}
	});

}
