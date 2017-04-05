"use strict";

const path        = require('path');
const querystring = require('querystring');
const url         = require('url');

const express    = require('express');
const bodyParser = require('body-parser');

const Bootstrapper         = require('../../bootstrapper');
const bootstrapper         = Bootstrapper.getInstance();
const Constants            = require('../../../constants');
const cookieNames          = Constants.CookieNames;
const beameSDK             = require('beame-sdk');
const CommonUtils          = beameSDK.CommonUtils;
const module_name          = "GwUnauthenticatedApp";
const BeameLogger          = beameSDK.Logger;
const logger               = new BeameLogger(module_name);
const BeameStore           = new beameSDK.BeameStore();
const AuthToken            = beameSDK.AuthToken;
const BeameAuthServices    = require('../../authServices');
const public_dir           = path.join(__dirname, '..', '..', '..', Constants.WebRootFolder);
const base_path            = path.join(public_dir, 'pages', 'gw', 'unauthenticated');
const apiConfig            = require('../../../config/api_config.json');
const relayManagerInstance = require('../../relayManager').getInstance();
const utils                = require('../../utils');
const cust_auth_app        = require('../../routers/customer_auth');

const unauthenticatedApp = express();

const clearSessionCookie = res => {
	utils.clearSessionCookie(res);
};

const loadLoginPage = (res) => {
	setBeameCookie(cookieNames.Logout, res);
	setBeameCookie(cookieNames.Logout2Login, res);
	setBeameCookie(cookieNames.Service, res);
	clearSessionCookie(res);
	res.sendFile(path.join(base_path, 'login.html'));
};

const setBeameCookie = (type, res) => {
	switch (type) {
		case cookieNames.Service:
			res.cookie(cookieNames.Service, CommonUtils.stringify(bootstrapper.appData));
			break;
		case cookieNames.Logout:
			res.cookie(cookieNames.Logout, Bootstrapper.getLogoutUrl());
			break;
		case cookieNames.Logout2Login:
			res.cookie(cookieNames.Logout2Login, Bootstrapper.getLogout2LoginUrl());
			break;
	}

};

unauthenticatedApp.use('/beame-gw', express.static(public_dir));

unauthenticatedApp.get(Constants.SigninPath, (req, res) => {
	setBeameCookie(cookieNames.Logout, res);
	setBeameCookie(cookieNames.Logout2Login, res);
	setBeameCookie(cookieNames.Service, res);
	clearSessionCookie(res);
	res.sendFile(path.join(base_path, 'signin.html'));
});

unauthenticatedApp.get(Constants.XprsSigninPath, (req, res) => {
	setBeameCookie(cookieNames.Logout, res);
	setBeameCookie(cookieNames.Logout2Login, res);
	setBeameCookie(cookieNames.Service, res);
	clearSessionCookie(res);
	res.sendFile(path.join(base_path, 'xprs_signin.html'));
});

unauthenticatedApp.get(Constants.DCLSOfflinePath, (req, res) => {
	setBeameCookie(cookieNames.Service, res);
	clearSessionCookie(res);
	res.sendFile(path.join(base_path, 'offline.html'));
});

unauthenticatedApp.get(Constants.LoginPath, (req, res) => {
	loadLoginPage(res);
});

unauthenticatedApp.get('/', (req, res) => {

	let isCentralLogin = bootstrapper.isCentralLogin;

	if (isCentralLogin) {
		loadLoginPage(res);
		return;
	}

	setBeameCookie(cookieNames.Service, res);
	res.sendFile(path.join(base_path, 'welcome.html'));
});

utils.setExpressAppCommonRoutes(unauthenticatedApp);

unauthenticatedApp.use(bodyParser.json());

unauthenticatedApp.use(bodyParser.urlencoded({extended: false}));

