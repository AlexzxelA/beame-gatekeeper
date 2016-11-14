/**
 * Created by zenit1 on 07/09/2016.
 */
"use strict";

/**
 * @typedef {Object} RegistrationData
 * @property {String} name
 * @property {String} email
 * @property {Boolean} agree
 * @property {RegistrationSource} src
 */

/**
 * @typedef {Object} EmailRegistrationData
 * @property {String} name
 * @property {String} email
 * @property {String} authToken
 * @property {String} authSrvFqdn
 * @property {Number} src
 */

const apiConfig        = require('../../../config/api_config.json');

const beameSDK         = require('beame-sdk');
const module_name      = "AuthServices";
const BeameLogger      = beameSDK.Logger;
const logger           = new BeameLogger(module_name);
const CommonUtils      = beameSDK.CommonUtils;
const AuthToken        = beameSDK.AuthToken;
const store            = new (beameSDK.BeameStore)();
const provisionApi     = new (beameSDK.ProvApi)();
const beameUtils       = beameSDK.BeameUtils;
const apiEntityActions = apiConfig.Actions.Entity;
var dataService      ;//= new (require('./dataServices'))();


class AuthServices {

	/**
	 *
	 * @param authServerFqdn
	 * @param {Boolean|null} [subscribeForChildCerts]
	 */
	constructor(authServerFqdn, subscribeForChildCerts) {
		this._fqdn  = authServerFqdn;
		this._creds = store.getCredential(authServerFqdn);
		if (!this._creds) {
			logger.fatal(`Server credential not found`);
		}

		let subscribe = subscribeForChildCerts || false;

		if (subscribe) {
			this._creds.subscribeForChildRegistration(this._fqdn);
		}
	}


	//region Entity registration
	/**
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	saveRegistration(data) {

		return new Promise((resolve, reject) => {
				dataService.saveRegistration(data).then(registrationId => {

					let dataToSign = {
						    email: data.email,
						    name:  data.name,
						    rand:  CommonUtils.randomBytes()
					    },
					    authToken  = this._signData(dataToSign);

					function updateHash() {
						dataService.updateRegistrationHash(registrationId, authToken).then(()=> {
							resolve(authToken);
						});
					}


					updateHash();



				}).catch(error=> {
					console.log('FUCK! (1):', error.toString());
					logger.error(BeameLogger.formatError(error));
					reject(error);
				});
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
			this._registerFqdn(apiEntityActions.Register.endpoint, metadata).then(payload => {
				//dataService.updateRegistrationFqdn(hash, payload.fqdn);
				payload.parent_fqdn = this._fqdn;
				logger.debug(`authorizeEntity() resolving`, payload);
				resolve(payload);
			}).catch(reject);
				// let hash = authToken.signedData.data;
				//
				// dataService.findRegistrationRecordByHash(hash).then(record=> {
				// 	if (record) {
				// 		if (record.completed) {
				// 			reject('Registration already completed');
				// 			return;
				// 		}
				//
				// 		metadata.name  = record.name;
				// 		metadata.email = record.email;
				// 		metadata.agree = record.agree;
				// 		metadata.src   = record.source;
				// 	}
				// 	else {
				// 		metadata.parent_fqdn = this._fqdn;
				// 		metadata.src         = config.RegistrationSource.Unknown;
				// 	}
				//
				// 	metadata.userAgent = userAgent;
				//
				//
				//
				// }).catch(reject);
			}
		);
	}


	/**
	 *
	 * @param {CertNotificationToken} token
	 */
	static markRegistrationAsCompleted(token) {

		try {
			//mark registration record if exists
			dataService.markRegistrationAsCompleted(token.fqdn);

			//load credentials
			let creds = new beameSDK.Credential(store);
			creds.initFromX509(token.x509, token.metadata);


			logger.info(`credentials ${token.metadata.fqdn} loaded to store from sns notification`)
		}
		catch (error) {
			console.log('FUCK! (2):', error.toString());
			logger.error(BeameLogger.formatError(error));
		}
	}

	/**
	 * @param {SignatureToken} authToken
	 * @returns {Promise}
	 */
	_validateAuthToken(authToken) {
		return new Promise((resolve, reject) => {

				if (!AuthServices._validateCredAuthorizationPermissions(authToken.signedBy)) {
					reject('Unauthorized signature');
					return;
				}

				AuthToken.validate(authToken).then(resolve).catch(reject);

				// this._getAuthTokenCred(authToken.signedBy).then(() => {
				//
				// 	if (AuthToken.validate(authToken)) {
				//
				// 		resolve()
				// 	}
				// 	else {
				// 		reject(`Invalid auth token`);
				// 	}
				// }).catch(reject);
			}
		);
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

				logger.printStandardEvent(module_name, BeameLogger.StandardFlowEvent.Registering, "Edge server");

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
	 *
	 * @param {String} fqdn
	 * @returns {Promise}
	 * @private
	 */
	// _getAuthTokenCred(fqdn) {
	// 	return new Promise((resolve, reject) => {
	// 			var authCred = store.getCredential(fqdn);
	// 			if (authCred) {
	// 				resolve(authCred);
	// 			}
	// 			else {
	// 				store.fetch(fqdn).then(resolve).catch(reject)
	// 			}
	// 		}
	// 	);
	// }

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

module.exports = AuthServices;

