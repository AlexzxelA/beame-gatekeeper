/**
 * Created by zenit1 on 14/05/2017.
 */
function rebindInvitations(){
	$("#inv-grid").data('kendoGrid').dataSource.read();
}

function onUploadStart(){
	showLoader();
	var token = new Date().getTime();

	setCookie("fileDownloadToken", token, 1);

	// To check the cookie returned back from the server every one second
	var downloadCheck = window.setInterval(function () {
		var cookieValue = getCookie('fileDownloadToken');
		if (!cookieValue){
			hideLoader();
			clearInterval(downloadCheck);
			rebindInvitations();
		}
	}, 100);

}
function loadInvitations() {

	$("#inv-grid").kendoGrid({
		toolbar:    ["excel"],
		excel:      {
			fileName: "Invitations.xlsx",
			allPages: true
		},
		dataSource: {
			transport: {
				read:    {
					url: "/invitation/list"
				},
				destroy: {
					url:      "/invitation/destroy",
					method:   "DELETE",
					dataType: "json"
				}
			},
			schema:    {
				model: {
					id:     "id",
					fields: {
						id:        {type: "number"},
						reg_id:    {type: "number"},
						name:      {type: "string"},
						email:     {type: "string"},
						userId:    {type: "string"},
						fqdn:      {type: "string"},
						createdAt: {type: "date"},
						status:    {type: "string"}
					}
				}
			},
			pageSize:  20
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
		dataBound:  function (e) {
			var grid = e.sender;
			var data = grid.dataSource.data();
			$.each(data, function (i, item) {
				if (item.status == "Completed") {
					$('tr[data-uid="' + item.uid + '"] ').find('.k-grid-delete').hide();//.addClass("disabled");
				}

			});
		},
		remove:     function (e) {
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
				field: "userId",
				title: "UserId"
			},
			{
				field: "fqdn",
				title: "Fqdn"
			},
			{
				field: "status",
				title: "Status"
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