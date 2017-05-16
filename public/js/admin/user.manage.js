/**
 * Created by zenit1 on 14/05/2017.
 */
function loadUsers() {
	$("#user-grid").kendoGrid({
		toolbar:    ["excel"],
		excel:      {
			fileName: "Users.xlsx",
			allPages: true
		},
		dataSource: {
			transport: {
				read:   {
					url: "/user/list"
				},
				update: {
					url:      "/user/update",
					method:   "POST",
					dataType: "json"
				}
			},
			schema:    {
				model: {
					id:     "id",
					fields: {
						id:             {type: "number", "editable": false},
						name:           {type: "string", "editable": false},
						nickname:       {type: "string", "editable": false},
						email:          {type: "string", "editable": false},
						fqdn:           {type: "string", "editable": false},
						isAdmin:        {type: "boolean"},
						isActive:       {type: "boolean"},
						lastActiveDate: {type: "date", "editable": false}
//
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
				field: "nickname",
				title: "Nick"
			},
			{
				field: "email",
				title: "Email"
			},

			{
				field: "fqdn",
				title: "Fqdn"
			},
			{
				field: "isActive",
				title: "Active"
			},
			{
				field: "isAdmin",
				title: "Admin"
			},
			{
				field:  "lastActiveDate",
				title:  "Last active",
				format: "{0:MM/dd/yyyy}"
			},
			{command: "edit", title: "&nbsp;", width: 100}
		]
	});
}