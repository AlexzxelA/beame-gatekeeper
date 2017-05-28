/**
 * Created by zenit1 on 14/05/2017.
 */

function addNewRecord() {
    $("#srvc-grid").data("kendoGrid").addRow();
}

function loadServices() {
	$("#srvc-grid").kendoGrid({
		//toolbar:    ["create"],
		dataSource: {
			transport: {
				read:    {
					url: "/service/list"
				},
				create:  {
					url:      "/service/create",
					method:   "POST",
					dataType: "json"
				},
				update:  {
					url:      "/service/update",
					method:   "POST",
					dataType: "json"
				},
				destroy: {
					url:      "/service/destroy",
					method:   "POST",
					dataType: "json"
				}
			},
			schema:    {
				model: {
					id:     "id",
					fields: {
						id:       {type: "number", "editable": false},
						name:     {type: "string"},
						code:     {type: "string"},
						url:      {type: "string"},
						isActive: {type: "boolean", defaultValue: true}
					}
				}
			},
			pageSize:  20
		},
		//height:     550,
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
                field: "code",
                title: "Code",
                filterable: false
            },
            {
                field: "name",
				title: "Name",
                filterable: false
			},


			{
				field: "url",
				title: "Url",
				width: "30%",
                filterable: false
			},
			{
				field: "isActive",
				title: "Active",
                filterable: false
			},
			{command: ["edit", "destroy"], title: "&nbsp;", width: 120}
		]
	});
}