unauthenticatedApp.post(apiConfig.Actions.Login.RecoverServer.endpoint, (req, res) => {
	let data = req.body;

	AuthToken.getRequestAuthToken(req)
		.then(token => {
			res.status(200).send();
			let loginMasterFqdn = token.signedBy;
			const loginServices = require('../../centralLoginServices').getInstance();

			if (bootstrapper.externalLoginUrl) {
				if (bootstrapper.externalLoginUrl.indexOf(loginMasterFqdn) >= 0) {

					if (data) {
						if (data.action == Constants.DelegatedLoginNotificationAction.Register) {
							loginServices.sendACKToDelegatedCentralLogin(Constants.DelegatedLoginNotificationAction.Register);
						}
						else {
							bootstrapper.isDelegatedCentralLoginVerified = false;
						}
					}
				}
			}
			else {
				loginServices.sendACKToDelegatedCentralLogin(Constants.DelegatedLoginNotificationAction.UnRegister);
			}


		}).catch(e => {
		res.status(401).send();
		logger.error(e);
	});
});

unauthenticatedApp.post(apiConfig.Actions.Login.RegisterServer.endpoint, (req, res) => {

	AuthToken.getRequestAuthToken(req).then(() => {
		let data = req.body;

		if (data && data.id && data.fqdn) {

			const loginServices = require('../../centralLoginServices').getInstance();

			const _onLoginValidated = () => {

				res.status(200).send();

				let isOnline;

				switch (data.action) {
					case Constants.DelegatedLoginNotificationAction.Register:
						isOnline = true;
						break;

					case Constants.DelegatedLoginNotificationAction.UnRegister:
						isOnline = false;
						break;
				}

				loginServices.updateGkLoginState(data.fqdn, data.id, isOnline);

			};

			const _onLoginValidationFailed = (error) => {
				logger.warn(error);
				res.status(401).send();
			};

			loginServices.isFqdnRegistered(data.fqdn)
				.then(_onLoginValidated)
				.catch(_onLoginValidationFailed);
		}
		else {
			logger.info(`Invalid data on server registration : ${CommonUtils.stringify(data)}`);
			res.status(400).send();
		}

	}).catch(e => {
		res.status(401).send();
		logger.error(e);
	});
});

