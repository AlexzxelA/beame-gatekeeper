/**
 * Created by zenit1 on 14/11/2016.
 */
"use strict";

const path    = require('path');
const request = require('request');
const express = require('express');
const app     = express();

const public_dir =  path.join(__dirname, '..', '..',  'public');

const base_path = path.join(public_dir, 'pages', 'customer_auth');

function authenticate(data) {
	//ADD CUSTOM LOGIC
	return new Promise((resolve, reject) => {
		console.log('data authenticated %j',data);
		resolve();
		// or reject('Authentication failed')
	});
}

app.get('/register',  (req, res) => {
	res.sendFile(path.join(base_path, 'register.html'));
});


app.post('/register/save', (req, res) => {

	let data = req.body; // name, email, user_id, code
	console.log('DATA', data);

	const Bootstrapper = require('../bootstrapper');
	const Constants    = require('../../constants');
	const beameSDK     = require('beame-sdk');
	const BeameStore   = new beameSDK.BeameStore();
	const AuthToken    = beameSDK.AuthToken;

	const encryptTo = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);

	function getSigningFqdn() {
		return new Promise((resolve, reject) => {
			Bootstrapper.listCustomerAuthServers().then(servers => resolve(servers[0])).catch(() => {
				reject('Failed getting signing FQDN');
			});
		});
	}

	function getSigningCred(signingFqdn) {
		return new Promise((resolve, reject) => {
			BeameStore.find(signingFqdn, false).then(signingCred => {
				resolve([signingFqdn, signingCred]);
			}).catch(() => {
				reject(`Failed getting signing credential ${signingFqdn}`);
			});
		});
	}

	function getEncryptToCred([signingFqdn, signingCred]) {
		return new Promise((resolve, reject) => {
			BeameStore.find(encryptTo, false).then(encryptToCred => {
				resolve([signingFqdn, signingCred, encryptToCred]);
			}).catch(() => {
				reject(`Failed getting encrypt-to credential ${encryptTo}`);
			});
		});
	}

	function getRedirectUrl([signingFqdn, signingCred, encryptToCred]) {
		// TODO: move 600 to config
		return new Promise((resolve, reject) => {
			const tokenWithUserData = AuthToken.create(JSON.stringify(data), signingCred, 600);
			const encryptedData = encryptToCred.encrypt(encryptTo, JSON.stringify(tokenWithUserData), signingFqdn);
			console.log('encryptedData', encryptedData);
			// TODO: unhardcode URL and timeout below
			const url = `https://${encryptTo}/customer-auth-done`;
			// const url = `http://127.0.0.1:50000`;
			request.post(
				url,
				{
					json: {encryptedUserData: encryptedData},
					timeout: 10000
				},
				function (error, response, body) {
					if (error) {
						console.log('getRedirectUrl error', error);
						reject(`Failed to get redirect URL: ${error} at ${url}`);
						return;
					}
					if (response.statusCode != 200) {
						console.log('getRedirectUrl error (body)', body);
						reject(`Failed to get redirect URL: ${body} at ${url}`);
						return;
					}
					// console.log('getRedirectUrl response', body);
					resolve(body.url);
				}
			);
		});
	}

	function redirect(url) {
		return new Promise((resolve, reject) => {
			return res.json({
				// "url": `https://${Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer)}`,
				"url": url,
				"responseCode": 0,
				"responseDesc": "Please check your email and continue the registration process"
			});
		});
	}

	function sendError(e) {
		// Not sending specificError for security reasons
		console.log('ERROR', e);
		return res.json({
			"responseCode": 1,
			"responseDesc": e
		});
	}

	authenticate()
		.then(getSigningFqdn)
		.then(getSigningCred)
		.then(getEncryptToCred)
		.then(getRedirectUrl)
		.then(redirect)
		.catch(sendError);

});


module.exports = app;
