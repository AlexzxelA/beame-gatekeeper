/**
 * Created by Alexz on 25/04/2017.
 */
"use strict";
const Constants             = require('../constants');
const BeameSdk              = require('beame-sdk');
const dir                   = BeameSdk.DirectoryServices;
const Config                = BeameSdk.Config;
const path                  = require('path');
let samlManagerInstance     = null;
const fs                    = require('fs');
const samlp                 = require('samlp');
let certPem                 = null;
let keyPem                  = null;
/*
* SP Entity ID
* RelayState - where-to redirect on successful login / boomerang in SP initiated session, 80 bytes max, need 2 protect
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
		this._idp       =
		{
			audience:       'https://'+cred.fqdn,//metadata.getEntityID(),
			issuer:         'https://'+cred.fqdn
		};

		if(!samlManagerInstance)samlManagerInstance = this;
	}

	getConfig(spName){
		if(dir.doesPathExists(this._path + spName)){
			if(!certPem){
				certPem = dir.readFile(this._certPath);
				this._idp.cert = certPem;
			}

			if(!keyPem){
				keyPem = dir.readFile(this._pkPath);
				this._idp.key = keyPem;
			}
			return {ssoPair:{idp:this._idp, sp:(this._path + spName)}, cred:this._cred};
		}
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
	}
	getSamlHtml(cb){
		const meta = require('./SPMetadataSAML');
		const metadata = meta(this._ssoPair.sp);
		const processLogin = samlp.auth({
			recipient:      metadata.getAssertionConsumerService('post'),
			audience:       this._ssoPair.idp.audience,
			issuer:         this._ssoPair.idp.issuer,//,
			cert:           this._ssoPair.idp.cert,
			key:            this._ssoPair.idp.key,
			getPostURL:     () => {return metadata.getAssertionConsumerService('post')},
			getUserFromRequest: () => {return this._user},
			signatureNamespacePrefix: 'ds',
			signResponse:   false,
			signatureAlgorithm: 'rsa-sha256',
			digestAlgorithm:    'sha256',
			plainXml:       false,
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