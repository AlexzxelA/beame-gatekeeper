/**
 * Created by zenit1 on 07/09/2016.
 */
"use strict";

/**
 * @typedef {Object} ProvisionRegistrationToken
 * @property {String} name
 * @property {String} email
 * @property {String} parent_fqdn
 * @property {String} edge_fqdn
 * @property {String} userAgent
 */

/**
 * @typedef {Object} RegistrationData
 * @property {String} name
 * @property {String} email
 * @property {String} user_id
 * @property {String} pin
 * @property {String} fqdn
 */


const apiConfig        = require('../config/api_config.json');
const Constants        = require('../constants');
const beameSDK         = require('beame-sdk');
const module_name      = "BeameAuthServices";
const BeameLogger      = beameSDK.Logger;
const logger           = new BeameLogger(module_name);
const CommonUtils      = beameSDK.CommonUtils;
const AuthToken        = beameSDK.AuthToken;
const store            = new (beameSDK.BeameStore)();
const provisionApi     = new (beameSDK.ProvApi)();
const apiEntityActions = apiConfig.Actions.Entity;
const Bootstrapper = require('./bootstrapper');
const bootstrapper = new Bootstrapper();
const dataService      = new (require('./dataServices'))({session_timeout:bootstrapper.getSessionRecordDeleteTimeout || 1000 * 60 * 2});


class BeameAuthServices {

	/**
	 *
	 * @param authServerFqdn
	 * @param {Boolean|null} [subscribeForChildCerts]
	 */
	constructor(authServerFqdn, subscribeForChildCerts) {
		this._fqdn = authServerFqdn;

		/** @type {Credential} */
		this._creds = store.getCredential(authServerFqdn);

		if (!this._creds) {
			logger.fatal(`Server credential not found`);
		}

		let subscribe = subscribeForChildCerts || true;

		if (subscribe) {
			this._creds.subscribeForChildRegistration(this._fqdn);
		}
	}


	//region Entity registration
	/**
	 * @param {RegistrationData} data
	 * @param {boolean} createAuthToken
	 * @returns {Promise}
	 */
	saveRegistration(data, createAuthToken = false) {

		return new Promise((resolve, reject) => {
				dataService.saveRegistration(data).then(registrationId => {

					if (createAuthToken) {
						let dataToSign = {
							    email: data.email,
							    name:  data.name,
							    rand:  CommonUtils.randomBytes()
						    },
						    authToken  = this._signData(dataToSign);

						const updateHash = ()=> {
							dataService.updateRegistrationHash(registrationId, authToken).then(()=> {
								resolve(authToken);
							});
						};

						updateHash();
					}
					else {
						resolve();
					}


				}).catch(error=> {
					console.log('FUCK! (1):', error.toString());
					logger.error(BeameLogger.formatError(error));
					reject(error);
				});
			}
		);
	}

	/**
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	getRegisterFqdn(data) {
		return new Promise((resolve, reject) => {

				if (!data.email && !data.user_id) {
					reject(`email or userId required for registration`);
					return;
				}

				let metadata = BeameAuthServices._registrationDataToProvisionToken(data, this._fqdn);

				this._registerFqdn(apiEntityActions.Register.endpoint, metadata).then(payload => {
					payload.parent_fqdn = this._fqdn;

					logger.info(`Registration Fqdn received ${payload.fqdn}`);
					logger.debug(`Entity registration completed `, payload);

					data.fqdn = payload.fqdn;

					dataService.saveRegistration(data).then(()=> {
						resolve(payload);
					}).catch(reject);


				}).catch(reject);
			}
		);
	}

	/**
	 * @param {Object} metadata
	 * @param {SignatureToken} authToken
	 * @param {String|null} [userAgent]
	 * @returns {Promise}
	 */
	authorizeEntity(metadata, authToken, userAgent) {
		return new Promise((resolve, reject) => {

				let hash = authToken.signedData.data;

				dataService.findRegistrationRecordByHash(hash).then(record=> {
					if (record) {
						if (record.completed) {
							reject('Registration already completed');
							return;
						}

						metadata.name  = record.name;
						metadata.email = record.email;
						metadata.src   = record.source;
					}
					else {
						metadata.parent_fqdn = this._fqdn;
						metadata.src         = Constants.RegistrationSource.Unknown;
					}

					metadata.userAgent = userAgent;

					this._registerFqdn(apiEntityActions.Register.endpoint, metadata).then(payload => {
						dataService.updateRegistrationFqdn(hash, payload.fqdn);
						payload.parent_fqdn = this._fqdn;
						logger.debug(`authorizeEntity() resolving`, payload);
						resolve(payload);
					}).catch(reject);

				}).catch(reject);
			}
		);
	}

	/**
	 * @param {SignatureToken} authToken
	 * @returns {Promise}
	 */
	_validateAuthToken(authToken) {
		return new Promise((resolve, reject) => {

				if (!BeameAuthServices._validateCredAuthorizationPermissions(authToken.signedBy)) {
					reject('Unauthorized signature');
					return;
				}

				AuthToken.validate(authToken).then(resolve).catch(reject);

			}
		);
	}

	//noinspection JSUnusedGlobalSymbols
	/**
	 * @param {String} pin
	 * @returns {Promise}
	 */
	static deleteSession(pin) {
		return dataService.deleteSession(pin);
	}

