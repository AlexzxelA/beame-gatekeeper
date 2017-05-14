/**
 * Created by zenit1 on 14/05/2017.
 */
function loadRegToken() {

	new Clipboard('#copy-btn');

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

	$('#btn-create-regtoken').off('click').on('click', function (e) {

		e.preventDefault();

		showLoader();

		$('#reg_token').html(null);
		$('#reg-token-container').hide();

		var form     = $('#frm-create-regtoken'),
		    url      = form.attr('action'),
		    method   = form.attr('method'),
		    formData = {
			    fqdn:    form.find('input[name="fqdn"]').data('kendoComboBox').value(),
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
				hideLoader();
				console.log(response);
				if (response.responseCode == 1) {

					$("#token-info").removeClass('ad-error').addClass('ad-success');

					$('#reg_token').html(response.token);
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