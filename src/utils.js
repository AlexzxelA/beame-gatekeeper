/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const bodyParser = require('body-parser');
const https      = require('https');
const express    = require('express');
const path       = require('path');
const ssoManager  = require('./samlSessionManager');
const beameSDK    = require('beame-sdk');
const CommonUtils = beameSDK.CommonUtils;
const BeameStore  = new beameSDK.BeameStore();
const AuthToken   = beameSDK.AuthToken;

function produceSAMLresponse(userIdData , payload, token, cb) {
	let ssoManagerX        = ssoManager.samlManager.getInstance();
	let ssoConfig          = ssoManagerX.getConfig(payload && payload.app_code);
	ssoConfig.users        = {
		user:           userIdData.email || userIdData.name,
		emails:         userIdData.email || userIdData.name,//userIdData.email,
		name:           {givenName:undefined, familyName:undefined},
		displayName:    userIdData.nickname,
		id:             userIdData.email || userIdData.name,
	};
	ssoConfig.persistentId = userIdData.persistentId;
	ssoConfig.SAMLRequest  = payload && payload.SAMLRequest;
	ssoConfig.RelayState   = payload && payload.RelayState;
	let ssoSession         = new ssoManager.samlSession(ssoConfig);
	ssoSession.getSamlHtml((err, html)=>{
		if(html)cb({
			type: 'saml',
			payload: {
				success: true,
				samlHtml: html,
				session_token: token,
				url: null
			}
		});
	});
}

/**
 *
 * @param router
 * @param staticDir
 * @returns {Router}
 */
function setExpressApp(router, staticDir) {
	let app = express();


	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({extended: false}));
	app.use('/', router);
	if (staticDir) {
		app.use(express.static(staticDir));
	}
	app.use("*", (req, res) => {
		res.status(404).send('404');
	});


	return app;
}

function setExpressAppCommonRoutes(app) {
	app.use(express.static(path.join(__dirname, '..', process.env.BEAME_INSTA_DOC_ROOT)));
}


function createAuthTokenByFqdn(fqdn, data, ttl) {
	if (arguments.length < 3) {
		return Promise.reject('createAuthTokenByFqdn() requires 3 arguments');
	}
	return new Promise((resolve, reject) => {
		BeameStore.find(fqdn, false).then(cred => {
			const token = AuthToken.create(JSON.stringify(data), cred, ttl);
			resolve(token);
		}).catch(() => {
			reject(`createAuthTokenByFqdn() failed getting credential ${fqdn}`);
		});
	});
}

function signDataWithFqdn(fqdn, data) {
	if (arguments.length < 2) {
		return Promise.reject('signDataWithFqdn() requires 2 arguments');
	}
	return new Promise((resolve, reject) => {
		BeameStore.find(fqdn, false).then(cred => {

			let signature = cred.sign(CommonUtils.stringify(data));
			resolve(signature);

		}).catch(() => {
			reject(`signDataWithFqdn() failed getting credential ${fqdn}`);
		});
	});
}
let pairingGlobalsRef = null;
class pairingGlobals {
	constructor() {
		this._sessionIdTimeout = 180;//adjust this value to allow "refresh" on mobile browser
		this._sessionIdScan    = 60 * 1000;
		if (!pairingGlobalsRef) {
			pairingGlobalsRef      = this;
			this._directSessionIds = {};
		}
	}

	setNewSessionId(key, value) {
		this._directSessionIds[key] = {token: value, time: (Math.floor(Date.now() / 1000) + this._sessionIdTimeout)};
	}

	getSessionIds() {
		return this._directSessionIds;
	}

	cleanSessionsCache() {
		setInterval(function () {
			if (this._directSessionIds) {
				for (let i = 0; i < this._directSessionIds.length; i++) {
					let record = this._directSessionIds[i];
					if (!record.time || Math.floor(Date.now() / 1000) > record.time) {
						console.log('deleted record:', record);
						delete this._directSessionIds[i];
					}
				}
			}
		}, this._sessionIdScan)
	}

	static getInstance() {
		return pairingGlobalsRef;
	}
}

let clientCertGlobalsRef = null;
class clientCertGlobals {
	constructor() {
		this._sessionIdTimeout = 180;//adjust this value to allow "refresh" on mobile browser
		this._sessionIdScan    = 60 * 1000;
		if (!clientCertGlobalsRef) {
			clientCertGlobalsRef      = this;
			this._sessionIds = {};
		}
	}

	setNewSessionId(key, value) {
		this._sessionIds[key] = {param: value, time: (Math.floor(Date.now() / 1000) + this._sessionIdTimeout)};
	}

	getSessionIds() {
		return this._sessionIds;
	}

	cleanSessionsCache() {
		setInterval(function () {
			if (this._sessionIds) {
				for (let i = 0; i < this._directSessionIds.length; i++) {
					let record = this._sessionIds[i];
					if (!record.time || Math.floor(Date.now() / 1000) > record.time) {
						console.log('deleted record:', record);
						delete this._sessionIds[i];
					}
				}
			}
		}, this._sessionIdScan)
	}

	static getInstance() {
		return clientCertGlobalsRef;
	}
}

function clearSessionCookie(res) {
	const Constants   = require('../constants');
	const cookieNames = Constants.CookieNames;

	res.clearCookie(cookieNames.Proxy);
	res.clearCookie(cookieNames.RegData);
	res.clearCookie(cookieNames.UserInfo);
	res.clearCookie(cookieNames.LoginData);
}

function generateUID(length) {
	let text     = "",
	    possible = "_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef.ghijklmnopqrstuvwxyz0123456789.";
	for (let i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

//todo => move to sdk
function hashToArray(hash) {
	try {
		let keys = Object.keys(hash);

		return keys.map((v) => {
			return hash[v];
		});
	} catch (e) {
		return [];
	}
}



module.exports = {
	clearSessionCookie,
	setExpressApp,
	setExpressAppCommonRoutes,
	createAuthTokenByFqdn,
	signDataWithFqdn,
	generateUID,
	produceSAMLresponse,
	pairingGlobals,
	clientCertGlobals,
	hashToArray
};
