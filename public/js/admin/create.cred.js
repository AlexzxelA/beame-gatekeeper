/**
 * Created by zenit1 on 14/05/2017.
 */
function loadPfx() {


	$("#fqdn").kendoComboBox({
		dataTextField:  "name",
		dataValueField: "fqdn",
		filter:         "contains",
		minLength:      1,
		dataSource:     {
			serverFiltering: true,
			transport:       {
				read: "/creds/filter"
			}
		}
	});

	$('#btn-create-cred').off('click').on('click', function (e) {

		e.preventDefault();

		showLoader();

		var form     = $('#frm-create-cred'),
		    url      = form.attr('action'),
		    method   = form.attr('method'),
		    formData = {
			    fqdn:     form.find('input[name="fqdn"]').data('kendoComboBox').value(),
			    name:     form.find('input[name="name"]').val(),
			    email:    form.find('input[name="email"]').val(),
			    password: form.find('input[name="password"]').val()
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
				console.log(response);
				if (response.responseCode == 1) {

					$("#pfx-info").removeClass('ad-error').addClass('ad-success');
					var cb = $('#fqdn').data('kendoComboBox');
					cb.dataSource.read();
				}
				else {
					$("#pfx-info").removeClass('ad-success').addClass('ad-error');

				}
				$("#pfx-info").html(response.responseDesc);
			}
		});
	});

}
