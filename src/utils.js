/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const bodyParser = require('body-parser');
const https      = require('https');
const express    = require('express');
const path       = require('path');

const beameSDK   = require('beame-sdk');
const CommonUtils          = beameSDK.CommonUtils;
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


module.exports = {
	setExpressApp,
	setExpressAppCommonRoutes,
	createAuthTokenByFqdn,
	signDataWithFqdn
};
