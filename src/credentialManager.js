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

class CredentialManager {

	constructor() {
		this._bootstrapper = Bootstrapper.getInstance();
	}

	/**
	 * @param {EmailRegistrationData} token
	 */
	createInitialCredentials(token) {

		const _onRegistrationError = error=> {
			logger.error(error);
			process.exit(1);
		};

		return new Promise((resolve) => {
				CredentialManager._createZeroLevelCredential(token).then(metadata => {

					logger.info(`Zero level credential created successfully on ${metadata.fqdn}`);

					this._bootstrapper.updateCredsFqdn(metadata.fqdn, Constants.CredentialType.ZeroLevel).then(this.createServersCredentials.bind(this)).then(()=> {

						this._bootstrapper.registerCustomerAuthServer(Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer)).then(()=> {
							resolve(metadata);
						}).catch(error => {
							logger.error(BeameLogger.formatError(error));
							resolve(metadata);
						});
					}).catch(_onRegistrationError)

				}).catch(_onRegistrationError);
			}
		);
	}


	createServersCredentials() {
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

					//let t = CommonUtils.randomTimeout(20);

					//logger.debug(`${serverType} timeout = ${t}`);

					setTimeout(()=> {
						logger.info(`Creating credentials for ${serverType}`);

						CredentialManager._createLocalCredential(zeroLevelFqdn, `${serverType}`, null).then(metadata=> {

							logger.info(`Credential ${serverType} created on ${metadata.fqdn}`);

							this._bootstrapper.updateCredsFqdn(metadata.fqdn, serverType).then(()=> {
								callback();
							}).catch(error => {
								logger.error(BeameLogger.formatError(error));
								callback(error);
							});

						}).catch(error => {
							logger.error(BeameLogger.formatError(error));
							callback(error);
						});
					}, 0);


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

				let cred = new Credential(BeameStore, 20);
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

		let cred = new Credential(BeameStore);

		let type = token.type || Constants.RequestType.RequestWithAuthServer;

		switch (type){
			case Constants.RequestType.RequestWithAuthServer:
				return cred.createEntityWithAuthServer(token.authToken, token.authSrvFqdn, token.name, token.email);
			case Constants.RequestType.RequestWithFqdn:
				return cred.createEntityWithAuthToken(token.authToken, token.name, token.email);
			default:
				return Promis.reject(`Unknown request type`);
		}



	}
}


module.exports = CredentialManager;