
function showNotification(success,message, delay){

	var wWidth = $(window).width(),newLeft;

	newLeft = Math.floor(wWidth / 2 - 400 / 2);

	var notificationDelay = success ? 3500 : (delay || 0);

	var notification = $("#d-notif").kendoNotification({
		position: {
			top: 50,
			left: newLeft
		},
		hideOnClick: true,
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