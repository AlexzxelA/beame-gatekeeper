/**
 * Created by zenit1 on 14/05/2017.
 */
var credsTree = null;

function treeRequestData() {

	return {
		options: {
			excludeRevoked: $('#chk-exclude-revoke').is(":checked"),
			text:           $('#inp-find-cred').val()
		}
	}
}

function getTreeNode(fqdn){
	var treeview = credsTree.data("kendoTreeView"),
	    ds       = treeview.dataSource;
	return ds.get(fqdn);
}

function loadCreds() {

	$("#cred-detail").empty().css({visibility: 'hidden'});

	function onSelect(e) {


		var dataItem = this.dataItem(e.node);
		if (!dataItem) return;

		$.ajax({
			url:         '/cred/detail/' + dataItem.fqdn,
			cache:       false,
			type:        "Get",
			//data: JSON.stringify(data),
			datatype:    "json",
			contentType: "application/json; charset=utf-8"
			, success:   function (data) {

				var template = kendo.template($("#tmpl-cred-detail").html());

				var credHtml = template({});

				$("#cred-detail").html(credHtml).promise().done(function () {
					$("#cred-detail").css({visibility: 'visible'});
					loadCredDetail(data);
				});
			}
		});
	}

	var treeview = $("#creds-tree").data("kendoTreeView");

	if (treeview) {
		$("#creds-tree").remove();

		var treeDiv = $('<div>').attr({id: 'creds-tree'});

		$("#creds-tree-container").append(treeDiv);
	}

	window.getNotifManagerInstance().subscribe('credsChanged', function (args) {
		console.log(args.fqdn);
		var fqdn = args.fqdn;
		if (!fqdn) return;

		var tv = credsTree.data("kendoTreeView"),
		    dataItem = getTreeNode(fqdn);

		if (dataItem) {

			var node       = tv.findByUid(dataItem.uid);
			var isExpanded = $(node).attr("data-expanded");

			if(args.data || args.newFqdn){
				var data = args.data;

				if(args.newFqdn){
					$('#inp-find-cred').val(args.newFqdn);
				}
				else if(data.name || data.email){
					$('#inp-find-cred').val(data.name || data.email);
				}
			}

			if (typeof isExpanded !== 'undefined') {
				console.log('expand to ', fqdn);

				dataItem.loaded(false);
				dataItem.load();
			}
			else {
				if (dataItem.hasChildren) {
					tv.expandPath([fqdn]);
				} else {
					var parents = dataItem.chain && dataItem.chain.length ? dataItem.chain.map(function (item) {
						return item.fqdn
					}) : [];

					if(parents.length){
						var parentDataItem = getTreeNode(parents[0]);
						if(parentDataItem){
							parentDataItem.loaded(false);
							parentDataItem.load();
							setTimeout(function(){
								tv.expandPath([fqdn]);
							},500)
						}
					}
				}
			}

		}

	});

	var path2Expand = null;

	credsTree = $("#creds-tree").kendoTreeView({
		dataSource: new kendo.data.HierarchicalDataSource({
			transport:  {
				read: {
					url:      '/creds/list',
					dataType: "json",
					data:     function () {
						return {
							options: {
								excludeRevoked: $('#chk-exclude-revoke').is(":checked")
							}
						}
					}
				}
			},
			schema:     {
				model: {
					id:          "fqdn",
					hasChildren: "hasChildren"
				}
			},
			requestEnd: function (e) {

				path2Expand = null;

				if (e.type != "read") return;

				if (e.response.length != 1) return;

				var cred = e.response[0];

				if (!cred.isRoot) return;

				try {
					path2Expand = cred.fqdn;
				} catch (e) {
				}

			}
		}),
		template:   kendo.template($("#treeview-template").html()),
		select:     onSelect,
		dataBound:  function (e) {

			var treeview = e.sender;

			var text = $('#inp-find-cred').val();

			if (text) {
				text          = text.toLowerCase();
				var credNodes = $("#creds-tree").find('.cred-name');
				for (var i = 0; i < credNodes.length; i++) {

					var node = $(credNodes[i]),
					    parent = node.parent();

					if (node.html().toLowerCase().includes(text) || parent.attr("data-fqdn") == text) {
						node.addClass('matched');
					} else {
						node.removeClass('matched');
					}
				}
			}

			if (!path2Expand) return;

			try {

				console.log('expand to', [path2Expand]);
				treeview.expandPath([path2Expand]);

				var getitem    = treeview.dataSource.get(path2Expand);
				var selectitem = treeview.findByUid(getitem.uid);
				treeview.select(selectitem);
				treeview.trigger('select', {node: selectitem});

			} catch (e) {
			}

		}
	});

	$("#btn-refresh-tree").kendoButton({
		icon: "refresh",
		click: function(){
			credsTree.data("kendoTreeView").dataSource.read();
		}
	});

	$("#btn-refresh-store").kendoButton({
		icon: "refresh",
		click: function(){
			showLoader();
			$.ajax({
				url:         '/creds/reload/',
				cache:       false,
				type:        "Get",
				datatype:    "json",
				contentType: "application/json; charset=utf-8"
				, success:   function (response) {

					hideLoader();

					if (response.responseCode == 1) {
						credsTree.data("kendoTreeView").dataSource.read();
					}
					else {
						alert(response.responseDesc);
					}

				}
			});

			credsTree.data("kendoTreeView").dataSource.read();
		}
	});
}

function findCreds() {
	showLoader();

	var options = {
		options: {
			excludeRevoked: $('#chk-exclude-revoke').is(":checked"),
			text:           $('#inp-find-cred').val()
		}
	};

	$.ajax({
		url:         '/creds/list',
		cache:       false,
		type:        "Get",
		data:        options,
		datatype:    "json",
		contentType: "application/json; charset=utf-8"
		, success:   function (response) {

			hideLoader();
			console.log(response);

			try {

				if (response && response.length) {

					var treeview = credsTree.data("kendoTreeView"),
					    ds       = treeview.dataSource;

					for (var i = 0; i < response.length; i++) {
						var path = response[i];

//                        	for(var j=0;j<path.length;j++){
//                        		var fqdn = path[j];
//
//		                        var dataItem = ds.get(fqdn);
//		                        if(dataItem){
//			                        var node = treeview.findByUid(dataItem.uid);
//			                        var isExpanded = $(node).attr("data-expanded");
//
//			                        if (typeof isExpanded == 'undefined' || isExpanded !== "true") {
//			                        	console.log('expand to ',fqdn);
////				                        setTimeout(function(){
////					                        treeview.expandPath([fqdn]);
////                                        },300)
//				                        //treeview.expandPath([fqdn]);
//			                        }
//		                        }
//                            }

						treeview.expandPath(path);
					}

				}
			} catch (e) {
			}

		}
	});
}

function rebindTree() {
	credsTree.data("kendoTreeView").dataSource.read();
}

