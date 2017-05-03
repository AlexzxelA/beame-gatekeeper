/**
 * Created by Alexz on 03/05/2017.
 */
/**
 * @file SPMetadata.js
 * @author Tony Ngan
 * @desc  Metadata of service provider
 */
const namespace = {
	binding: {
		redirect: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
		post: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
		arifact: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-ARIFACT'
	},
	names: {
		protocol: 'urn:oasis:names:tc:SAML:2.0:protocol',
		assertion: 'urn:oasis:names:tc:SAML:2.0:assertion',
		metadata: 'urn:oasis:names:tc:SAML:2.0:metadata',
		userLogout: 'urn:oasis:names:tc:SAML:2.0:logout:user',
		adminLogout: 'urn:oasis:names:tc:SAML:2.0:logout:admin'
	},
	authnContextClassRef: {
		password: 'urn:oasis:names:tc:SAML:2.0:ac:classes:Password',
		passwordProtectedTransport: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport'
	},
	format: {
		emailAddress: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
		persistent: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
		transient: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
		entity: 'urn:oasis:names:tc:SAML:2.0:nameid-format:entity',
		unspecified: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
		kerberos: 'urn:oasis:names:tc:SAML:2.0:nameid-format:kerberos',
		windowsDomainQualifiedName: 'urn:oasis:names:tc:SAML:1.1:nameid-format:WindowsDomainQualifiedName',
		x509SubjectName: 'urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName'
	},
	statusCode:{
		// permissible top-level status codes
		success: 'urn:oasis:names:tc:SAML:2.0:status:Success',
		requester: 'urn:oasis:names:tc:SAML:2.0:status:Requester',
		responder: 'urn:oasis:names:tc:SAML:2.0:status:Responder',
		versionMismatch: 'urn:oasis:names:tc:SAML:2.0:status:VersionMismatch',
		// second-level status codes
		authFailed: 'urn:oasis:names:tc:SAML:2.0:status:AuthnFailed',
		invalidAttrNameOrValue: 'urn:oasis:names:tc:SAML:2.0:status:InvalidAttrNameOrValue',
		invalidNameIDPolicy: 'urn:oasis:names:tc:SAML:2.0:status:InvalidNameIDPolicy',
		noAuthnContext:'urn:oasis:names:tc:SAML:2.0:status:NoAuthnContext',
		noAvailableIDP:'urn:oasis:names:tc:SAML:2.0:status:NoAvailableIDP',
		noPassive:'urn:oasis:names:tc:SAML:2.0:status:NoPassive',
		noSupportedIDP:'urn:oasis:names:tc:SAML:2.0:status:NoSupportedIDP',
		partialLogout:'urn:oasis:names:tc:SAML:2.0:status:PartialLogout',
		proxyCountExceeded:'urn:oasis:names:tc:SAML:2.0:status:ProxyCountExceeded',
		requestDenied:'urn:oasis:names:tc:SAML:2.0:status:RequestDenied',
		requestUnsupported:'urn:oasis:names:tc:SAML:2.0:status:RequestUnsupported',
		requestVersionDeprecated:'urn:oasis:names:tc:SAML:2.0:status:RequestVersionDeprecated',
		requestVersionTooHigh:'urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooHigh',
		requestVersionTooLow:'urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooLow',
		resourceNotRecognized:'urn:oasis:names:tc:SAML:2.0:status:ResourceNotRecognized',
		tooManyResponses:'urn:oasis:names:tc:SAML:2.0:status:TooManyResponses',
		unknownAttrProfile:'urn:oasis:names:tc:SAML:2.0:status:UnknownAttrProfile',
		unknownPrincipal:'urn:oasis:names:tc:SAML:2.0:status:UnknownPrincipal',
		unsupportedBinding:'urn:oasis:names:tc:SAML:2.0:status:UnsupportedBinding'
	}
};
var Metadata = require('./MetadataSAML');
var xml = require('xml');

/**
 * @param  {object/string} meta (either file path in string format or configuation in object)
 * @return {object} prototypes including public functions
 */
module.exports = function(meta) {
	var byMetadata = typeof meta === 'string';
	/**
	 * @desc Helper function to create the key section in metadata (abstraction for signing and encrypt use)
	 * @param  {string} use          type of certificate (e.g. signing, encrypt)
	 * @param  {string} certFile     declares the .cer file (e.g. path/certificate.cer)
	 * @return {object} object used in xml module
	 */
	createKeySection: function createKeySection(use, certFile) {
		return {
			KeyDescriptor:[{
				_attr: {
					use: use
				}
			},{
				KeyInfo: [{
					_attr: {
						'xmlns:ds':'http://www.w3.org/2000/09/xmldsig#'
					}
				},{
					X509Data: [{
						X509Certificate: certFile.replace(/\n/g, '').replace(/\r/g, '').replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '')
					}]
				}]
			}]
		};
	}
	/**
	 * @desc SP Metadata is for creating Service Provider, provides a set of API to manage the actions in SP.
	 */
	function SPMetadata() {}
	/**
	 * @desc  Initialize with creating a new metadata object
	 * @param {string/objects} meta     declares path of the metadata
	 * @param {array of Objects}        high-level XML element selector
	 */
	SPMetadata.prototype = new Metadata(meta, [{
		localName: 'SPSSODescriptor',
		attributes: ['WantAssertionsSigned', 'AuthnRequestsSigned']
	},{
		localName: 'AssertionConsumerService',
		attributes: ['Binding', 'Location', 'isDefault', 'index']
	}], !byMetadata);
	/**
	 * @desc Get the preference whether it wants a signed assertion response
	 * @return {boolean} Wantassertionssigned
	 */
	SPMetadata.prototype.isWantAssertionsSigned = function isWantAssertionsSigned() {
		return this.meta.spssodescriptor.wantassertionssigned === 'true';
	};
	/**
	 * @desc Get the preference whether it signs request
	 * @return {boolean} Authnrequestssigned
	 */
	SPMetadata.prototype.isAuthnRequestSigned = function isAuthnRequestSigned() {
		return this.meta.spssodescriptor.authnrequestssigned === 'true';
	};
	/**
	 * @desc Get the entity endpoint for assertion consumer service
	 * @param  {string} binding         protocol binding (e.g. redirect, post)
	 * @return {string/[string]} URL of endpoint(s)
	 */
	SPMetadata.prototype.getAssertionConsumerService = function getAssertionConsumerService(binding) {
		if(typeof binding === 'string') {
			var _location;
			var _binding = namespace.binding[binding];

			if(this.meta.assertionconsumerservice.length > 0) {
				this.meta.assertionconsumerservice.forEach(function(obj) {
					if(obj.binding === _binding) {
						_location = obj.location;
						return;
					}
				});
			} else {
				if(this.meta.assertionconsumerservice.binding === _binding) {
					_location = this.meta.assertionconsumerservice.location;
				}
			}
			return _location;
		} else {
			return this.meta.assertionconsumerservice;
		}
	};
	/**
	 * @desc return the prototype
	 */
	return SPMetadata.prototype;
};
