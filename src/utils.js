/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const bodyParser = require('body-parser');
const https      = require('https');
const express    = require('express');
const path       = require('path');

const beameSDK   = require('beame-sdk');
const BeameStore = new beameSDK.BeameStore();
const AuthToken  = beameSDK.AuthToken;
const Constants = require('../constants');

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
	app.use(express.static(path.join(__dirname, '..', Constants.WebRootFolder)));
}

var localSigninRelayFqdn = null;
function getLocalRelayFqdn() {
	console.log('getLocalRelayFqdn');

	return new Promise((resolve, reject) => {
		if(localSigninRelayFqdn)
			resolve(localSigninRelayFqdn);
		else
			getBestRelay().then(relay=> {
				localSigninRelayFqdn = relay;
				resolve(relay);
			}).catch(e=>{reject(e);})
	});
}

function getBestRelay() {
	return new Promise((resolve, reject) => {

			const beameUtils = beameSDK.BeameUtils;
			beameUtils.selectBestProxy(null, 100, 1000, (error, payload) => {
				if (!error) {
					resolve(payload.endpoint);
				}
				else {
					reject(error);
				}
			});
		}
	);
}

function getRelayFqdn(target, lclFqdn){

	const ProvisionApi = beameSDK.ProvApi;
	const authToken    = beameSDK.AuthToken;
	const store        = new (beameSDK.BeameStore)();

	return new Promise((resolve, reject) => {
		try {
			let fqdn     = lclFqdn,
				cred     = fqdn && store.getCredential(fqdn),
				token    = cred && authToken.create(fqdn, cred, 10),
				provisionApi = new ProvisionApi();

			//provisionApi.makeGetRequest(`https://${matching}${apiConfig.Actions.Matching.GetRelay.endpoint}`, null, (error, payload) => {
			provisionApi.makeGetRequest(target, null, (error, payload) => {
				if (error) {
					reject(error);
				}
				else {
					if(payload.beame_login_config)
						resolve(payload.beame_login_config.relay);
					else
						resolve(payload.relay);
				}
			}, token);
		} catch (e) {
			reject(e);
		}
	});
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

function notifyRegisteredLoginServers(data, selfFqdn) {
	return new Promise((resolve,reject)=>{
		if(data){
			try{
				console.log(data);
				let savedRegisteredServers = JSON.parse(data);
				const ProvisionApi      = beameSDK.ProvApi,
					BeameAuthServices = require('./authServices'),
					authServices      = new BeameAuthServices(selfFqdn, ""),
					apiConfig   = require('../config/api_config.json');

				let sign         = authServices.signData(selfFqdn),
					provisionApi = new ProvisionApi();
				Promise.all(savedRegisteredServers.map(function (srv) {
					if(srv.fqdn && srv.id){
						let srvPath = 'https://' + srv.fqdn + apiConfig.Actions.Login.RecoverServer.endpoint;
						provisionApi.postRequest(srvPath, selfFqdn, (error) => {
							if (error) {
								reject(error);
							}
							else {
								resolve();
							}
						}, sign, 3);
					}
				})).then(resolve()).catch((e)=>{reject(e)});

			}
			catch(e){
				reject(e);
			}
		}
		else resolve();
	});

}

function setExternalLoginOption(externalLoginUrl, data) {
	return new Promise((resolve, reject) => {
		const enableMe = true;
		if(externalLoginUrl){
			let strData = JSON.stringify(data);
			console.log(`setExternalLoginOption ${strData} for externalLoginUrl: `,externalLoginUrl);

			const ProvisionApi      = beameSDK.ProvApi,
				BeameAuthServices = require('./authServices'),
				authServices      = BeameAuthServices.getInstance(),
				apiConfig   = require('../config/api_config.json');

			let sign         = authServices.signData(data),
				provisionApi = new ProvisionApi();


			let loginReg = externalLoginUrl + apiConfig.Actions.Login.RegisterServer.endpoint;
			if(enableMe)
				provisionApi.postRequest(loginReg, data, (error) => {
					if (error) {
						reject(error);
					}
					else {
						resolve(externalLoginUrl);
					}
				}, sign);
			else resolve(externalLoginUrl);
		}
		else
			resolve(null);
	});
}

module.exports = {
	setExpressApp,
	setExpressAppCommonRoutes,
	createAuthTokenByFqdn,
	getRelayFqdn,
	getLocalRelayFqdn,
	setExternalLoginOption,
	notifyRegisteredLoginServers
};
