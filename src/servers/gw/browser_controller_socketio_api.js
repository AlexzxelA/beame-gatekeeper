'use strict';

const fs   = require('fs');
const path = require('path');

const socket_io         = require('socket.io');
const Bootstrapper      = require('../../bootstrapper');
const bootstrapper      = Bootstrapper.getInstance();
const Constants         = require('../../../constants');
const beameSDK          = require('beame-sdk');
const CommonUtils       = beameSDK.CommonUtils;
const store             = new beameSDK.BeameStore();
const module_name       = "BrowserControllerSocketAPI";
const BeameLogger       = beameSDK.Logger;
const logger            = new BeameLogger(module_name);
const AuthToken         = beameSDK.AuthToken;
const BeameAuthServices = require('../../authServices');
const utils             = require('../../utils');
const gwServerFqdn      = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
let serviceManager      = null;

//const ssoManager        = require('../../samlSessionManager');


function assertSignedByGw(session_token) {
	let signedBy;
	try {
		signedBy = JSON.parse(session_token).signedBy;
	} catch (e) {
		return Promise.reject(e);
	}
	if (signedBy == gwServerFqdn) {
		return Promise.resolve(session_token);
	} else {
		return Promise.reject(`messageHandlers/choose session_token must be signed by ${gwServerFqdn}, not ${signedBy}`);
	}
}

function validateAuthToken(cdr_event, session_token) {
	return AuthToken.validate(session_token, false, cdr_event)
}

