/**
 * Created by Alexz on 31/12/2016.
 */

const beameSDK     = require('beame-sdk');
const BeameLogger  = beameSDK.Logger;
const store        = new beameSDK.BeameStore();
const crypto       = require('crypto');
var module_name    = 'PairingUtils';
const logger       = new BeameLogger(module_name);
const Bootstrapper = require('../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();

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


	setCommonHandlers() {
		this._socket.on('notifyMobile', (data) => {
			const ProvisionApi     = beameSDK.ProvApi;
			const provisionApi     = new ProvisionApi();
			let parsed = JSON.parse(data);
			let target = JSON.parse(parsed.token).signedBy;
			logger.info(`notifyMobile with: ${data}`);
			provisionApi.postRequest('https://'+target+'/login/pairing', data, (error) => {
				error && console.log('Failed to notify Mobile:', error);
			},null, 10, {rejectUnauthorized: false});
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