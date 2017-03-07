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
var serviceManager      = null;


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
					resolve(user);
				}).catch(error => {
					logger.error(`loginUser on ${token.signedBy} error ${BeameLogger.formatError(error)}`);
					reject(error);
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
				logger.debug('messageHandlers/auth/respond token', token);
				reply({
					type:    'authenticated',
					payload: {
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
								decryptedUserData = decryptedData.toString();
								resolve(token);
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

		AuthToken.validate(payload.token)
			.then(decryptUserData.bind(null, payload.userData))
			.then(loginUser)
			.then(serviceManager.listApplications.bind(serviceManager))
			.then(createSessionToken)
			.then(respond)
			.catch(e => {
				logger.error(`auth error ${e.message}`);
				console.log(e.message);
				reply({
					type:    'authenticated',
					payload: {
						success: false,
						error:   e.message
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

		function makeProxyEnablingToken(session_token) {
			// console.log('choose incoming session_token', session_token);
			let st = JSON.parse(JSON.parse(session_token.signedData.data));
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

				let app = serviceManager.getAppById(payload.app_id);

				reply({
					type:    'redirect',
					payload: {
						success: true,
						app_id:  payload.app_id,
						url:     url,
						external: app ? app.isRasp : false
					}
				});
			});
		}

		assertSignedByGw(payload.session_token)
			.then(AuthToken.validate)
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

		function makeLogoutToken() {
			return utils.createAuthTokenByFqdn(
				gwServerFqdn,
				JSON.stringify('Does not matter'),
				60
			);
		}

		function respond(token) {
			return new Promise(() => {
				console.log('*************** Logout with data:', payload);
				let url = `https://${gwServerFqdn}/beame-gw/logout?token=${encodeURIComponent(token)}`;
				let type = 'redirect';
				if(bootstrapper.externalLoginUrl){
					url = bootstrapper.externalLoginUrl;
					type = 'redirectTopWindow';
				}
				else if(payload.logout2login){//} && (payload.logout2login.indexOf('https') >= 0)){
					url = `https://${gwServerFqdn}/beame-gw/login-reinit?token=${encodeURIComponent(token)}`;
					//url = `${payload.logout2login}?usrData=${encodeURIComponent(token)}`;
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
			.then(AuthToken.validate)
			.then(makeLogoutToken)
			.then(respond);
	},
	'updateProfile': function (payload, reply) {

		function updateUserProfile() {
			return new Promise((resolve, reject) => {
					/** @type {User}*/
					let user = {
						fqdn:     payload.payload.fqdn,
						name:     payload.payload.name,
						nickname: payload.payload.nickname
					};

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
			.then(AuthToken.validate)
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
						path:  `${Constants.GatewayControllerPath}/socket.io`,
						force: true,
						destroyUpgradeTimeout: 10*1000
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

		function reply(data) {
			client.emit('data', JSON.stringify(data));
		}

		client.on('browser_connected', function (data) {
			var cred     = store.getCredential(gwServerFqdn),
			    token    = AuthToken.create(data, cred, 10),
			    tokenStr = CommonUtils.stringify({
				    "data":      data,
				    'signature': token
			    });
			client.emit('virtHostRecovery', tokenStr);
		});


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
				let expectedMessages = ['userImage','loggedOut','beamePing','restart_pairing','approval_request'];
				if(expectedMessages.indexOf(data.type)<0)
					return sendError(client, `Don't know how to handle message of type ${data.type}`);
			}
			messageHandlers[data.type](data.payload, reply);
		});
	}
}


module.exports = BrowserControllerSocketioApi;
