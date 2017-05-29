/**
 * Created by zenit1 on 28/05/2017.
 */
function showLoader(id){
	//document.getElementById(id || "overlay").style.display = "block";
	$('#'+(id || "overlay")).show();
}
function hideLoader(id) {
	//document.getElementById(id || "overlay").style.display = "none";
	$('#' + (id || "overlay")).hide();
}

function showNotification(success,message){

	var wWidth = $(window).width(),
	    wHeight = $(window).height(),
	    newTop, newLeft;

	newLeft = Math.floor(wWidth / 2 - 400 / 2);

	var notificationDelay = success ? 3500 : 0;

	var notification = $("#d-notif").kendoNotification({
		position: {
			top: 50,
			left: newLeft
		},
		hideOnClick: false,
		templates: [{
			type: "error",
			template: $("#errorTemplate").html()
		}, {
			type: "success",
			template: $("#successTemplate").html()
		}]
	}).data("kendoNotification");

	notification.setOptions({ autoHideAfter: notificationDelay });

	notification.show({message:message}, success ? "success" : "error");

	$(".js-close-notification").click(function(){
		notification.hide();
	});

}

$(document).ready(function(){

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
			window.parent.setPageTitle('Create invitation');
		}
		else {
			setPageTitle('Create invitation');
		}
	} catch (e) {
	}

	var createInvitationViewModel = kendo.observable({
		init:       function () {

		},
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
			e.preventDefault();

			var email = this.get("email"),
			    user_id = this.get("user_id");

			if(!email && !user_id){
				showNotification(false,'Email required');
				return;
			}

			showLoader();

			var form     = $('#frm-create-invitation'),
			    url      = '/cred/invite/',
			    formData = {
				    name:      this.get("name"),
				    email:     email,
				    user_id:   user_id  ,
				    sendEmail: this.get("sendEmail")
			    };


			$.ajax({
				url:         url,
				cache:       false,
				data:        JSON.stringify(formData),
				type:        'Post',
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				, success:   function (response) {

					hideLoader();

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

	kendo.bind($("#app-wrapper"), createInvitationViewModel);

});