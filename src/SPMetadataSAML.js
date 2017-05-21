/**
 * Created by Alexz on 03/05/2017.
 */
/**
 * @file SPMetadata.js
 * @author Tony Ngan
 * @desc  Metadata of service provider
 */
"use strict";
const namespaceX = {
	binding:              {
		redirect: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
		post:     'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
		artifact: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-ARTIFACT'
	},
	names:                {
		protocol:    'urn:oasis:names:tc:SAML:2.0:protocol',
		assertion:   'urn:oasis:names:tc:SAML:2.0:assertion',
		metadata:    'urn:oasis:names:tc:SAML:2.0:metadata',
		userLogout:  'urn:oasis:names:tc:SAML:2.0:logout:user',
		adminLogout: 'urn:oasis:names:tc:SAML:2.0:logout:admin'
	},
	authnContextClassRef: {
		password:                   'urn:oasis:names:tc:SAML:2.0:ac:classes:Password',
		passwordProtectedTransport: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport'
	},
	format:               {
		emailAddress:               'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
		persistent:                 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
		transient:                  'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
		entity:                     'urn:oasis:names:tc:SAML:2.0:nameid-format:entity',
		unspecified:                'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
		kerberos:                   'urn:oasis:names:tc:SAML:2.0:nameid-format:kerberos',
		windowsDomainQualifiedName: 'urn:oasis:names:tc:SAML:1.1:nameid-format:WindowsDomainQualifiedName',
		x509SubjectName:            'urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName'
	},
	statusCode:           {
		// permissible top-level status codes
		success:                  'urn:oasis:names:tc:SAML:2.0:status:Success',
		requester:                'urn:oasis:names:tc:SAML:2.0:status:Requester',
		responder:                'urn:oasis:names:tc:SAML:2.0:status:Responder',
		versionMismatch:          'urn:oasis:names:tc:SAML:2.0:status:VersionMismatch',
		// second-level status codes
		authFailed:               'urn:oasis:names:tc:SAML:2.0:status:AuthnFailed',
		invalidAttrNameOrValue:   'urn:oasis:names:tc:SAML:2.0:status:InvalidAttrNameOrValue',
		invalidNameIDPolicy:      'urn:oasis:names:tc:SAML:2.0:status:InvalidNameIDPolicy',
		noAuthnContext:           'urn:oasis:names:tc:SAML:2.0:status:NoAuthnContext',
		noAvailableIDP:           'urn:oasis:names:tc:SAML:2.0:status:NoAvailableIDP',
		noPassive:                'urn:oasis:names:tc:SAML:2.0:status:NoPassive',
		noSupportedIDP:           'urn:oasis:names:tc:SAML:2.0:status:NoSupportedIDP',
		partialLogout:            'urn:oasis:names:tc:SAML:2.0:status:PartialLogout',
		proxyCountExceeded:       'urn:oasis:names:tc:SAML:2.0:status:ProxyCountExceeded',
		requestDenied:            'urn:oasis:names:tc:SAML:2.0:status:RequestDenied',
		requestUnsupported:       'urn:oasis:names:tc:SAML:2.0:status:RequestUnsupported',
		requestVersionDeprecated: 'urn:oasis:names:tc:SAML:2.0:status:RequestVersionDeprecated',
		requestVersionTooHigh:    'urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooHigh',
		requestVersionTooLow:     'urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooLow',
		resourceNotRecognized:    'urn:oasis:names:tc:SAML:2.0:status:ResourceNotRecognized',
		tooManyResponses:         'urn:oasis:names:tc:SAML:2.0:status:TooManyResponses',
		unknownAttrProfile:       'urn:oasis:names:tc:SAML:2.0:status:UnknownAttrProfile',
		unknownPrincipal:         'urn:oasis:names:tc:SAML:2.0:status:UnknownPrincipal',
		unsupportedBinding:       'urn:oasis:names:tc:SAML:2.0:status:UnsupportedBinding'
	}
};
const metaFields = [{
	localName:  'SPSSODescriptor',
	attributes: ['WantAssertionsSigned', 'AuthnRequestsSigned']
}, {
	localName:  'AssertionConsumerService',
	attributes: ['Binding', 'Location', 'isDefault', 'index']
}, {
	localName:  'SingleSignOnService',
	attributes: ['Binding', 'Location']
}, {
	localName:  'EntityDescriptor',
	attributes: ['entityID']
}, {
	localName: {
		tag: 'KeyDescriptor',
		key: 'use'
	},
	valueTag:  'X509Certificate'
}, {
	localName:    {
		tag: 'SingleLogoutService',
		key: 'Binding'
	},
	attributeTag: 'Location'
},
	'NameIDFormat',
	'NameQualifier',
	'SPNameQualifier'];

