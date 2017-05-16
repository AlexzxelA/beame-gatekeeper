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
			return {ssoPair:{idp:this._idp, sp:(this._path + spName)}, cred:this._cred, path: this._path};
		}
		else
			return {ssoPair:{idp:this._idp}, cred:this._cred, path: this._path};
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
		this._persistentId = config.persistentId;
		this._path      = config.path;
	}

	initMetadata(metadata, cb){
		metadata?metadata.initMetadata(()=>{
			cb(metadata)
		}):cb();
	}

	findSPmeta(spId){
		return new Promise((resolve, reject)=>{
			let files = fs.readdirSync(this._path);
			let lastIndex = (ndx, array) => {
				if(ndx == (array.length - 1)){
					resolve(null);
				}
			};
			if(!files)
				resolve(null);
			else {
				for(let idx = 0; idx < files.length; idx++) {
					try {
						let tmpFile = path.join(this._path, files[idx]);
						if (fs.lstatSync(tmpFile).isFile()) {
							let fileContent = fs.readFileSync(tmpFile);
							if (fileContent && fileContent.indexOf(spId) >= 0){
								resolve(tmpFile);
								break;
							}
							else lastIndex(idx, files);
						}
						else lastIndex(idx, files);
					}
					catch (e) {
						lastIndex(idx, files);
					}
				}
			}
		});

	}

	processRequest(xXx, sessionMeta, cb){
		this.initMetadata(xXx, (metadata)=>{
			let postTarget =
				sessionMeta?sessionMeta.assertionConsumerServiceURL:
				metadata?metadata.getAssertionConsumerService('post'):null;
			let SPorigin    = postTarget;
			if(postTarget){
				if(postTarget.includes('://')){
					let segments = postTarget.split("/");
					SPorigin = segments[0] + "//" + segments[2];
				}
			}
			if(!metadata.getNameQualifier())
				this._persistentId=this._user.id;

			let a = samlp.auth({
				inResponseTo:   sessionMeta?sessionMeta.id:null,
				RelayState:     sessionMeta?sessionMeta.RelayState:null,
				SAMLRequest:    this._request,
				destination:    SPorigin.split('?')[0]||postTarget.split('?')[0],
				recipient:      SPorigin||postTarget,
				nameQualifier:  metadata?metadata.getNameQualifier():null,
				spNameQualifier:metadata?metadata.getSPNameQualifier():null,
				persistentId:   this._persistentId,
				audience:       sessionMeta?sessionMeta.issuer:metadata.getEntityID(),
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
				customResponseHandler: (err, html)=>{console.log(html);cb(err, html)}
			});
			a();
		});
	}

	getSamlHtml(cb){
		let xXx=this._ssoPair.sp?new metaParser(this._ssoPair.sp):null;
		if(this._request){
			samlp.parseRequest({query:{SAMLRequest:this._request}}, (err, request)=>{
				if(err){
					console.error(err);
				}
				else{
					this.findSPmeta(request.issuer).then((sp)=>{
						xXx = sp && new metaParser(sp);
						this.processRequest(xXx, request, cb);
					});
				}

			});
		}
		else{
			this.processRequest(xXx, null, cb);
		}

	}
}

module.exports = {
	samlSession,
	samlManager
};