unauthenticatedApp.post('/customer-auth-done', (req, res) => {
	const beameAuthServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer);
	logger.debug('beameAuthServerFqdn', beameAuthServerFqdn);
	const gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
	let gwServerCredentials;

	function assertGoodSignedBy(customerAuthServersFqdns) {
		return new Promise((resolve, reject) => {
			if (customerAuthServersFqdns.indexOf(req.body.encryptedUserData.signedBy) != -1) {
				resolve();
			} else {
				reject(`Signed by unauthorized fqdn: ${req.body.encryptedUserData.signedBy}. Should be one of ${customerAuthServersFqdns.join(',')}`);
			}
		});
	}

	function getGwServerCredentials() {
		return new Promise((resolve, reject) => {
			BeameStore.find(gwServerFqdn, false).then(gwServerCredentials_ => {
				resolve(gwServerCredentials_);
				gwServerCredentials = gwServerCredentials_;
			}).catch(() => {
				reject(`Failed getting decrypting credential ${gwServerFqdn}`);
			});
		});
	}

	function decrypt(decryptingCred) {
		return new Promise((resolve, reject) => {
			let payload = decryptingCred.decrypt(req.body.encryptedUserData);
			if (!payload) {
				reject('unauthenticatedApp/customer-auth-done/decrypt() failed');
			}
			console.log('TRACE: Decrypted payload', payload);
			resolve(payload);
		});
	}

	function parseJson(json) {
		return new Promise((resolve, reject) => {
			try {
				resolve(JSON.parse(json));
			} catch (e) {
				reject(`Failed to parse JSON: ${e}`);
			}
		});
	}

	function getEncryptToCred(decryptedData) {
		return new Promise((resolve, reject) => {
			BeameStore.find(beameAuthServerFqdn, false).then(encryptToCred => {
				resolve([decryptedData, encryptToCred]);
			}).catch(() => {
				reject(`Failed getting encrypt-to credential ${beameAuthServerFqdn}`);
			});
		});
	}

	function replyWithUrl([decryptedData, encryptToCred]) {
		// console.log('replyWithUrl decryptedData', decryptedData);
		let registrationTtl = bootstrapper.registrationAuthTokenTtl,
		    proxyInitTtl    = bootstrapper.proxyInitiatingTtl;

		const tokenWithUserData  = AuthToken.create(decryptedData.signedData.data, gwServerCredentials, registrationTtl);
		const encryptedData      = JSON.stringify(encryptToCred.encrypt(beameAuthServerFqdn, tokenWithUserData, gwServerFqdn));
		const proxyEnablingToken = AuthToken.create(JSON.stringify('Does not matter'), gwServerCredentials, proxyInitTtl);

		let url = `https://${gwServerFqdn}/customer-auth-done-2?data=${encodeURIComponent(encryptedData)}&proxy_enable=${encodeURIComponent(proxyEnablingToken)}`;

		const method = bootstrapper.registrationMethod;

		switch (method) {
			case Constants.RegistrationMethod.Email:
			case Constants.RegistrationMethod.SMS:

				try {
					let pin = JSON.parse((JSON.parse(tokenWithUserData).signedData.data)).pin;
					url += `&pin=${pin}`;
				} catch (e) {
				}

				break;
			default:
				break;
		}

		console.log('replyWithUrl() URL', url);

		res.json({url});
	}

	// TODO: get signing token, validate signature, decrypt user data, encrypt user data for auth server, send URL to GW server for proxying to beame authorization server

	Bootstrapper.listCustomerAuthServers()
		.then(assertGoodSignedBy)
		.then(getGwServerCredentials)
		.then(decrypt)
		.then(parseJson)
		.then(AuthToken.validate)
		.then(getEncryptToCred)
		.then(replyWithUrl)
		.catch((e) => {
			console.error('/customer-auth-done error', e);
		});
});

unauthenticatedApp.get('/customer-auth-done-2', (req, res) => {
	// XXX: validate proxy_enable
	const gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
	const qs           = querystring.parse(url.parse(req.url).query);
	console.log('QS', qs);
	const beameAuthServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer);
	let proxyingDestination   = null;
	const method              = bootstrapper.registrationMethod;

	const _redirectToBeameAuth = (addQs) => {

		utils.createAuthTokenByFqdn(gwServerFqdn, JSON.stringify({url: proxyingDestination}), bootstrapper.proxySessionTtl).then(token => {
			console.log('token', token);
			res.cookie(cookieNames.Proxy, token);
			res.append('X-Beame-Debug', 'Redirecting to GW for proxing to BeameAuthorizationServer');
			res.redirect(`https://${gwServerFqdn}/?data=${encodeURIComponent(qs.data)}${addQs}`);
		});
	};

	switch (method) {
		case Constants.RegistrationMethod.Pairing:
			proxyingDestination = bootstrapper.useBeameAuthOnLocal ? `http://127.0.0.1:${Constants.BeameAuthServerLocalPort}` : `https://${beameAuthServerFqdn}`;
			_redirectToBeameAuth('');
			return;
		case Constants.RegistrationMethod.Email:
		case Constants.RegistrationMethod.SMS:

			if (BeameAuthServices.isCustomerApproveRequired()) {
				proxyingDestination = bootstrapper.useBeameAuthOnLocal ? `http://127.0.0.1:${Constants.BeameAuthServerLocalPort}/customer-approve` : `https://${beameAuthServerFqdn}/customer-approve`;
				_redirectToBeameAuth(`&pin=${qs.pin}`);
			}
			else {
				res.redirect(`https://${gwServerFqdn}${Constants.RegisterSuccessPath}?method=${method}`);
			}

			return;
		default:
			return;
	}

});