const xml = require('xml');
let fs    = require('fs');
let dom   = require('xmldom').DOMParser;
let xpath = require('xpath');

/**
 * @param  {object/string} meta (either file path in string format or configuation in object)
 * @return {object} prototypes including public functions
 */
class SPMetadata {
	constructor(meta) {
		this.meta      = null;
		this.isXml     = typeof meta !== 'string';
		this.xmlString = this.isXml ? meta.toString() : fs.readFileSync(meta).toString();
	}

	initMetadata(cb) {
		try {
			this.meta = this.extractor(this.xmlString, metaFields);
		}
		catch (e) {
			console.error(e);
		}

		cb();
	}

	//noinspection JSUnusedGlobalSymbols
	/**
	 * @desc Helper function to create the key section in metadata (abstraction for signing and encrypt use)
	 * @param  {string} use          type of certificate (e.g. signing, encrypt)
	 * @param  {string} certFile     declares the .cer file (e.g. path/certificate.cer)
	 * @return {object} object used in xml module
	 */
	static createKeySection(use, certFile) {
		return {
			KeyDescriptor: [{
				_attr: {
					use: use
				}
			}, {
				KeyInfo: [{
					_attr: {
						'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#'
					}
				}, {
					X509Data: [{
						X509Certificate: certFile.replace(/\n/g, '').replace(/\r/g, '').replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '')
					}]
				}]
			}]
		};
	};

	//noinspection JSUnusedGlobalSymbols
	/**
	 * @desc Get the preference whether it wants a signed assertion response
	 * @return {boolean} Wantassertionssigned
	 */
	isWantAssertionsSigned() {
		//noinspection JSUnresolvedVariable
		return this.meta.spssodescriptor ? this.meta.spssodescriptor.wantassertionssigned === 'true' : false;
	};

	//noinspection JSUnusedGlobalSymbols
	/**
	 * @desc Get the preference whether it signs request
	 * @return {boolean} Authnrequestssigned
	 */
	isAuthnRequestSigned() {
		//noinspection JSUnresolvedVariable
		return this.meta.spssodescriptor ? this.meta.spssodescriptor.authnrequestssigned === 'true' : false;
	};

	/**
	 * @desc Get the support NameQualifier format declared in entity metadata
	 * @return {array} support NameID format
	 */
	getNameQualifier() {
		//noinspection JSUnresolvedVariable
		return this.meta.namequalifier;
	};

	/**
	 * @desc Get the support SPNameQualifier format declared in entity metadata
	 * @return {array} support NameID format
	 */
	getSPNameQualifier() {
		//noinspection JSUnresolvedVariable
		return this.meta.spnamequalifier;
	};

	getNameIDFormat() {
		//noinspection JSUnresolvedVariable
		return this.meta.nameidformat;
	}

	getEntityID() {
		//noinspection JSUnresolvedVariable
		return this.meta.entitydescriptor ? this.meta.entitydescriptor.entityid : null;
	}

	/**
	 * @desc Get the entity endpoint for assertion consumer service
	 * @param  {string} binding         protocol binding (e.g. redirect, post)
	 * @return {string/[string]} URL of endpoint(s)
	 */
	getAssertionConsumerService(binding) {
		//noinspection JSUnresolvedVariable
		if (typeof binding === 'string' && this.meta.assertionconsumerservice) {
			let _location;
			let _binding = namespaceX.binding[binding];
			//noinspection JSUnresolvedVariable
			let tmpObj   = Object.assign(this.meta.assertionconsumerservice, {});
			if (tmpObj > 0) {
				tmpObj.forEach((obj) => {
					if (obj.binding === _binding) {
						_location = obj.location;
					}
				});
			}
			else {
				//noinspection JSUnresolvedVariable
				if (this.meta.assertionconsumerservice.binding === _binding) {
					//noinspection JSUnresolvedVariable
					_location = this.meta.assertionconsumerservice.location;
				}
			}
			return _location;
		}
		else {
			//noinspection JSUnresolvedVariable
			return this.meta.assertionconsumerservice;
		}
	};

	getSSOService(binding) {
		//noinspection JSUnresolvedVariable
		if (typeof binding === 'string' && this.meta.singlesignonservice) {
			let _location;
			let _binding = namespaceX.binding[binding];
			//noinspection JSUnresolvedVariable
			let tmpObj   = Object.assign(this.meta.singlesignonservice, {});
			if (tmpObj.length > 0) {
				tmpObj.forEach((obj) => {
					if (obj.binding === _binding) {
						_location = obj.location;
					}
				});
			}
			else {
				//noinspection JSUnresolvedVariable
				if (this.meta.singlesignonservice.binding === _binding) {
					//noinspection JSUnresolvedVariable
					_location = this.meta.singlesignonservice.location;
				}
			}
			return _location;
		}
		else {
			//noinspection JSUnresolvedVariable
			return this.meta.singlesignonservice;
		}
	};

	static createXPath(local, isExtractAll) {
		let xpath = '';
		if (typeof local === 'object') {
			xpath = "//*[local-name(.)='" + local.name + "']/@" + local.attr;
		} else {
			xpath = isExtractAll === true ? "//*[local-name(.)='" + local + "']/text()" : "//*[local-name(.)='" + local + "']";
		}
		return xpath;
	}

	/**
	 * @private
	 * @desc Get the entire body according to the XPath
	 * @param  {Document} xmlDoc              used xml document
	 * @param  {string} localName        tag name without prefix
	 * @param  {boolean} isOutputString  output is string format (default is true)
	 * @return {String|Array}
	 */
	getEntireBody(xmlDoc, localName, isOutputString = true) {
		let _xpath     = SPMetadata.createXPath(localName);
		let _selection = xpath.select(_xpath, xmlDoc);

		if (_selection.length === 0) {
			return undefined;
		} else {
			let data = [];
			_selection.forEach((_s) => {
				data.push(SPMetadata.convertToString(_s, isOutputString !== false));
			});
			return data.length == 1 ? data[0] : data;
		}
	}

	/**
	 * @private
	 * @desc  Get the inner xml according to the XPath
	 * @param  {Document} xmlDoc          used xml document
	 * @param  {string} localName    tag name without prefix
	 * @return {String|Array} value
	 */
	getInnerText(xmlDoc, localName) {
		let _xpath     = SPMetadata.createXPath(localName, true);
		let _selection = xpath.select(_xpath, xmlDoc);

		if (_selection.length === 0) {
			return undefined;
		} else {
			let data = [];
			_selection.forEach((_s) => {
				//noinspection JSUnresolvedVariable
				data.push(_s.nodeValue.toString());
			});
			return data.length == 1 ? data[0] : data;
		}
	}

	/**
	 * @private
	 * @desc Helper function used to return result with complex format
	 * @param  {Document} xmlDoc              used xml document
	 * @param  {string} localName        tag name without prefix
	 * @param  {string} localNameKey     key associated with tag name
	 * @param  {string} valueTag         tag of the value
	 */
	getInnerTextWithOuterKey(xmlDoc, localName, localNameKey, valueTag) {
		let _xpath     = SPMetadata.createXPath(localName);
		let _selection = xpath.select(_xpath, xmlDoc);
		let obj        = {};

		_selection.forEach((_s) => {
			let xd    = new dom().parseFromString(_s.toString());
			let key   = xpath.select("//*[local-name(.)='" + localName + "']/@" + localNameKey, xd);
			let value = xpath.select("//*[local-name(.)='" + valueTag + "']/text()", xd);
			let res;

			if (key && key.length == 1 && value && value.length > 0) {
				if (value.length == 1) {
					res = value[0].nodeValue.toString();
				}
				else {
					let _dat = [];
					value.forEach((v) => {
						//noinspection JSUnresolvedVariable
						_dat.push(v.nodeValue.toString());
					});
					res = _dat;
				}
				obj[key[0].nodeValue.toString()] = res;
			} else {
				//console.warn('Multiple keys or null value is found');
			}
		});
		return Object.keys(obj).length == 0 ? undefined : obj;
	}

	/**
	 * @private
	 * @desc  Get the attribute according to the key
	 * @param xmlDoc
	 * @param  {string} localName            tag name without prefix
	 * @param  {string} localNameKey         key associated with tag name
	 * @param  {string} attributeTag         tag of the attribute
	 */
	getAttributeKey(xmlDoc, localName, localNameKey, attributeTag) {
		let _xpath     = SPMetadata.createXPath(localName);
		let _selection = xpath.select(_xpath, xmlDoc);
		let data       = [];

		_selection.forEach((_s) => {
			let xd    = new dom().parseFromString(_s.toString());
			let key   = xpath.select("//*[local-name(.)='" + localName + "']/@" + localNameKey, xd);
			let value = xpath.select("//*[local-name(.)='" + localName + "']/@" + attributeTag, xd);

			if (value && value.length == 1 && key && key.length == 1) {
				let obj                          = {};
				obj[key[0].nodeValue.toString()] = value[0].nodeValue.toString();
				data.push(obj);
			}
			else {
				//console.warn('Multiple keys or null value is found');
			}
		});
		return data.length === 0 ? undefined : data;
	}

	extractor(xmlString, fields) {

		/** @type {Document} */
		let doc   = new dom().parseFromString(xmlString);
		let _meta = {};

		fields.forEach((field) => {
			let _objKey;
			let res;

			if (typeof field === 'string') {
				_meta[field.toLowerCase()] = this.getInnerText(doc, field);
			}
			else if (typeof field === 'object') {
				let _localName         = field.localName;
				//noinspection JSUnresolvedVariable
				let _extractEntireBody = field.extractEntireBody == true;
				let _attributes        = field.attributes || [];
				//noinspection JSUnresolvedVariable
				let _customKey         = field.customKey || '';

				if (typeof _localName === 'string') {
					_objKey = _localName;
					if (_extractEntireBody) {
						res = this.getEntireBody(doc, _localName);
					} else {
						if (_attributes.length !== 0) {
							res = this.getAttributes(doc, _localName, _attributes);
						} else {
							res = this.getInnerText(doc, _localName);
						}
					}
				} else {
					_objKey = _localName.tag;
					if (field.attributeTag) {
						res = this.getAttributeKey(doc, _objKey, _localName.key, field.attributeTag);
					} else if (field.valueTag) {
						res = this.getInnerTextWithOuterKey(doc, _objKey, _localName.key, field.valueTag);
					}
				}
				_meta[_customKey === '' ? _objKey.toLowerCase() : _customKey] = res;
			}
		});
		return _meta;
	}

	getAttributes(xmlDoc, localName, attributes) {
		let _xpath     = SPMetadata.createXPath(localName);
		let _selection = xpath.select(_xpath, xmlDoc);

		if (_selection.length === 0) {
			return undefined;
		} else {
			let data = [];
			_selection.forEach((_s) => {
				let _dat = {};
				let doc  = new dom().parseFromString(_s.toString());
				attributes.forEach((_attribute) => {
					_dat[_attribute.toLowerCase()] = SPMetadata.getAttribute(doc, localName, _attribute);
				});
				data.push(_dat);
			});
			return data.length === 1 ? data[0] : data;
		}
	}

	/**
	 * @private
	 * @desc Helper function used by another private function: getAttributes
	 * @param  {Document} xmlDoc          used xml document
	 * @param  {string} localName    tag name without prefix
	 * @param  {string} attribute    name of attribute
	 * @return {String|undefined} attribute value
	 */
	static getAttribute(xmlDoc, localName, attribute) {
		let _xpath     = SPMetadata.createXPath({
			name: localName,
			attr: attribute
		});
		let _selection = xpath.select(_xpath, xmlDoc);

		if (_selection.length !== 1) {
			return undefined;
		} else {
			return _selection[0].nodeValue.toString();
		}
	}

	//noinspection JSUnusedGlobalSymbols
	/**
	 * @desc Get the x509 certificate declared in entity metadata
	 * @param  {string} use declares the type of certificate
	 * @return {string} certificate in string format
	 */
	getX509Certificate(use) {
		if (use === 'signing' || use === 'encryption') {
			//noinspection JSUnresolvedVariable
			return this.meta.keydescriptor[use];
		}
		throw new Error('undefined use of key in getX509Certificate');
	}

	static convertToString(input, isOutputString) {
		return isOutputString ? input.toString() : input;
	}
}

module.exports = SPMetadata;