// TODO: Session renewal?
const messageHandlers = {
	'auth':          function (payload, reply) {
		// TODO: validate token and check it belongs to one of the registered users
		// TODO: return apps list + session token
		// --- request ---
		// type: auth
		// payload: token
		// --- response ---
		// type: 'authenticated'
		// payload: {success: true/false, session_token: ..., error: 'some str', apps: [{'App Name': {app_id: ..., online: true/false}}, ...]}
		logger.debug('messageHandlers/auth');

		let authenticatedUserInfo = null, decryptedUserData = null;

		function loginUser(token) {
			return new Promise((resolve, reject) => {
				BeameAuthServices.loginUser(token.signedBy).then(user => {
					logger.info(`user authenticated ${CommonUtils.stringify(user)}`);
					authenticatedUserInfo = user;
					if (!decryptedUserData) {
						user.persistentId = token.signedBy;
						decryptedUserData = JSON.stringify(user);
					}
					resolve(user);
				}).catch(error => {
					logger.error(`loginUser on ${token.signedBy} error ${BeameLogger.formatError(error)}`);
					reject(`error ${BeameLogger.formatError(error)}`);
				});
			});
		}

		function createSessionToken(apps) {
			return new Promise((resolve, reject) => {
				utils.createAuthTokenByFqdn(gwServerFqdn, JSON.stringify({isAdmin: authenticatedUserInfo.isAdmin}), bootstrapper.browserSessionTtl)
					.then(token => resolve([apps, token]))
					.catch(e => reject(e));
			});
		}

		function respond([apps, token]) {
			return new Promise(() => {
				if (payload.SAMLRequest) {
					let userIdData;
					try {
						userIdData = (typeof decryptedUserData === 'object') ? decryptedUserData : JSON.parse(decryptedUserData);
					}
					catch (e) {
						logger.error('Internal app error. User ID not found');
						userIdData = {};
					}
					utils.produceSAMLresponse(userIdData, payload, token, reply);
					// let ssoManagerX = ssoManager.samlManager.getInstance();
					// let ssoConfig = ssoManagerX.getConfig();
					// ssoConfig.user = {
					// 	user:           userIdData.email || userIdData.name,
					// 	emails:         userIdData.email || userIdData.name,//userIdData.email,
					// 	name:           {givenName:undefined, familyName:undefined},
					// 	displayName:    userIdData.nickname,
					// 	id:             userIdData.email || userIdData.name,
					// };
					// ssoConfig.persistentId  = userIdData.persistentId;
					// ssoConfig.SAMLRequest   = payload.SAMLRequest;
					// ssoConfig.RelayState    = payload.RelayState;
					// let ssoSession          = new ssoManager.samlSession(ssoConfig);
					// ssoSession.getSamlHtml((err, html)=>{
					// 	if(html)reply({
					// 		type: 'saml',
					// 		payload: {
					// 			success: true,
					// 			samlHtml: html,
					// 			session_token: token,
					// 			url: null
					// 		}
					// 	});
					// });
				}
				else {
					logger.debug('messageHandlers/auth/respond token', token);
					reply({
						type:    'authenticated',
						payload: {
							serviceName:   bootstrapper.serviceName,
							pairing:       bootstrapper.pairingRequired,
							imageRequired: bootstrapper.registrationImageRequired,
							success:       true,
							session_token: token,
							apps:          apps,
							//html:          page,
							url:           `https://${gwServerFqdn}${Constants.GwAuthenticatedPath}?proxy_enable=${encodeURIComponent(token)}`,
							user:          authenticatedUserInfo,
							userData:      decryptedUserData
						}
					});
				}
			});
		}

		function decryptUserData(userData, token) {
			return new Promise((resolve, reject) => {
					let decrypt = bootstrapper.encryptUserData;

					if (decrypt) {
						const BeameStore = new beameSDK.BeameStore();

						BeameStore.find(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer)).then(cred => {

							let decryptedData = cred.decryptWithRSA(userData);

							if (decryptedData) {
								decryptedData.persistentId = token.signedBy;

								decryptedUserData = decryptedData.toString();

								let loginProvider = bootstrapper.customLoginProvider;

								if (loginProvider) {

									let providerSettings = Constants.CustomLoginProviders.filter(v => v.code === loginProvider);

									if (providerSettings.length === 1) {
										let provider_settings = providerSettings[0],
										    _userData         = CommonUtils.parse(decryptedUserData);

										if (_userData[provider_settings.login_fields.user_name] && _userData[provider_settings.login_fields.pwd]) {
											try {
												const ActiveDirectory = require('activedirectory');
												//registration: domain\username
												let user_name         = _userData[provider_settings.login_fields.user_name],
												      parts           = user_name.replace(/\s/g, '').split("\\"),
												      dn              = parts[0].split('.'),
												      baseDN          = `dc=${dn[0]},dc=${dn[1]}`,
												      user            = `${parts[1]}@${parts[0]}`,
												      ldapUrl         = `ldap://${dn[0]}.${dn[1]}`,
												      pwd             = _userData[provider_settings.login_fields.pwd],
												      config          = {
													      url:    ldapUrl,
													      baseDN: baseDN
												      },
												      ad              = new ActiveDirectory(config);

												ad.authenticate(user, pwd, (err, auth) => {
													if (err) {
														logger.error(`Custom provider ${provider_settings.name} login error ${BeameLogger.formatError(err)}`);
														reject(err);
														return;
													}

													if (auth) {
														console.log('Authenticated!');

														//delete AD fields
														delete _userData[provider_settings.login_fields.user_name];
														delete _userData[provider_settings.login_fields.pwd];

														decryptedUserData = CommonUtils.stringify(_userData);

														resolve(token);
													}
													else {
														logger.error(`Custom provider ${provider_settings.name} login authentication failed`);
														reject(`User authorization failed`);
													}
												});


											} catch (e) {
												logger.error(BeameLogger.formatError(e))
											}
										}
									}

								}
								else {
									resolve(token);
								}

							}
							else {
								reject(`user data decryption failed`);
							}

						}).catch(function (e) {
							let errMsg = `Failed to decrypt user_id ${e.message}`;
							logger.error(errMsg);
							reject(errMsg)
						});
					}
					else {
						resolve(token);
					}

				}
			);
		}

		validateAuthToken({event: Bootstrapper.CDREvents.LoginUser}, payload.token)
			.then(decryptUserData.bind(null, payload.userData))
			.then(loginUser)
			.then(serviceManager.listApplications.bind(serviceManager))
			.then(createSessionToken)
			.then(respond)
			.catch(e => {
				logger.error(`auth error ${e.message || e}`);
				console.log(e.message || e);
				reply({
					type:    'authenticated',
					payload: {
						success: false,
						error:   e.message || e
					}
				});
			});

	},
	'choose':        function (payload, reply) {
		// Choose application - redirect app switching URL on GW, auth token in URL
		// --- request ---
		// type: choose
		// payload: {session_token: ..., app_id: ...}
		// --- response ---
		// type: 'redirect'
		// payload: {success: true/false, app_id: (same as in request), url: ...}

		let app       = serviceManager.getAppById(payload.app_id),
		    cdr_event = {event: Bootstrapper.CDREvents.ChooseApp};

		if (app) {
			cdr_event.app = app.name;
		}

		function makeProxyEnablingToken(auth_token) {
			// console.log('choose incoming session_token', session_token);
			let st = JSON.parse(JSON.parse(auth_token.signedData.data));
			// console.log('PT 10', st);
			return utils.createAuthTokenByFqdn(
				gwServerFqdn,
				JSON.stringify({app_id: payload.app_id, isAdmin: !!st.isAdmin}),
				bootstrapper.proxySessionTtl
			);
		}

		function respond(token) {
			return new Promise(() => {
				const url = `https://${gwServerFqdn}/beame-gw/choose-app?proxy_enable=${encodeURIComponent(token)}`;
				logger.debug(`respond() URL is ${url}`);


				if (payload.app_code && payload.app_code.includes('_saml_')) {
					let userIdData = (typeof payload.sessionUserData === 'object') ? payload.sessionUserData : JSON.parse(payload.sessionUserData);
					utils.produceSAMLresponse(userIdData, payload, null, reply);

					// let ssoManagerX = ssoManager.samlManager.getInstance();
					// let ssoConfig = ssoManagerX.getConfig(payload.app_code);
					// ssoConfig.user = {
					// 	user:           userIdData.email||userIdData.name,
					// 	emails:         userIdData.email||userIdData.name,//userIdData.email,
					// 	name:           {givenName:undefined, familyName:undefined},
					// 	displayName:    userIdData.nickname,
					// 	id:             userIdData.email||userIdData.name
					// };
					// let ssoSession = new ssoManager.samlSession(ssoConfig);
					// ssoSession.getSamlHtml((err, html)=>{
					// 	if(html)reply({
					// 		type: 'saml',
					// 		payload: {
					// 			success: true,
					// 			app_id: payload.app_id,
					// 			samlHtml: html,
					// 			external: app.external,
					// 			mobile:app.mobile,
					// 			url: null
					// 		}
					// 	});
					// });
				}
				else {
					reply({
						type:    'redirect',
						payload: {
							success:  true,
							app_id:   payload.app_id,
							url:      url,
							external: app.external,
							mobile:   app.mobile
						}
					});
				}
			});
		}

		assertSignedByGw(payload.session_token)
			.then(validateAuthToken.bind(null,cdr_event))
			.then(makeProxyEnablingToken)
			.then(respond)
			.catch(e => {
				logger.error(`choose error: ${e}`);
			});

	},
	'logout':        function (payload, reply) {
		// Redirect to cookie removing URL on GW
		// type: logout
		// payload: {session_token: ...}
		// --- response ---
		// type: 'redirect'
		// payload: {success: true/false, logout:true, url: ...}

		let cdr_event = {event: Bootstrapper.CDREvents.Logout};

		function makeLogoutToken() {
			return utils.createAuthTokenByFqdn(
				gwServerFqdn,
				JSON.stringify('Does not matter'),
				60
			);
		}

		function respond(token) {
			return new Promise(() => {
				let url  = `https://${gwServerFqdn}/beame-gw/logout?token=${encodeURIComponent(token)}`;
				let type = 'redirect';
				if (bootstrapper.externalLoginUrl) {
					url  = bootstrapper.externalLoginUrl;
					type = 'redirectTopWindow';
				}
				else { // noinspection JSUnresolvedVariable
					if (payload.logout2login) {//} && (payload.logout2login.indexOf('https') >= 0)){
						url = `https://${gwServerFqdn}/beame-gw/login-reinit?token=${encodeURIComponent(token)}`;
						//url = `${payload.logout2login}?usrData=${encodeURIComponent(token)}`;
					}
				}

				logger.debug('respond() URL', url);
				reply({
					type:    type,
					payload: {
						success: true,
						logout:  true,
						url:     url
					}
				});
			});
		}

		assertSignedByGw(payload.session_token)
			.then(validateAuthToken.bind(null,cdr_event))
			.then(makeLogoutToken)
			.then(respond);
	},
	'updateProfile': function (payload, reply) {

		let user = {
			fqdn:     payload.payload.fqdn,
			name:     payload.payload.name,
			nickname: payload.payload.nickname
		},
		cdr_event = {event: Bootstrapper.CDREvents.UpdateProfile , data:user};

		function updateUserProfile() {
			return new Promise((resolve, reject) => {

					BeameAuthServices.updateUserProfile(user).then(resolve).catch(reject);
				}
			);
		}

		function respond(user) {
			return new Promise(() => {
				reply({
					type:    'updateProfile',
					payload: {
						success: true,
						user
					}
				});
			});
		}

		assertSignedByGw(payload.session_token)
			.then(validateAuthToken.bind(null,cdr_event))
			.then(updateUserProfile)
			.then(respond)
			.catch(e => {
				logger.error(`choose error: ${e}`);
			});
	},
	'beamePing':     function (payload, reply) {
		reply({
			type:    'beamePong',
			payload: {
				id:   payload.id,
				next: payload.id + 1
			}
		});
	}
};

