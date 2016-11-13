/**
 * Created by zenit1 on 11/11/2016.
 */
"use strict";

const async = require('async');

const beameSDK     = require('beame-sdk');
const module_name  = "CredentialManager";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const BeameStore   = new beameSDK.BeameStore();
const Credential   = beameSDK.Credential;
const Bootstrapper = require('./bootstrapper');
const Constants    = require('../constants');
const CommonUtils  = beameSDK.CommonUtils;
const AuthToken    = beameSDK.AuthToken;

class CredentialManager {

	constructor() {
		this._bootstrapper = new Bootstrapper();
	}

	/**
	 * @param {EmailRegistrationData} token
	 */
	createInitialCredentials(token) {

		const __onRegistrationError = error=> {
			logger.error(error);
			process.exit(1);
		};

		return new Promise((resolve) => {
				this._createZeroLevelCredential(token).then(metadata => {

					logger.info(`Zero level credential created successfully on ${metadata.fqdn}`);

					this._bootstrapper.updateCredsFqdn(metadata.fqdn, Constants.CredentialType.ZeroLevel).then(this.createServersCredentials.bind(this)).catch(__onRegistrationError)

				}).catch(__onRegistrationError);
			}
		);
	}


	createServersCredentials() {
		return new Promise((resolve, reject) => {
				let zeroLevelFqdn = Bootstrapper.getZeroLevelFqdn();

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

					let t = CommonUtils.randomTimeout(100);

					console.log(`${serverType} timeout = ${t}`);

					setTimeout(()=> {
						logger.info(`Creating credentials for ${serverType}`);

						CredentialManager._createLocalCredential(zeroLevelFqdn, `${serverType} + 47`, null).then(metadata=> {

							logger.info(`Credential ${serverType} created on ${metadata.fqdn}`);

							this._bootstrapper.updateCredsFqdn(metadata.fqdn, serverType).then(()=> {
								callback();
							}).catch(error => {
								logger.error(BeameLogger.formatError(error));
								callback(error);
							})

						}).catch(error => {
							logger.error(BeameLogger.formatError(error));
							callback(error);
						});
					},t);


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

			let cred = new Credential(BeameStore);
				cred.createEntityWithLocalCreds(parent_fqdn, name, email).then(resolve).catch(reject);
			}
		);

		// return new Promise((resolve, reject) => {
		//
		// 		BeameStore.find(parent_fqdn, false).then(cred=> {
		// 			let authToken = AuthToken.create({name, email}, cred, 10);
		// 			cred.createEntityWithAuthServer(authToken, null, name, email).then(resolve).catch(reject);
		// 			//cred.createEntityWithLocalCreds(parent_fqdn, name, email).then(resolve).catch(reject);
		// 		}).catch(reject);
		//
		// 	}
		// );

	}


	/**
	 *
	 * @param token
	 * @returns {Promise.<Object>}
	 * @private
	 */
	_createZeroLevelCredential(token) {

		let cred = new Credential(BeameStore);

		return cred.createEntityWithAuthServer(token.authToken, token.authSrvFqdn, token.name, token.email);

	}
}


module.exports = CredentialManager;