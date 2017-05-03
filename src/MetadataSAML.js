/**
 * Created by Alexz on 03/05/2017.
 */
/**
 * @file Metadata.js
 * @author Tony Ngan
 * @desc An abstraction for metadata of identity provider and service provider
 */
var fs = require('fs');
var dom = require('xmldom').DOMParser;
var xpath = require('xpath');

const namespace = {binding: {
		redirect: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
		post: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
		arifact: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-ARIFACT'
}};

/**
 * @param  {string} meta is either xmlString or file name
 * @param  {object} extraParse for custom metadata extractor
 * @param  {Boolean} isXml declares whether meta is xmlString or filePath
 */
module.exports = function(meta, extraParse, isXml) {
	/**
	 * @private
	 * @desc Create XPath
	 * @param  {string/object} local     parameters to create XPath
	 * @param  {boolean} isExtractAll    define whether returns whole content according to the XPath
	 * @return {string} xpath
	 * @example
	 */
	var createXPath = function createXPath(local, isExtractAll) {
		var xpath = '';
		if(typeof local === 'object') {
			xpath = "//*[local-name(.)='" + local.name + "']/@" + local.attr;
		} else {
			xpath = isExtractAll === true ? "//*[local-name(.)='" + local + "']/text()" : "//*[local-name(.)='" + local + "']";
		}
		return xpath;
	};
	/**
	 * @private
	 * @desc Get the attibutes
	 * @param  {xml} xmlDoc              used xml document
	 * @param  {string} localName        tag name without prefix
	 * @param  {[string]} attributes     array consists of name of attributes
	 * @return {string/array}
	 */
	var getAttributes = function getAttributes(xmlDoc, localName, attributes) {
		var _xpath = createXPath(localName);
		var _selection = xpath.select(_xpath, xmlDoc);

		if(_selection.length === 0) {
			return undefined;
		} else {
			var data = [];
			_selection.forEach(function(_s) {
				var _dat = {};
				var doc = new dom().parseFromString(_s.toString());
				attributes.forEach(function(_attribute) {
					_dat[_attribute.toLowerCase()] = getAttribute(doc, localName, _attribute);
				});
				data.push(_dat);
			});
			return data.length === 1 ? data[0] : data;
		}
	};
	/**
	 * @private
	 * @desc Helper function used by another private function: getAttributes
	 * @param  {xml} xmlDoc          used xml document
	 * @param  {string} localName    tag name without prefix
	 * @param  {string} attribute    name of attribute
	 * @return {string} attribute value
	 */
	var getAttribute = function getAttribute(xmlDoc, localName, attribute) {
		var _xpath = createXPath({
			name: localName,
			attr: attribute
		});
		var _selection = xpath.select(_xpath, xmlDoc);

		if(_selection.length !== 1) {
			return undefined;
		} else {
			return _selection[0].nodeValue.toString();
		}
	};
	/**
	 * @private
	 * @desc Get the entire body according to the XPath
	 * @param  {xml} xmlDoc              used xml document
	 * @param  {string} localName        tag name without prefix
	 * @param  {boolean} isOutputString  output is string format (default is true)
	 * @return {string/array}
	 */
	var getEntireBody = function getEntireBody(xmlDoc, localName, isOutputString) {
		var _xpath = createXPath(localName);
		var _selection = xpath.select(_xpath, xmlDoc);

		if(_selection.length === 0) {
			return undefined;
		} else {
			var data = [];
			_selection.forEach(function(_s) {
				data.push(Utility.convertToString(_s, isOutputString !== false));
			});
			return data.length === 1 ? data[0] : data;
		}
	};
	/**
	 * @private
	 * @desc  Get the inner xml according to the XPath
	 * @param  {xml} xmlDoc          used xml document
	 * @param  {string} localName    tag name without prefix
	 * @return {string/array} value
	 */
	var getInnerText = function getInnerText(xmlDoc, localName) {
		var _xpath = createXPath(localName, true);
		var _selection = xpath.select(_xpath, xmlDoc);

		if(_selection.length === 0) {
			return undefined;
		} else {
			var data = [];
			_selection.forEach(function(_s) {
				data.push(_s.nodeValue.toString());
			});
			return data.length === 1 ? data[0] : data;
		}
	};
	/**
	 * @private
	 * @desc Helper function used to return result with complex format
	 * @param  {xml} xmlDoc              used xml document
	 * @param  {string} localName        tag name without prefix
	 * @param  {string} localNameKey     key associated with tag name
	 * @param  {string} valueTag         tag of the value
	 */
	var getInnerTextWithOuterKey = function getInnerTextWithOuterKey(xmlDoc, localName, localNameKey, valueTag) {
		var _xpath = createXPath(localName);
		var _selection = xpath.select(_xpath, xmlDoc);
		var obj = {};

		_selection.forEach(function(_s) {
			var xd = new dom().parseFromString(_s.toString());
			var key = xpath.select("//*[local-name(.)='" + localName + "']/@" + localNameKey, xd);
			var value = xpath.select("//*[local-name(.)='" + valueTag + "']/text()", xd);
			var res;

			if(key && key.length == 1 && value && value.length > 0) {
				if(value.length == 1) {
					res = value[0].nodeValue.toString();
				} else {
					var _dat = [];
					value.forEach(function(v) {
						_dat.push(v.nodeValue.toString());
					});
					res = _dat;
				}
				obj[key[0].nodeValue.toString()] = res;
			} else{
				//console.warn('Multiple keys or null value is found');
			}
		});
		return Object.keys(obj).length === 0 ? undefined : obj;
	};
	/**
	 * @private
	 * @desc  Get the attribute according to the key
	 * @param  {string} localName            tag name without prefix
	 * @param  {string} localNameKey         key associated with tag name
	 * @param  {string} attributeTag         tag of the attribute
	 */
	var getAttributeKey = function getAttributeKey(xmlDoc, localName, localNameKey, attributeTag) {
		var _xpath = createXPath(localName);
		var _selection = xpath.select(_xpath, xmlDoc);
		var data = [];

		_selection.forEach(function(_s) {
			var xd = new dom().parseFromString(_s.toString());
			var key = xpath.select("//*[local-name(.)='" + localName + "']/@" + localNameKey, xd);
			var value = xpath.select("//*[local-name(.)='" + localName + "']/@" + attributeTag, xd);

			if(value && value.length == 1 && key && key.length == 1) {
				var obj = {};
				obj[key[0].nodeValue.toString()] = value[0].nodeValue.toString();
				data.push(obj);
			} else {
				//console.warn('Multiple keys or null value is found');
			}
		});
		return data.length === 0 ? undefined : data;
	};

	function extractor(xmlString, fields) {
		var doc = new dom().parseFromString(xmlString);
		var _meta = {};

		fields.forEach(function(field) {
			var _objKey;
			var res;

			if(typeof field === 'string') {
				_meta[field.toLowerCase()] = getInnerText(doc, field);
			}else if(typeof field === 'object') {
				var _localName = field.localName;
				var _extractEntireBody = field.extractEntireBody === true;
				var _attributes = field.attributes || [];
				var _customKey = field.customKey || '';

				if(typeof _localName === 'string') {
					_objKey = _localName;
					if(_extractEntireBody) {
						res = getEntireBody(doc,_localName);
					} else {
						if(_attributes.length !== 0) {
							res = getAttributes(doc, _localName, _attributes);
						} else {
							res = getInnerText(doc,_localName);
						}
					}
				} else {
					_objKey = _localName.tag;
					if(field.attributeTag) {
						res = getAttributeKey(doc, _objKey, _localName.key, field.attributeTag);
					} else if (field.valueTag) {
						res = getInnerTextWithOuterKey(doc, _objKey, _localName.key, field.valueTag);
					}
				}
				_meta[_customKey === '' ? _objKey.toLowerCase() : _customKey] = res;
			}
		});
		return _meta;
	}
	/**
	 * @desc Constructor
	 * @param {string} meta is either xmlString or file name
	 */
	function Metadata(meta) {

		this.xmlString = isXml === true ? meta.toString() :　fs.readFileSync(meta).toString();
		this.meta = extractor(this.xmlString, Array.prototype.concat([{
			localName: 'EntityDescriptor',
			attributes: ['entityID']
		},{
			localName: {
				tag: 'KeyDescriptor',
				key: 'use'
			},
			valueTag: 'X509Certificate'
		},{
			localName: {
				tag: 'SingleLogoutService',
				key: 'Binding'
			},
			attributeTag: 'Location'
		}, 'NameIDFormat'], extraParse || [])); // function overloading
	}
	/**
	 * @desc Get the metadata in xml format
	 * @return {string} metadata in xml format
	 */
	Metadata.prototype.getMetadata = function getMetadata() {
		return this.xmlString;
	};
	/**
	 * @desc Export the metadata to specific file
	 * @param {string} exportFile is the output file path
	 */
	Metadata.prototype.exportMetadata = function exportMetadata(exportFile) {
		fs.writeFileSync(exportFile, this.xmlString);
	};
	/**
	 * @desc Get the entityID in metadata
	 * @return {string} entityID
	 */
	Metadata.prototype.getEntityID = function getEntityID() {
		return this.meta.entitydescriptor.entityid;
	};
	/**
	 * @desc Get the x509 certificate declared in entity metadata
	 * @param  {string} use declares the type of certificate
	 * @return {string} certificate in string format
	 */
	Metadata.prototype.getX509Certificate = function getX509Certificate(use) {
		if (use === 'signing' || use === 'encryption') {
			return this.meta.keydescriptor[use];
		}
		throw new Error('undefined use of key in getX509Certificate');
	};
	/**
	 * @desc Get the support NameID format declared in entity metadata
	 * @return {array} support NameID format
	 */
	Metadata.prototype.getNameIDFormat = function getNameIDFormat() {
		return this.meta.nameidformat;
	};
	/**
	 * @desc Get the entity endpoint for single logout service
	 * @param  {string} binding e.g. redirect, post
	 * @return {string/object} location
	 */
	Metadata.prototype.getSingleLogoutService = function getSingleLogoutService(binding) {
		if(typeof binding === 'string') {
			var _location;
			var _binding = namespace.binding[binding];
			this.meta.singlelogoutservice.forEach(function(obj) {
				if(obj[_binding]) {
					_location = obj[_binding];
					return;
				}
			});
			return _location;
		} else {
			return this.meta.singlelogoutservice;
		}
	};
	/**
	 * @desc Get the support bindings
	 * @param  {[string]} services
	 * @return {[string]} support bindings
	 */
	Metadata.prototype.getSupportBindings = function getSupportBindings(services) {
		var _supportBindings = [];
		if(services) {
			services.forEach(function(obj) {
				_supportBindings.push(Object.keys(obj)[0]);
			});
		}
		return _supportBindings;
	};
	/**
	 * return a new instance
	 */
	return new Metadata(meta);
};
