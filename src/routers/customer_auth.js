/**
 * Created by zenit1 on 14/11/2016.
 */
"use strict";

const path         = require('path');
const request      = require('request');
const express      = require('express');
const crypto       = require('crypto');
const beameSDK     = require('beame-sdk');
const CommonUtils  = beameSDK.CommonUtils;
const Constants    = require('../../constants');
const cookieNames  = Constants.CookieNames;
const Bootstrapper = require('../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();
const app          = express();
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger('CustomerAuth');
const utils        = require('../utils');
const uuid         = require('uuid');

const public_dir = path.join(__dirname, '..', '..', process.env.BEAME_INSTA_DOC_ROOT);

const base_path = path.join(public_dir, 'pages', 'customer_auth');


app.get(Constants.RegisterPath, (req, res) => {

	utils.clearSessionCookie(res);

	res.cookie(cookieNames.Service, CommonUtils.stringify(bootstrapper.appData));
	utils.writeSettingsCookie(res);


	let isPublicRegistrationEnabled = bootstrapper.publicRegistration;

	if (isPublicRegistrationEnabled) {
		res.cookie(cookieNames.ProvisionSettings, CommonUtils.stringify(Bootstrapper.getProvisionConfig));
		if (bootstrapper.customLoginProvider === Constants.ActiveDirectoryProvierCode) {

			let data = {
				required: true,
				domains:  bootstrapper.activeDirectoryDomains
			};

			res.cookie(cookieNames.AdSettings, CommonUtils.stringify(data));
		}
	}

	res.sendFile(path.join(base_path, isPublicRegistrationEnabled ? 'register.html' : 'forbidden.html'));
});


app.get(Constants.RegisterSuccessPath, (req, res) => {
	res.cookie(cookieNames.Service, CommonUtils.stringify(bootstrapper.appData));
	utils.writeSettingsCookie(res);
	res.sendFile(path.join(base_path, 'register_success.html'));
});


app.post('/register/save', (req, res) => {

	let data = req.body;

	logger.info(`Save registration with ${CommonUtils.data}`);


	const BeameStore        = new beameSDK.BeameStore();
	const AuthToken         = beameSDK.AuthToken;
	//TODO to POST
	const beameAuthServices = require('../authServices').getInstance();

	const encryptTo = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);

	function authenticate(user_data) {

		return new Promise((resolve, reject) => {
			logger.debug('data authenticated', user_data);

			let config_settings = Bootstrapper.getProvisionConfig;

			for (let i = 0; i < config_settings.length; i++) {
				let item = config_settings[i];
				if (item.Required && !user_data[item.FiledName]) {
					reject(`${item.Label} required`);
					return;
				}
			}

			resolve();
		});
	}

	function encryptUserData() {
		return new Promise((resolve, reject) => {


				data                   = utils.clearHashFromEmptyProps(data);
				//for use in email or sms scenario
				data.hash              = uuid.v4();
				data.userImageRequired = bootstrapper.registrationImageRequired;

				if (bootstrapper.encryptUserData) {

					BeameStore.find(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer)).then(cred => {

						let data2encrypt = CommonUtils.stringify(data, false);

						if (data2encrypt.length > 214) {
							reject(`Maximum user data length should be 214. Current length is ${data2encrypt.length}`);
						}
						else {
							data.user_id            = cred.encryptWithRSA(data2encrypt);
							//remove sensitive fields
							let config              = bootstrapper.provisionConfig.Fields,
							    customLoginProvider = bootstrapper.customLoginProvider;

							if (customLoginProvider) {
								let clp = config.filter(x => x.LoginProvider == customLoginProvider);

								for (let i = 0; i < clp.length; i++) {
									let item = clp[i];
									delete  data[item.FiledName];
								}
							}
							resolve();
						}


					}).catch(function (e) {
						let errMsg = `Failed to encrypt user_id ${e.message}`;
						logger.error(errMsg);
						reject(errMsg)
					});
				}
				else {
					resolve();
				}
			}
		);
	}

	function selectRegistrationMethod() {

		return new Promise((resolve, reject) => {
				const method = bootstrapper.registrationMethod;

				switch (method) {
					case Constants.RegistrationMethod.Pairing:
						data.pin = crypto.randomBytes(10).toString('base64');
						resolve();
						return;
					case Constants.RegistrationMethod.Email:
					case Constants.RegistrationMethod.SMS:

						beameAuthServices.sendCustomerInvitation(method, data).then(pincode => {
							data.pin = pincode;
							resolve();
						}).catch(reject);
						return;
					default:
						reject(`Unknown registration method`);
						return;
				}
			}
		);
	}

	function getSigningFqdn() {
		return Promise.resolve(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer));
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
			const tokenWithUserData = AuthToken.create(CommonUtils.stringify(data, false), signingCred, 600);
			const encryptedData     = encryptToCred.encrypt(encryptTo, CommonUtils.stringify(tokenWithUserData, false), signingFqdn);
			console.log('encryptedData', encryptedData);
			// TODO: unhardcode URL and timeout below
			const url = `https://${encryptTo}/customer-auth-done`;
			// const url = `http://127.0.0.1:50000`;
			request.post(
				url,
				{
					json:    {encryptedUserData: encryptedData},
					timeout: 10000
				},
				(error, response, body) => {
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
		return new Promise(() => {
			return res.json({
				"url":          url,
				"responseCode": 0,
				"responseDesc": "Please check your email and continue the registration process"
			});
		});
	}

	function sendError(e) {
		// Not sending specificError for security reasons
		console.error('/register/save error', e);
		return res.json({
			"responseCode": 1,
			"responseDesc": e
		});
	}

	authenticate(data)
		.then(encryptUserData)
		.then(selectRegistrationMethod)
		.then(getSigningFqdn)
		.then(getSigningCred)
		.then(getEncryptToCred)
		.then(getRedirectUrl)
		.then(redirect)
		.catch(sendError);

});


module.exports = app;
