/**
 * Created by zenit1 on 14/05/2017.
 */

function loadRegs() {
	$("#reg-grid").kendoGrid({
		//toolbar:    ["excel"],
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
					method:   "DELETE",
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
		//height:     550,
		filterable: true,
		sortable:   true,
		resizable: true,
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
				showNotification(false,"Registration is completed, and can't be removed", 500);

			}
		},
		pageable:   {
			pageSize: 20,
			refresh:  true
		},
		columns:    [{
			field:      "id",
		},
			{
				field: "name",
				title: "Name",
			},
			{
				field: "email",
				title: "Email",
			},

			{
				field: "fqdn",
				title: "Fqdn",
			},
			{
				field: "source",
				title: "Source",
			},
			{
				field: "completed",
				title: "Completed",
			},
			{
				field:  "createdAt",
				title:  "Add On",
				format: "{0:MM/dd/yyyy}"
			},
			{command: "destroy", title: "&nbsp;", width: 75}
		]
	});
}