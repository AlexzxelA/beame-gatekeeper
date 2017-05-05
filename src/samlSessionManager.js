/**
 * Created by Alexz on 25/04/2017.
 */
"use strict";
const Constants             = require('../constants');
const BeameSdk              = require('beame-sdk');
const dir                   = BeameSdk.DirectoryServices;
const Config                = BeameSdk.Config;
const saml2                 = require('express-saml2');

const path                  = require('path');
let samlManagerInstance     = null;
const handlebars            = require('handlebars');
const fs                    = require('fs');
const samlp                 = require('samlp');
const parseXmlString        = require('xml2js').parseString;
var xmldom                  = require('xmldom');
var parser                  = require('xml2json');
const x2js                  = require('x2js');
var certPem                 = null;
var keyPem                  = null;
/*
* SP Entity ID
* RelayState - where-to redirect on successful login / boomerang in SP initiated session, 80 bytes max, need 2 protect
*
*
*
*
* */
class samlManager{
	constructor(cred){
		this._cred = cred;

		let PKpath     = path.join(cred.metadata.path, Config.CertFileNames.PRIVATE_KEY),
			CertPath   = path.join(cred.metadata.path, Config.CertFileNames.P7B);
		this._path      = cred.beameStoreServices._certsDir + '/sso/';
		this._pkPath    = PKpath;
		this._certPath  = CertPath;
		this._sp        = null;//saml2.ServiceProvider(cred.beameStoreServices._certsDir + '/sso/testsp_saml_metadata.xml');
		this._idp1      = {
			entityID:'Beameio-SSO'
		};
		this._idp       = saml2.IdentityProvider({
			entityID:'Beameio-SSO',
			nameIDFormat:['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
			privateKeyFile: PKpath,
			privateKeyFilePass: '',
			signingCertFile: CertPath,
			singleSignOnService:[{
				Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
				Location: 'https://'+cred.fqdn+'/ssoLogin'
			},{
				Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
				Location: 'https://'+cred.fqdn+'/ssoLogin'
			}],
			singleLogoutService:[{
				Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
				Location: 'https://'+cred.fqdn+'/ssoLogout'
			},{
				Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
				Location: 'https://'+cred.fqdn+'/ssoLogout'
			}]
		});

		if(dir.doesPathExists(this._path + 'templates/actions.handlebars'))
			this._template = dir.readFile(this._path + 'templates/actions.handlebars');
		if(!samlManagerInstance)samlManagerInstance = this;
	}

	getConfig(spName){
		if(dir.doesPathExists(this._path + spName)){
			if(!certPem)
				certPem = dir.readFile(this._certPath);
			if(!keyPem)
				keyPem = dir.readFile(this._pkPath);
			return {ssoPair:{idp:this._idp, sp:(this._path + spName)}, cred:this._cred,
			cert: certPem, key: keyPem};
			//this._sp = parser.toJson(dir.readFile(this._path + spName))
		}
			// this._sp = new xmldom.DOMParser().parseFromString(dir.readFile(this._path + spName)).documentElement;
			// parseXmlString(dir.readFile(this._path + spName), (err, result)=>{
			// 	if(!err && result){
			// 		this._sp = JSON.parse(result);
			// 	}
			// });
		// this._sp = saml2.ServiceProvider(this._path + spName);

	}

	getSamlHtml(spName, data){
		 data.title = 'sso';
		 data.author = '@beameio';

		let tmpl = handlebars.compile(this._template);

		let html = tmpl(data);
			// .replace(/&apos;/g, "'")
			// .replace(/&quot;/g, '"')
			// .replace(/&gt;/g, '>')
			// .replace(/&lt;/g, '<')
			// .replace(/&amp;/g, '&')
			// .replace(/&#x3D;/g, '=');
		console.log(html);

		return html;
	}

	static getInstance() {
		return samlManagerInstance;
	}

}


class samlSession{
	constructor(config){
		this._ssoPair   = config.ssoPair;
		this._cred      = config.cred;
		this._user      = config.user;
		this._cert      = config.cert;
		this._key       = config.key;
	}
	getSamlHtml(cb){
		const meta = require('./SPMetadataSAML');
		const metadata = meta(this._ssoPair.sp);
		const processLogin = samlp.auth({
			audience:       metadata.getAssertionConsumerService('post'),//metadata.getEntityID(),
			issuer:         'Beameio-SSO',//,
			cert:           this._cert,
			key:            this._key,
			getPostURL:     () => {return metadata.getAssertionConsumerService('post')},
			getUserFromRequest: () => {return this._user},
			signatureNamespacePrefix: 'ds',
			signResponse:   false,
			signatureAlgorithm: 'rsa-sha256',
			digestAlgorithm:    'sha256',
			plainXml:       true,
			template:       path.join(__dirname,'../templates','samlResponseTpl.ejs'),
			idpInitiatedSessionHandler: cb
		});
		processLogin();
	}
}



module.exports = {
	samlSession,
	samlManager
};