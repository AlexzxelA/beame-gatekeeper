/**
 * Created by zenit1 on 11/11/2016.
 */
"use strict";

const async = require('async');

const beameSDK     = require('beame-sdk');
const module_name  = "CredentialManager";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const beameStore   = new beameSDK.BeameStore();
const Credential   = beameSDK.Credential;
const Bootstrapper = require('./bootstrapper');
const defaults     = require('../defaults');
const Constants    = require('../constants');
const CommonUtils  = beameSDK.CommonUtils;

class CredentialManager {

	constructor() {
		this._bootstrapper = Bootstrapper.getInstance();
	}

	/**
	 * @param {EmailRegistrationData|null} [token]
	 * @param {String|null} [fqdn]
	 */
	createInitialCredentials(token, fqdn) {

		const _onRegistrationError = error => {
			logger.error(BeameLogger.formatError(error));
			process.exit(1);
		};

		return new Promise((resolve) => {

				const _onZeroLevelCreated = metadata => {
					this._bootstrapper.updateCredsFqdn(metadata.fqdn, Constants.CredentialType.ZeroLevel)
						.then(this.createServersCredentials.bind(this, metadata.email))
						.then(() => {

							this._bootstrapper.registerCustomerAuthServer(Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer)).then(() => {
								resolve(metadata);
							}).catch(error => {
								logger.error(BeameLogger.formatError(error));
								resolve(metadata);
							});
						})
						.catch(_onRegistrationError)
				};

				if (token) {
					CredentialManager._createZeroLevelCredential(token)
						.then(metadata => {

							logger.info(`Zero level credential created successfully on ${metadata.fqdn}`);

							_onZeroLevelCreated(metadata);

						})
						.catch(_onRegistrationError);
				}
				else {
					beameStore.find(fqdn, false)
						.then(cred => {
							if (!cred.hasKey('PRIVATE_KEY')) {
								_onRegistrationError(`FQDN ${fqdn} has not Private key and can't be used`);
								return;
							}

							_onZeroLevelCreated(cred.metadata);
						})
						.catch(_onRegistrationError)
				}
			}
		);
	}


	createServersCredentials(email) {
		return new Promise((resolve, reject) => {
				let zeroLevelFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.ZeroLevel);

				if (!zeroLevelFqdn) {
					reject(`Zero level fqdn not found`);
					return;
				}

				let servers = Bootstrapper.getServersToCreate();

				if (CommonUtils.isObjectEmpty(servers)) {
					logger.info(`All servers credentials exists`);
					resolve();
					return;
				}



				async.each(Object.keys(servers), (serverType, callback) => {

					const _updateServerFqdn = (fqdn, type, cb) => {
						this._bootstrapper.updateCredsFqdn(fqdn, type).then(() => {
							cb();
						}).catch(error => {
							logger.error(BeameLogger.formatError(error));
							cb(error);
						});
					};

					if (serverType == Constants.CredentialType.BeameAuthorizationServer && defaults.RunAuthServerOnZeroLevelCred) {
						_updateServerFqdn(zeroLevelFqdn, Constants.CredentialType.BeameAuthorizationServer,callback);
					}
					else {
						logger.info(`Creating credentials for ${serverType} ${email}`);

						CredentialManager._createLocalCredential(zeroLevelFqdn, `${serverType}`, email).then(metadata => {

							logger.info(`Credential ${serverType} created on ${metadata.fqdn}`);

							_updateServerFqdn(metadata.fqdn, serverType,callback);

							// this._bootstrapper.updateCredsFqdn(metadata.fqdn, serverType).then(() => {
							// 	callback();
							// }).catch(error => {
							// 	logger.error(BeameLogger.formatError(error));
							// 	callback(error);
							// });

						}).catch(error => {
							logger.error(BeameLogger.formatError(error));
							callback(error);
						});
					}


				}, (err) => {
					if (err) {

						reject(err);
					} else {
						logger.info('All servers credentials have been processed successfully');
						resolve();
					}
				});

			}
		);
	}

	/**
	 *
	 * @param {String} parent_fqdn
	 * @param {String} name
	 * @param {String} email
	 * @returns {Promise.<Object>}
	 * @private
	 */
	static _createLocalCredential(parent_fqdn, name, email) {

		return new Promise((resolve, reject) => {

				let cred = new Credential(beameStore, 20);
				cred.createEntityWithLocalCreds(parent_fqdn, name, email).then(resolve).catch(reject);
			}
		);

	}


	/**
	 *
	 * @param token
	 * @returns {Promise.<Object>}
	 * @private
	 */
	static _createZeroLevelCredential(token) {

		let cred = new Credential(beameStore);

		return cred.createEntityWithRegistrationToken(token);

	}
}


module.exports = CredentialManager;