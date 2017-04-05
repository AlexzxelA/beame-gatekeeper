/**
 * Created by Alexz on 31/12/2016.
 */

const beameSDK     = require('beame-sdk');
const BeameLogger  = beameSDK.Logger;
const store        = new beameSDK.BeameStore();
const crypto       = require('crypto');
const authToken    = beameSDK.AuthToken;

const Bootstrapper = require('../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();
const Constants    = require('../../constants');

let module_name  = 'PairingUtils';
const logger       = new BeameLogger(module_name);

class PairingUtils {
	constructor(fqdn, inSocket, name) {
		this._fqdn      = fqdn;
		this._socket    = inSocket;
		this._userImage = null;
		module_name += name;
	}

	_setUserImage(data) {
		return new Promise((resolve, reject) => {
			store.find(this._fqdn, false).then(selfCred => {
				this._userImage = selfCred.sign(data.signedData);
				resolve();
			}).catch(function (e) {
				this._userImage = 'none';
				reject(e);
			});
		});
	}

	_extractMobileHost(data) {
		let target       = null,
		    token2mobile = data.token;
		try {
			let token = JSON.parse(data.token);

			if (token.signedData.data.includes('signedData')) {
				target       = JSON.parse(token.signedData.data).signedBy;
				token2mobile = token.signedData.data;
			}
			else
				target = token.signedBy;
		}
		catch (e) {
			console.error(e);
		}
		return {target: target, token: token2mobile};
	}

	setCommonHandlers() {

		this._socket.on('verifyToken', (token) => {
			authToken.validate(token).then(() => {
				let parsed     = JSON.parse(token);
				let targetFqdn = (!(parsed.signedBy === parsed.signedData.data)) ? (parsed.signedData.data + Constants.XprsSigninPath) : 'none';

				let fqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
				fqdn && store.find(fqdn, true).then((cred) => {
					//let newToken    = (bootstrapper.delegatedLoginServers && bootstrapper.delegatedLoginServers.length > 1)? cred && authToken.create(token, cred, 10):token;
					let newToken = cred && authToken.create(token, cred, 10);
					this._socket.emit('tokenVerified', JSON.stringify({
						success: true,
						target:  targetFqdn,
						token:   newToken
					}));
				}).catch(e => {
					this._socket.emit('tokenVerified', JSON.stringify({success: false, error: e}));
				});

			}).catch(e => {
				this._socket.emit('tokenVerified', JSON.stringify({success: false, error: e}));
			});
		});

		this._socket.on('notifyMobile', (data) => {
			const ProvisionApi = beameSDK.ProvApi;
			const provisionApi = new ProvisionApi();
			const onLoginError = () => {
				this._socket.emit('forceRedirect', bootstrapper.externalLoginUrl || Constants.BeameLoginURL);
			};
			try {
				let parsedData   = JSON.parse(data);
				let signinData   = this._extractMobileHost(parsedData),
				    target       = signinData.target,
				    token2mobile = signinData.token;

				if (bootstrapper.externalLoginUrl)
					authToken.validate(parsedData.token).then(() => {
						let parsedToken = JSON.parse(parsedData.token);

						//let embeddedToken = parsedToken.signedData.data.includes('signedBy');//backward compatibility
						if (bootstrapper.externalLoginUrl && bootstrapper.externalLoginUrl.includes(parsedToken.signedBy)) {

							logger.info(`notifyMobile with: ${data}`);
							//TODO: sign qrData in notification to verify on mobile
							provisionApi.postRequest('https://' + target + '/login/pairing',
								JSON.stringify({
									'uid':   parsedData.uid, 'qrData': parsedData.qrData,
									'token': token2mobile
								}),
								(error) => {
									error && console.log('Failed to notify Mobile:', error);
								}, null, 10, {rejectUnauthorized: false});
						}
						else onLoginError();
					}).catch((e) => {
						console.error(e);
						onLoginError();
					});
				else {
					//let target = JSON.parse(parsedData.token).signedBy;
					provisionApi.postRequest('https://' + target + '/login/pairing',
						JSON.stringify({
							'uid':   parsedData.uid, 'qrData': parsedData.qrData,
							'token': token2mobile
						}), (error) => {
							error && console.log('Failed to notify Mobile:', error);
						}, null, 10, {rejectUnauthorized: false});
				}

			}
			catch (e) {
				console.error(e);
				onLoginError();
				//inform browser of failure
			}

		});

		this._socket.on('userImageVerify', (data) => {
			logger.debug('Requested image verification: ', data);
			let self = this;
			store.find(this._fqdn, false).then(selfCred => {
				let parsedData = JSON.parse(data);
				if (selfCred.checkSignature(parsedData)) {
					console.log('User image OK: ', data);
					self._socket.emit('userImageStatus', 'pass')
				}
				else {
					logger.info('Image signature invalid');
					self._socket.emit('userImageStatus', 'fail');
				}
			}).catch(function (e) {
				logger.info('Failed in image verification', e.message);
				self._socket.emit('userImageStatus', 'fail');
			});

		});

		this._socket.on('userImageOK', (data) => {
			let self = this, hash = data.hash;
			delete data.hash;
			this._setUserImage(data).then(() => {
				logger.info('user image verified:', self._userImage.signature);
				self._socket.emit('userImageSign', {
					'data': {
						'imageSign':     self._userImage.signature,
						'imageSignedBy': self._userImage.signedBy
					},
					'type': 'userImageSign'
				});

				if (hash) {
					const BeameAuthServices = require('../authServices');

					BeameAuthServices.onUserDataReceived(hash).then(() => {
						logger.debug(`user data for hash ${hash} updated`);
					}).catch(error => {
						logger.error(`on update user hash ${hash} error ${BeameLogger.formatError(error)}`);
					});
				}

			}).catch(function (e) {
				logger.info('Failed in image signing:', e.message);
				self._socket.emit('userImageStatus', 'fail');
			});
		});
	}

}

module.exports = PairingUtils;