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

		let _PKpath     = path.join(cred.metadata.path, Config.CertFileNames.PRIVATE_KEY),
			_CertPath   = path.join(cred.metadata.path, Config.CertFileNames.P7B);
		this._path      = cred.beameStoreServices._certsDir + '/sso/';
		this._sp        = null;//saml2.ServiceProvider(cred.beameStoreServices._certsDir + '/sso/testsp_saml_metadata.xml');
		this._idp       = saml2.IdentityProvider({
			entityID:'Beameio-SSO',
			nameIDFormat:['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
			privateKeyFile: _PKpath,
			privateKeyFilePass: '',
			signingCertFile: _CertPath,
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

	getSsoPair(spName){
		this._sp = saml2.ServiceProvider(this._path + spName);
		return {idp:this._idp, sp:this._sp};
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
	constructor(){

	}

}

module.exports = {
	samlSession,
	samlManager
};