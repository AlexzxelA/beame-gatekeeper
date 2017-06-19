/**
 * Created by zenit1 on 14/05/2017.
 */

function addNewRecord() {
    $("#srvc-grid").data("kendoGrid").addRow();
}

function loadServices() {
	function dataSource_error(e) {

		showNotification(false,e.xhr.responseText);
	}


	var ds = new kendo.data.DataSource({
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
					isActive: {type: "boolean", defaultValue: true},
					isMobile: {type: "boolean", defaultValue: false},
					isExternal: {type: "boolean", defaultValue: false}
				}
			}
		},
		pageSize:  20
	});

	ds.bind("error", dataSource_error);

	$("#srvc-grid").kendoGrid({
		//toolbar:    ["create"],
		dataSource: ds,
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
                title: "Code"
            },
            {
                field: "name",
				title: "Name"
			},


			{
				field: "url",
				title: "Url",
				width: "30%"
			},
			{
				field: "isMobile",
				title: "Mobile"
			},
			{
				field: "isExternal",
				title: "External"
			},
			{
				field: "isActive",
				title: "Active"
			},
			{command: ["edit", "destroy"], title: "&nbsp;", width: 120}
		]
	});
}