	//noinspection JSMethodCanBeStatic
	/**
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	saveSession(data) {
		return dataService.saveSession(data);
	}

	/**
	 *
	 * @param {CertNotificationToken} token
	 */
	static markRegistrationAsCompleted(token) {
		return new Promise((resolve, reject) => {
				try {
					//mark registration record if exists
					dataService.markRegistrationAsCompleted(token.fqdn).then(registration => {

						/** @type  {User} */
						let User = {
							name:           registration.name,
							email:          registration.email,
							externalUserId: registration.externalUserId,
							fqdn:           registration.fqdn
						};

						dataService.saveUser(User).then(()=> {
							//load credentials
							let creds = new beameSDK.Credential(store);
							creds.initFromX509(token.x509, token.metadata);


							logger.info(`credentials ${token.metadata.fqdn} loaded to store from sns notification`)
						}).catch(reject);


					}).catch(reject);


				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					reject(error);
				}
			}
		);

	}

	/**
	 *
	 * @param {RegistrationData} data
	 * @param {String|null} [userAgent]
	 * @param {String|null} [parent_fqdn]
	 * @returns {ProvisionRegistrationToken}
	 * @private
	 */
	static _registrationDataToProvisionToken(data, parent_fqdn, userAgent) {

		return {
			name:        data.name,
			email:       data.email,
			userAgent:   userAgent,
			parent_fqdn: parent_fqdn,
			src:         Constants.RegistrationSource.InstaServerSDK
		};
	}

	//endregion

	//region Registering FQDN vs Provision
	/**
	 *
	 * @param {String} endpoint
	 * @param {Object} metadata
	 * @returns {Promise}
	 * @private
	 */
	_registerFqdn(endpoint, metadata) {
		return new Promise((resolve, reject) => {
				let sign = this._signData(metadata);

				logger.debug(`Authentication request from edge server signed`, sign);

				var apiData = beameSDK.ProvApi.getApiData(endpoint, metadata);

				logger.printStandardEvent(module_name, BeameLogger.StandardFlowEvent.Registering, "New entity");

				provisionApi.runRestfulAPI(apiData, (error, payload) => {
					if (!error) {
						logger.printStandardEvent(module_name, BeameLogger.StandardFlowEvent.Registered, payload["fqdn"]);
						payload["sign"] = this._signData(payload);
						resolve(payload);
					}
					else {
						reject(error);
					}
				}, null, sign);
			}
		);
	}

	//endregion

	//region creds helpers
	static _validateCredAuthorizationPermissions(fqdn) {
		logger.info(`validate signer permissions for ${fqdn}`);
		//TODO add pinning logic here
		return true;
	}

	/**
	 * @param {String} encryptedMessage
	 * @returns {Promise.<RegistrationData>}
	 */
	validateRegistrationToken(encryptedMessage) {
		return new Promise((resolve, reject) => {
				try {

					let token = CommonUtils.parse(encryptedMessage, false);

					if (!token) {
						reject('invalid message');
						return;
					}

					let decryptedData = this._creds.decrypt(token);

					if (!decryptedData) {
						reject(`invalid data`);
						return;
					}

					let authToken = CommonUtils.parse(decryptedData, false);

					if (!authToken) {
						reject('invalid auth token');
						return;
					}

					this._validateAuthToken(authToken).then(() => {

						/** @type {RegistrationData} */
						let registrationData = CommonUtils.parse(authToken.signedData.data);

						if (!registrationData) {
							reject('invalid registration data');
							return;
						}

						if (!registrationData.pin) {
							reject(`pincode required`);
							return;
						}

						resolve(registrationData);

					}).catch(reject);


				} catch (e) {
					reject(e);
				}
			}
		);

	}

	//endregion

	//region signer helpers
	/**
	 *
	 * @param data2Sign
	 * @returns {String}
	 * @private
	 */
	_signData(data2Sign) {
		let sha = CommonUtils.generateDigest(data2Sign);

		return AuthToken.create(sha, this._creds, 60 * 60 * 24 * 2);

	}

	//endregion

	//region user
	static validateUser(fqdn) {

		return new Promise((resolve, reject) => {
				dataService.findUser(fqdn).then(user=> {
					if (user == null) {
						reject(`user ${fqdn} not found`);
					}

					if(!user.isActive){
						reject(`user ${fqdn} is not active`);
						return;
					}

					resolve({
						fqdn:    fqdn,
						name:    user.name,
						email:   user.email,
						user_id: user.externalUserId
					});
				}).catch(reject);
			}
		);


	}

	//endregion

	getRequestAuthToken(req) {
		return new Promise((resolve, reject) => {
				let authHead  = req.get('X-BeameAuthToken'),
				    /** @type {SignatureToken|null} */
				    authToken = null;

				logger.debug(`auth head received ${authHead}`);

				if (authHead) {
					try {
						authToken = JSON.parse(authHead);

						if (!CommonUtils.isObject(authToken)) {
							logger.error(`invalid auth ${authToken} token format`);
							reject({message: 'Auth token invalid json format'});
							return;
						}
					}
					catch (error) {
						console.log('FUCK! (3):', error.toString());
						logger.error(`Parse auth header error ${BeameLogger.formatError(error)}`);
						reject({message: 'Auth token invalid json format'});
						return;
					}
				}

				if (!authToken) {
					reject({message: 'Auth token required'});
					return;
				}

				this._validateAuthToken(authToken).then(() => {
					resolve(authToken)
				}).catch(reject);
			}
		);
	}

}

module.exports = BeameAuthServices;