function sendError(client, error) {
	// --- request ---
	// some kind of invalid request
	// --- response ---
	// type: 'error'
	// payload: error message
	client.emit('data', JSON.stringify({type: 'error', payload: error}));
}


class BrowserControllerSocketioApi {
	constructor(fqdn, _serviceManager) {
		this._fqdn     = fqdn;
		serviceManager = _serviceManager;
		/** @type {Socket} */
		this._socket_server = null;
	}

	start(server) {
		return new Promise((resolve, reject) => {
				try {
					this._socket_server = socket_io(server, {
						path:                  `${Constants.GatewayControllerPath}/socket.io`,
						force:                 true,
						destroyUpgradeTimeout: 10 * 1000
					});
					this._socket_server.on('connection', this._onConnection);
					resolve(this._socket_server);
				} catch (e) {
					reject(e);
				}
			}
		);

	}

	stop() {
		if (this._socket_server) {
			this._socket_server.close();
			this._socket_server = null;
		}
	}

	_onConnection(client) {
		// Browser controller will connect here
		logger.debug('[GW] handleSocketIoConnect');
		let sessionUserData = null;

		function reply(data) {
			if (data.type && data.type === 'authenticated' && data.payload && data.payload.userData) {
				sessionUserData = data.payload.userData;
				logger.info(`Session user data set to ${data.payload.userData}`);
			}
			client.emit('data', JSON.stringify(data));
		}

		client.on('reconnect', () => {
			console.log('GW socket reconnected');
		});

		client.on('browser_connected', function (data) {
			let cred     = store.getCredential(gwServerFqdn),
			    token    = AuthToken.create(data, cred, 10),
			    tokenStr = CommonUtils.stringify({
				    "data":      data,
				    'signature': token
			    });
			client.emit('virtHostRecovery', tokenStr);
		});

		const pairingUtils = require('../../pairing/pairing_utils');
		let _pairingUtils  = new pairingUtils(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer),
			client, module_name);
		_pairingUtils.setCommonHandlers();

		client.on('data', data => {
			try {
				data = JSON.parse(data);
				logger.debug('Got data:', data);
			} catch (e) {
				// nothing
			}
			if (!data || !data.type || !data.payload) {
				return sendError(client, 'Data must have "type" and "payload" fields');
			}
			if (!messageHandlers[data.type]) {
				let expectedMessages = ['userImage', 'loggedOut', 'beamePing', 'restart_pairing', 'approval_request'];
				if (expectedMessages.indexOf(data.type) < 0)
					return sendError(client, `Don't know how to handle message of type ${data.type}`);
			}
			if (sessionUserData) data.payload.sessionUserData = sessionUserData;
			messageHandlers[data.type] && messageHandlers[data.type](data.payload || data, reply);
		});
	}
}


module.exports = BrowserControllerSocketioApi;