unauthenticatedApp.get(Constants.AppSwitchPath, (req, res) => {
	// XXX: validate proxy_enable (make sure it's allowed to sign)
	const gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
	const qs           = querystring.parse(url.parse(req.url).query);
	console.log('QS', qs);


	function respond(token) {
		// XXX: why twice?
		const switchAppInfo = JSON.parse(JSON.parse(token.signedData.data));
		console.log('switch app - info', switchAppInfo);
		const switchAppInfoJSON = JSON.stringify(switchAppInfo);
		return new Promise(() => {
			utils.createAuthTokenByFqdn(gwServerFqdn, switchAppInfoJSON, bootstrapper.proxySessionTtl).then(token => {
				// console.log('/beame-gw/choose-app (AppSwitchPath) token', token);
				res.cookie(cookieNames.Proxy, token);
				res.append('X-Beame-Debug', 'Redirecting to GW for proxing after choosing an application on mobile');
				res.append('X-Beame-Debug-App-Info', switchAppInfoJSON);
				res.redirect(`https://${gwServerFqdn}`);
			});
		});
	}

	AuthToken.validate(qs.proxy_enable)
		.then(respond)
		.catch(e => {
			console.log('switch app error', e);
		});
});

unauthenticatedApp.get(Constants.GwAuthenticatedPath, (req, res) => {
	// XXX: validate proxy_enable (make sure it's allowed to sign)
	const gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
	const qs           = querystring.parse(url.parse(req.url).query);
	console.log('QS', qs);


	function respond(token) {
		// XXX: why twice?
		const switchAppInfo = JSON.parse(JSON.parse(token.signedData.data));
		console.log('switch app - info', switchAppInfo);
		const switchAppInfoJSON = JSON.stringify(switchAppInfo);
		return new Promise(() => {
			utils.createAuthTokenByFqdn(gwServerFqdn, switchAppInfoJSON, bootstrapper.proxySessionTtl).then(token => {
				res.cookie(cookieNames.Proxy, token);
				res.append('X-Beame-Debug', 'Redirecting to GW logged-in page after login');
				res.redirect(`https://${gwServerFqdn}${Constants.GwAuthenticatedPath}`);
			});
		});
	}

	AuthToken.validate(qs.proxy_enable)
		.then(respond)
		.catch(e => {
			console.log('switch app error', e);
		});
});

// XXX: When logging out destroy
// (1) SocketIO session
// (2) mark proxy enabling token as inactive in case browser does not delete it or it's stolen
unauthenticatedApp.get(Constants.LogoutPath, (req, res) => {
	console.log('unauthenticatedApp/get/logout: Logging out');
	const gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
	clearSessionCookie(res);
	res.append('X-Beame-Debug', 'Redirecting to GW after logging out');
	res.redirect(`https://${gwServerFqdn}${Constants.SigninPath}`);

});

unauthenticatedApp.get(Constants.LogoutToLoginPath, (req, res) => {
	console.log('unauthenticatedApp/get/login-reinit: Logging out');
	//const gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
	clearSessionCookie(res);
	//res.append('X-Beame-Debug', 'Redirecting to GW login after logging out');
	//res.redirect(`https://${gwServerFqdn}${Constants.LoginPath}`);
	res.sendFile(path.join(base_path, 'logged-out.html'));

});

unauthenticatedApp.get(Constants.ConfigData, (req, res) => {
	console.log('unauthenticatedApp/get/config-data');
	// const apiConfig    = require('../../../config/api_config.json');
	const matching = Bootstrapper.getCredFqdn(Constants.CredentialType.MatchingServer);

	relayManagerInstance.getLocalRelayFqdn().then((relay) => {
		res.send(JSON.stringify({'beame_login_config': {relay: (relay || 'none'), matching: matching}}));
	}).catch((e) => {
		res.send(JSON.stringify({'beame_login_config': {error: e}}));
	});

});


unauthenticatedApp.use(cust_auth_app);

module.exports = unauthenticatedApp;
