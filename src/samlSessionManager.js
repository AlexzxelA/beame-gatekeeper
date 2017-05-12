/**
 * Created by Alexz on 25/04/2017.
 */
"use strict";
const Constants             = require('../constants');
const BeameSdk              = require('beame-sdk');
const dir                   = BeameSdk.DirectoryServices;
const Config                = BeameSdk.Config;
const path                  = require('path');
const fs                    = require('fs');
const samlp                 = require('samlp');
const metaParser            = require('./SPMetadataSAML');
let certPem                 = null;
let keyPem                  = null;
let samlManagerInstance     = null;

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
			issuer:         'https://'+cred.fqdn
		};

		if(!samlManagerInstance)samlManagerInstance = this;
	}

	getCredData(){
		if(!certPem){
			certPem = dir.readFile(this._certPath);
			this._idp.cert = certPem;
		}
		if(!keyPem){
			keyPem = dir.readFile(this._pkPath);
			this._idp.key = keyPem;
		}
		return {cert:certPem,key:keyPem};
	}

	getConfig(spName){
		this.getCredData();
		if(spName && dir.doesPathExists(this._path + spName)){
			return {ssoPair:{idp:this._idp, sp:(this._path + spName)}, cred:this._cred};
		}
		else
			return {ssoPair:{idp:this._idp}, cred:this._cred};
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
		this._request   = config.SAMLRequest;
	}

	initMetadata(metadata, cb){
		metadata?metadata.initMetadata(()=>{cb(metadata)}):cb();
	}

	getSamlHtml(cb){
		let xXx=this._ssoPair.sp?new metaParser(this._ssoPair.sp):null;
		this.initMetadata(xXx, (metadata)=>{
			const processLogin = (metadata, sessionMeta) => {
				let postTarget = metadata?metadata.getAssertionConsumerService('post'):sessionMeta.assertionConsumerServiceURL;
				let SPorigin    = postTarget;
				if(postTarget){
					if(postTarget.includes('://')){
						let segments = postTarget.split("/");
						SPorigin = segments[0] + "//" + segments[2];
					}
				}
				let a = samlp.auth({
					inResponseTo:   metadata?null:sessionMeta.id,
					RelayState:     metadata?null:sessionMeta.id,
					SAMLRequest:    this._request,
					destination:    SPorigin,
					recipient:      postTarget,
					audience:       metadata?metadata.getEntityID():sessionMeta.issuer,
					issuer:         this._ssoPair.idp.issuer,//,
					cert:           this._ssoPair.idp.cert,
					key:            this._ssoPair.idp.key,
					attributes:     {'User.Email':this._user.emails},
					getPostURL:     () => {return postTarget || SPorigin},
					getUserFromRequest: () => {return this._user},
					nameIdentifierFormat:   metadata?metadata.getNameIDFormat():null,
					signatureNamespacePrefix: 'ds',
					signResponse:   false,
					signatureAlgorithm: 'rsa-sha256',
					digestAlgorithm:    'sha256',
					plainXml:       false,
					template:       path.join(__dirname,'../templates','samlResponseTpl.ejs'),
					customResponseHandler: cb
				});
				a();
			};

			if(this._request)
				samlp.parseRequest({query:{SAMLRequest:this._request}}, (err, request)=>{
					processLogin(null, request);
				});
			else
				processLogin(metadata);
		});
	}
}

module.exports = {
	samlSession,
	samlManager
};