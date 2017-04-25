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
 * @property {String} [name]
 * @property {String} [nickname]
 * @property {String} [email]
 * @property {String} [user_id]
 * @property {String} [pin]
 * @property {String} [fqdn]
 * @property {String} [hash]
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
const ProvisionApi     = beameSDK.ProvApi;
const apiEntityActions = apiConfig.Actions.Entity;
const Bootstrapper     = require('./bootstrapper');
const bootstrapper     = Bootstrapper.getInstance();
const utils            = require('./utils');
let dataService        = null;
let beameAuthServices  = null;
const nop              = function () {
};

const UniversalLinkUrl = Constants.UniversalLinkUrl;

class BeameAuthServices {

	/**
	 *
	 * @param authServerFqdn
	 * @param matchingServerFqdn
	 * @param {Boolean|null} [subscribeForChildCerts]
	 */
	constructor(authServerFqdn, matchingServerFqdn, subscribeForChildCerts) {
		this._fqdn = authServerFqdn;

		this._matchingServerFqdn = matchingServerFqdn;

		/** @type {Credential} */
		this._creds = store.getCredential(authServerFqdn);

		this._downloadTokens = {};

		if (!this._creds) {
			logger.fatal(`Beame Auth Server credential not found`);
		}

		dataService = require('./dataServices').getInstance();

		let subscribe = subscribeForChildCerts || true;

		if (subscribe) {
			this._creds.subscribeForChildRegistration(this._fqdn).then(nop).catch(error => {
				logger.error(`Auth server subscription error  ${BeameLogger.formatError(error)}`);
			});
		}

		if (!beameAuthServices) beameAuthServices = this;
	}

	get downloadTokens() {
		return this._downloadTokens;
	}

	//region Entity registration
	/**
	 * @param {RegistrationData} data
	 * @param {boolean} createAuthToken
	 * @returns {Promise}
	 */
	saveRegistration(data, createAuthToken = false) {

		return new Promise((resolve, reject) => {
				dataService.saveRegistration(data).then(registration => {

					if (createAuthToken) {
						let dataToSign = {
							    email: data.email,
							    name:  data.name,
							    rand:  CommonUtils.randomBytes()
						    },
						    authToken  = this.signData(dataToSign);

						const updateHash = () => {
							dataService.updateRegistrationHash(registration.id, authToken).then(() => {
								resolve(authToken);
							});
						};

						updateHash();
					}
					else {
						resolve();
					}


				}).catch(error => {
					logger.error(`Save registration error ${BeameLogger.formatError(error)}`);
					reject(error);
				});
			}
		);
	}

	/**
	 * @param {RegistrationData} data
	 * @param {Boolean} saveRegistration => false in recovery flow
	 * @returns {Promise}
	 */
	getRegisterFqdn(data, saveRegistration = true) {
		return new Promise((resolve, reject) => {

				if (!data.email && !data.user_id) {
					reject(`email or userId required for registration`);
					return;
				}

				dataService.isRegistrationExists(data).then(registration => {
					if (registration) {
						reject(`Record for email ${data.email}, name ${data.name}, userId ${data.user_id} already registered`);
						return;
					}

					let metadata = BeameAuthServices._registrationDataToProvisionToken(data, this._fqdn);

					this._registerFqdn(apiEntityActions.Register.endpoint, metadata).then(payload => {
						payload.parent_fqdn = this._fqdn;

						if (saveRegistration) {
							logger.info(`Registration Fqdn received ${payload.fqdn}`);
							logger.debug(`Entity registration completed `, payload);

							data.fqdn = payload.fqdn;

							dataService.saveRegistration(data).then(() => {
								resolve(payload);
							}).catch(reject);
						}
						else {
							resolve(payload);
						}


					}).catch(reject);
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

				let hash = authToken.signedData.data;

				dataService.findRegistrationRecordByHash(hash).then(record => {
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

	//noinspection JSMethodCanBeStatic
	/**
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	saveSession(data) {
		return dataService.saveSession(data);
	}

	/**
	 * Get registration data(fqdn, x509) in case of incomplete registration on mobile side
	 * @param {RegistrationData} data
	 */
	recoveryRegistration(data) {

		let self = this;

		return new Promise((resolve, reject) => {

				const findCert = (fqdn) => {
					store.find(fqdn, true).then(cred => {
						if (!cred) {
							reject(`Credential not found`);
							return;
						}

						resolve({
							result: 'cred',
							data:   cred.getKey("X509")
						});
					}).catch(e => {
						reject(`Credential not found with error ${BeameLogger.formatError(e)}`);
					});
				};

				const registerFqdn = () => {
					self.getRegisterFqdn(data).then(payload => {
							resolve({
								result: 'token',
								data:   payload
							})
						}
					).catch(reject);
				};

				// fqdn received , try find credentials
				dataService.isRegistrationExists(data).then(registration => {
					if (registration) {
						if (registration.completed) {

							if (data.fqdn && data.fqdn != registration.fqdn) {
								reject(`Fqdn ${data.fqdn} doesn't matched registration record`);
								return;
							}
							findCert(registration.fqdn);
						}
						else {
							registerFqdn();
						}
					}
					else {
						registerFqdn();
					}
				}).catch(reject);
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

	/**
	 *
	 * @param {SnsNotificationToken} token
	 */
	static onCertSnsReceived(token) {
		return new Promise((resolve, reject) => {

				let isImageRequired = bootstrapper.registrationImageRequired, isCompleted = false;

				const _onStatusUpdated = registration => {

					BeameAuthServices.IsAdminCreated().then(created => {
						/** @type  {User} */
						let User = {
							name:           registration.name,
							email:          registration.email,
							externalUserId: registration.externalUserId,
							fqdn:           registration.fqdn,
							isAdmin:        created != true
						};

						dataService.saveUser(User).then(() => {
							//load credentials
							let creds = new beameSDK.Credential(store);
							creds.initFromX509(token.x509, token.metadata);

							logger.info(`credentials ${token.metadata.fqdn} loaded to store from sns notification`)
						}).catch(reject);
					});

				};

				const _assertRegistrationStatus = (reg) => {

					return new Promise((resolve, reject) => {
							if (!reg) {
								reject(`registration record for fqdn ${token.fqdn} not found`);
								return;
							}

							isCompleted = !isImageRequired || reg.userDataReceived;

							resolve(reg.id);
						}
					);

				};

				const _updateRegistrationStatus = registration => {
					return isCompleted ? dataService.markRegistrationAsCompleted(token.fqdn) : Promise.resolve(registration);
				};

				const _sendCompleteEvent = () => {
					return new Promise((resolve) => {
							let $this = BeameAuthServices.getInstance();

							$this.sendCustomerInvitationCompleteEvent(token.fqdn).then(resolve).catch(err => {
								logger.error(err);
								resolve();
							})
						}
					);
				};

				const _getRemoteCreds = () => {
					return store.find(token.fqdn, true)
				};

				_getRemoteCreds()
					.then(dataService.findRegistrationRecordByFqdn.bind(dataService, token.fqdn))
					.then(_assertRegistrationStatus)
					.then(dataService.updateRegistrationCertFlag.bind(dataService))
					.then(_updateRegistrationStatus)
					.then(_onStatusUpdated)
					.then(_sendCompleteEvent)
					.then(resolve)
					.catch(reject);
			}
		);
	}

	static onUserDataReceived(hash) {
		return new Promise((resolve, reject) => {

				let isCompleted = false;


				const _assertRegistrationStatus = (record) => {

					return new Promise((resolve, reject) => {
							if (!record) {
								reject(`registration record for hash ${hash} not found`);
								return;
							}

							isCompleted = record.certReceived;

							resolve(record.id);
						}
					);

				};

				const _updateRegistrationStatus = (record) => {
					return isCompleted ? dataService.markRegistrationAsCompleted(record.fqdn) : Promise.resolve(record);
				};

				dataService.findRegistrationRecordByHash(hash)
					.then(_assertRegistrationStatus)
					.then(dataService.updateRegistrationUserDataFlag.bind(dataService))
					.then(_updateRegistrationStatus)
					.then(resolve)
					.catch(reject);
			}
		);
	}

	/**
	 * @param {SnsNotificationToken} token
	 */
	static onUserCertRevoked(token) {
		return dataService.updateUserActiveStatus(token.fqdn, false);
	}

	/**
	 * @param {SnsNotificationToken} token
	 */
	static onUserDeleted(token) {
		return dataService.markUserAsDeleted(token.fqdn);
	}

	static isCustomerApproveRequired() {
		return bootstrapper.registrationImageRequired;
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

	/**
	 *
	 * @param {String} endpoint
	 * @param {Object} metadata
	 * @returns {Promise}
	 * @private
	 */
	_registerFqdn(endpoint, metadata) {
		return new Promise((resolve, reject) => {
				let sign         = this.signData(metadata),
				    provisionApi = new ProvisionApi(),
				    apiData      = beameSDK.ProvApi.getApiData(endpoint, metadata);

				logger.printStandardEvent(module_name, BeameLogger.StandardFlowEvent.Registering, "New entity");

				provisionApi.runRestfulAPI(apiData, (error, payload) => {
					if (!error) {
						logger.printStandardEvent(module_name, BeameLogger.StandardFlowEvent.Registered, payload["fqdn"]);
						payload["sign"] = this.signData(payload);
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
	 */
	signData(data2Sign) {

		let sha = CommonUtils.generateDigest(data2Sign);

		return AuthToken.create(sha, this._creds, bootstrapper.registrationAuthTokenTtl);

	}

	//endregion

	//region user
	static IsAdminCreated() {
		return new Promise((resolve) => {
				dataService.searchUsers({"isAdmin": true}).then(admins => {
					resolve(admins.length > 0);
				}).catch(error => {
					logger.error(`IsAdminCreated error ${BeameLogger.formatError(error)}`);
					resolve(false);
				});
			}
		);
	}

	static loginUser(fqdn) {
		return new Promise((resolve, reject) => {
				BeameAuthServices.findUser(fqdn).then(user => {
					dataService.updateLoginInfo(fqdn).then(() => {
						resolve(user);
					}).catch(error => {
						logger.error(`update last login for user ${fqdn} failed with ${BeameLogger.formatError(error)}`);
						resolve(user);
					});

				}).catch(reject);
			}
		);
	}

	/**
	 * Using for handling mobile event, fields in use fqdn+name+nickname
	 * @param {User} user
	 */
	static updateUserProfile(user) {
		return new Promise((resolve, reject) => {

				dataService.updateUserProfile(user).then(() => {
					resolve(user);
				}).catch(error => {
					logger.error(`update profile for user ${user.fqdn} failed with ${BeameLogger.formatError(error)}`);
					reject(error);
				});

			}
		);
	}

	static findUser(fqdn) {

		return new Promise((resolve, reject) => {
				dataService.findUser(fqdn).then(user => {
					if (user == null) {
						reject(`user ${fqdn} not found`);
					}

					if (user.isDeleted) {
						reject(`user ${fqdn} deleted`);
						return;
					}

					if (!user.isActive) {
						reject(`user ${fqdn} is not active`);
						return;
					}

					resolve({
						fqdn:     fqdn,
						name:     user.name || '',
						nickname: user.nickname || '',
						email:    user.email || '',
						isAdmin:  user.isAdmin,
						user_id:  user.externalUserId || ''
					});
				}).catch(reject);
			}
		);
	}

	//endregion

	//region invitations
	getInvitations() {
		return new Promise((resolve, reject) => {
				try {
					const appId = bootstrapper.appId;

					let sign         = this.signData({appId}),
					    provisionApi = new ProvisionApi(),
					    url          = `${this._matchingServerFqdn}${apiConfig.Actions.Matching.GetInvitations.endpoint}`;

					provisionApi.makeGetRequest(`https://${url}`, {appId}, (error, payload) => {
						if (error) {
							reject(error);
						}
						else {

							let invitations = payload.data;

							Promise.all(invitations.map(data => {
									return dataService.findRegistrationRecordByFqdn(data.fqdn).then(reg => {
										if (reg) {
											data.name   = reg.name;
											data.email  = reg.email;
											data.userId = reg.externalUserId;
											data.reg_id = reg.id;
										}

										return data;
									});
								}
							)).then(() => {
								resolve(invitations)
							}).catch(reject);

							//resolve(payload.data);
						}
					}, sign);
				} catch (e) {
					reject(e);
				}
			}
		);
	}

	deleteInvitation(id, fqdn) {
		return new Promise((resolve, reject) => {
				try {
					let sign         = this.signData({fqdn}),
					    provisionApi = new ProvisionApi(),
					    url          = `${this._matchingServerFqdn}${apiConfig.Actions.Matching.DeleteInvitation.endpoint}${id}`;

					provisionApi.postRequest(`https://${url}`, {fqdn}, (error) => {
						error ? reject(error) : resolve();
					}, sign);
				} catch (e) {
					reject(e);
				}
			}
		);
	}

	/**
	 * @param {String} method
	 * @param {Object} metadata
	 * @param {String|null|undefined} [phone_number]
	 */
	sendCustomerInvitation(method, metadata, phone_number) {

		let existingRegistrationRecord = null, customerFqdn = null;

		const _findExistingRegistration = () => {

			return new Promise((resolve, reject) => {

					dataService.findRegistrationRecordByHash(metadata.hash).then(registration => {
						if (registration) {

							existingRegistrationRecord = registration;

							// if (registration.completed) {
							// 	reject(`Customer with email ${metadata.email}, name ${metadata.name}, userId ${metadata.user_id} already registered`);
							// 	return;
							// }

							resolve(registration.pin);
						}
						else {
							resolve(null);
						}
					}).catch(reject);
				}
			);
		};

		const _saveRegistration = data => {
			return new Promise((resolve, reject) => {
					if (existingRegistrationRecord) {
						dataService.updateRegistrationPin(existingRegistrationRecord.id, data.pin).then(() => {
							resolve(data.pin);
						}).catch(reject);
					}
					else {
						data.fqdn = customerFqdn;
						this.saveRegistration(data).then(() => {
							resolve(data.pin);
						}).catch(reject);
					}
				}
			);
		};

		const _sendCustomerInvitation = (method, _metadata, phone_number) => {

			let options      = {
				    fqdn:          this._fqdn,
				    name:          _metadata.name,
				    email:         _metadata.email,
				    userId:        _metadata.user_id,
				    matchingFqdn:  this._matchingServerFqdn,
				    serviceName:   bootstrapper.serviceName,
				    serviceId:     bootstrapper.appId,
				    ttl:           bootstrapper.customerInvitationTtl,
				    imageRequired: bootstrapper.registrationImageRequired,
				    gwFqdn:        Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer),
				    version:       bootstrapper.version,
				    pairing:       bootstrapper.pairingRequired
			    },
			    postEmailUrl = null,
			    postSmsUrl   = null;

			const getRegToken = () => {
				return new Promise((resolve, reject) => {
						let cred = new beameSDK.Credential(store);

						cred.createMobileRegistrationToken(options).then(resolve).catch(reject);
					}
				);
			};

			const saveInvitation = (regToken) => {

				return new Promise((resolve, reject) => {
						try {
							let sign         = this.signData(options),
							    provisionApi = new ProvisionApi(),
							    fqdn         = CommonUtils.parse(CommonUtils.parse(CommonUtils.parse(new Buffer(regToken, 'base64').toString()).authToken).signedData.data).fqdn,
							    url          = `${this._matchingServerFqdn}${apiConfig.Actions.Matching.SaveInvitation.endpoint}`,
							    invitation   = {
								    token:  regToken,
								    appId:  bootstrapper.appId,
								    fqdn:   fqdn,
								    name:   options.name,
								    email:  options.email,
								    userId: options.user_id
							    };

							customerFqdn = fqdn;
							provisionApi.postRequest(`https://${url}`, invitation, (error, payload) => {
								if (error) {
									reject(error);
								}
								else {
									resolve(payload.data);
								}
							}, sign, 10);
						} catch (e) {
							reject(e);
						}
					}
				);
			};

			const sendEmail = (data) => {
				return new Promise((resolve, reject) => {
						let sign         = this.signData(options),
						    provisionApi = new ProvisionApi(),
						    token        = {pin: data.pin, id: data.id, matching: this._matchingServerFqdn},
						    base64Token  = new Buffer(CommonUtils.stringify(token, false)).toString('base64'),
						    emailToken   = {
							    email:   options.email,
							    service: bootstrapper.serviceName,
							    url:     `${UniversalLinkUrl}?token=${base64Token}`,
							    id:      data.id
						    };

						provisionApi.postRequest(postEmailUrl, emailToken, (error) => {
							if (error) {
								reject(error);
							}
							else {
								resolve({pin: data.pin});
							}
						}, sign);
					}
				);
			};

			const sendSms = (data) => {
				return new Promise((resolve, reject) => {
						let sign         = this.signData(options),
						    provisionApi = new ProvisionApi(),
						    smsToken     = {
							    to:  phone_number,
							    pin: data.pin
						    };

						provisionApi.postRequest(postSmsUrl, smsToken, (error) => {
							if (error) {
								reject(error);
							}
							else {
								resolve();
							}
						}, sign);
					}
				);
			};

			const assertEmail = () => {
				return new Promise((resolve, reject) => {
						if (!_metadata.email) {
							reject(`Email required`);
							return;
						}

						postEmailUrl = bootstrapper.postEmailUrl;

						if (!postEmailUrl) {
							reject(`Post Email url not defined`);
							return;
						}

						resolve();
					}
				);
			};

			const assertSms = () => {
				return new Promise((resolve, reject) => {
						if (!phone_number) {
							reject(`Phone number required`);
							return;
						}

						postSmsUrl = bootstrapper.postSmsUrl;

						if (!postSmsUrl) {
							reject(`Post SMS url not defined`);
							return;
						}

						resolve();
					}
				);
			};

			return new Promise((resolve, reject) => {
					switch (method) {
						case Constants.RegistrationMethod.Email:
							assertEmail()
								.then(getRegToken)
								.then(saveInvitation)
								.then(sendEmail)
								.then(resolve)
								.catch(reject);
							return;

						case Constants.RegistrationMethod.SMS:
							assertSms()
								.then(getRegToken)
								.then(saveInvitation)
								.then(sendSms)
								.then(resolve)
								.catch(reject);
							return;
						default:
							reject(`Unknown registration method`);
							return;
					}
				}
			);
		};

		return new Promise((resolve, reject) => {

				_findExistingRegistration()
					.then(pin => {
						//existing unfinished registration with pin found
						if (pin) {
							resolve(pin);
							return;
						}

						_sendCustomerInvitation(method, metadata, phone_number)
							.then(data => {
								if (!data.pin) {
									reject(`pin not received`);
									return;
								}

								metadata.pin = data.pin;

								_saveRegistration(metadata).then(resolve).catch(reject);

							}).catch(reject);

					}).catch(reject);

			}
		);

	}

	sendCustomerInvitationCompleteEvent(fqdn) {
		return new Promise((resolve, reject) => {
				const method = bootstrapper.registrationMethod;

				switch (method) {
					case Constants.RegistrationMethod.Email:
						try {
							let sign         = this.signData(fqdn),
							    provisionApi = new ProvisionApi(),
							    url          = `${this._matchingServerFqdn}${apiConfig.Actions.Matching.CompleteInvitation.endpoint}/${fqdn}`;

							provisionApi.postRequest(`https://${url}`, {}, (error) => {
								if (error) {
									reject(error);
								}
								else {
									resolve();
								}
							}, sign, 10);
						} catch (e) {
							reject(e);
						}
						return;
					default:
						resolve();
						return;
				}
			}
		);
	}

	//endregion

	//region Creds
	findCreds(pattern) {
		return new Promise((resolve) => {

				let list = store.list(null, {
					hasPrivateKey: true,
					anyParent:     Bootstrapper.getCredFqdn(Constants.CredentialType.ZeroLevel)
				});

				const _isContains = (cred) => {
					return cred.getKey("FQDN").indexOf(pattern) >= 0 || (cred.metadata.name && cred.metadata.name.toLowerCase().indexOf(pattern.toLowerCase()) >= 0);
				};

				resolve(list.filter(_isContains).map(item => {
					return {fqdn: item.fqdn, name: item.metadata.name ? `${item.metadata.name} (${item.fqdn})` : item.fqdn}
				}));
			}
		);
	}

	credsList(parent) {
		return new Promise((resolve) => {

				// let list = store.list(null, {
				// 	anyParent:     Bootstrapper.getCredFqdn(Constants.CredentialType.ZeroLevel)
				// });

				const _formatCred = (cred) => {
					return {
						name:        cred.metadata.name || cred.metadata.fqdn,
						fqdn:        cred.metadata.fqdn,
						parent:      cred.metadata.parent_fqdn,
						isLocal:     cred.hasKey("PRIVATE_KEY"),
						hasChildren: store.hasLocalChildren(cred.fqdn),
						isRoot:      cred.fqdn === Bootstrapper.getCredFqdn(Constants.CredentialType.ZeroLevel)
					}
				};

				if (parent) {
					let list = store.list(null, {
						hasParent: parent
					});

					resolve(list.map(item => {

						return _formatCred(item);
					}));
				}
				else {
					store.find(Bootstrapper.getCredFqdn(Constants.CredentialType.ZeroLevel)).then(cred => {
						resolve([_formatCred(cred)]);
					}).catch(er => {
						logger.error(er);
						resolve([]);
					})
				}
			}
		);
	}

	createRegToken(data) {
		return new Promise((resolve, reject) => {
				const Credential                      = beameSDK.Credential;
				let cred = new Credential(store), ttl = 60 * 60 * 24;

				try {
					ttl = parseInt(data.ttl);
				} catch (e) {

				}

				cred.createRegistrationToken({
						fqdn:      data.fqdn, name: data.name, email: data.email,
						userId:    data.user_id, ttl: ttl, serviceName: bootstrapper.serviceName,
						serviceId: bootstrapper.appId, matchingFqdn: this._matchingServerFqdn,
						gwFqdn:    Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer),
						version:   bootstrapper.version,
						pairing:   bootstrapper.pairingRequired
					})
					.then(resolve)
					.catch(reject);
			}
		);
	}

	createCred(data) {
		return new Promise((resolve, reject) => {
				const Credential = beameSDK.Credential;
				let cred         = new Credential(store);

				if (data.save_creds) {
					logger.debug('************* CREATE LOCAL CREDS');
					cred.createEntityWithLocalCreds(data.fqdn, data.name, data.email, null, data.password)
						.then(meta => {

							store.find(meta.fqdn, false).then(newCred => {
								// resolve({
								// 	fqdn:meta.fqdn,
								// 	pfx: newCred.getKey("PKCS12")
								// });
								resolve(meta);
							}).catch(reject);


						})
						//.then(resolve)
						.catch(reject)
				}
				else {
					logger.debug('************* CREATE VIRTUAL CREDS');
					cred.createVirtualEntity(data.fqdn, data.name, data.email, data.password)
						.then(resolve)
						.catch(reject);
				}

			}
		);
	}

	getPfx(fqdn, saveAction = false) {
		return new Promise((resolve, reject) => {
				let cred = store.getCredential(fqdn);

				if (!cred) {
					reject(`Credential ${fqdn} not found`);
					return;
				}

				if (!cred.hasKey("PKCS12")) {
					reject(`Pfx ${fqdn} not found`);
					return;
				}

				if (saveAction) {
					BeameAuthServices._saveCredAction(cred, {
						action: Constants.CredAction.Download,
						date:   Date.now()
					});
				}

				resolve(cred.getKey("PKCS12"));
			}
		);
	}

	sendPfx(fqdn, email) {

		return new Promise((resolve, reject) => {
				const _sendEmail = (cred) => {

					if (!cred.hasKey("PKCS12")) {
						reject(`Pfx ${fqdn} not found`);
						return;
					}

					if (!cred.hasKey("PWD")) {
						reject(`Pwd ${fqdn} not found`);
						return;
					}

					let sign         = this.signData({fqdn, email}),
					    provisionApi = new ProvisionApi(),
					    emailToken   = {
						    email,
						    fqdn,
						    body: `Your certificate is attached.<br /> Use this password is <b>${String.fromCharCode.apply(null, cred.PWD)}</b> to import attached certificate`,
						    pfx:  new Buffer(cred.getKey("PKCS12")).toString('base64')
					    };

					provisionApi.postRequest(bootstrapper.emailSendCertUrl, emailToken, (error) => {
						if (error) {
							reject(error);
						}
						else {
							BeameAuthServices._saveCredAction(cred, {
								action: Constants.CredAction.Send,
								email,
								date:   Date.now()
							});

							this.getCredDetail(fqdn).then(resolve).catch(reject);
						}
					}, sign);
				};

				store.find(fqdn, false).then(_sendEmail).catch(reject);
			}
		);
	}

	setCredVpnStatus(fqdn, id, name, action) {

		return new Promise((resolve, reject) => {

				store.find(fqdn).then(cred=>{

					const _resolve = ()=>{
						this.getCredDetail(fqdn).then(resolve).catch(reject);
					};

					switch (action){
						case 'create':
							if (!cred.metadata.vpn) {
								cred.metadata.vpn = [];
							}

							if(cred.metadata.vpn.some(x=>x.id === id)){
								_resolve();
							}
							else {
								cred.metadata.vpn.push({
									id:utils.generateUID(32),
									name,
									date:Date.now()
								});

								BeameAuthServices._saveCredAction(cred, {
									action: Constants.CredAction.VpnRootCreated,
									name,
									date:   Date.now()
								});

								_resolve();
							}
							break;
						case 'delete':
							if (!cred.metadata.vpn) {
								_resolve();
								return;
							}

							if(cred.metadata.vpn.some(x=>x.id === id)){
								let item = cred.metadata.vpn.find(x=>x.id === id);

								if(item){
									name = item.name;
									let index = cred.metadata.vpn.indexOf(item);
									cred.metadata.vpn.splice(index, 1);
									BeameAuthServices._saveCredAction(cred, {
										action: Constants.CredAction.VpnRootDeleted,
										name,
										date:   Date.now()
									});
								}

								_resolve();
							}
							else{
								_resolve();
							}

							break;
						default:_resolve();
					}


				}).catch(reject);
			}
		);
	}

	getCredDetail(fqdn) {
		return new Promise((resolve, reject) => {
				let cred = store.getCredential(fqdn);

				if (!cred) {
					reject(`Credential ${fqdn} not found`);
					return;
				}

				let data = Object.assign({}, cred.metadata);

				data.pwd = cred.hasKey("PWD") ? String.fromCharCode.apply(null, cred.PWD) : null;

				data.hasChildren = store.hasLocalChildren(fqdn);

				data.pfx_path = cred.hasKey("PKCS12") ? `/cred/pfx/${fqdn}` : null;

				data.isLocal = cred.hasKey("PRIVATE_KEY");

				data.validTill = cred.getCertEnd();

				if (cred.metadata.parent_fqdn) {
					let parent = store.getCredential(cred.metadata.parent_fqdn);

					if (parent) {
						data.parent_name = parent.metadata.name;
					}
				} else {
					data.parent_name = null;
				}

				if (cred.metadata.actions) {
					cred.metadata.actions = cred.metadata.actions.map(function (item) {
						if (item.date) {
							item.dateStr = new Date(item.date).toLocaleString();
						}

						return item;
					})
				}

				this._getDownloadUrl(cred).then(url => {
					data.download_url = url;
					resolve(data);
				}).catch((e) => {
					logger.error(`Get download url error for ${fqdn}`, e);
					resolve(data);
				})


			}
		);
	}

	_getDownloadUrl(cred) {
		let gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);

		return new Promise((resolve) => {
				utils.createAuthTokenByFqdn(gwServerFqdn, JSON.stringify({fqdn: cred.fqdn}), bootstrapper.proxySessionTtl).then(token => {

					let uid = utils.generateUID(24);

					this._downloadTokens[uid] = token;

					setTimeout(() => {
						delete  this._downloadTokens[uid];
					}, bootstrapper.proxySessionTtl);

					resolve(`https://${gwServerFqdn}/cred-download/?uid=${uid}`);
				});
			}
		);
	}

	static _saveCredAction(cred, token) {
		if (!cred.metadata.actions) {
			cred.metadata.actions = [];
		}

		cred.metadata.actions.push(token);

		cred.beameStoreServices.writeMetadataSync(cred.metadata);
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
						authToken = CommonUtils.parse(authHead);

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

	/** @type {BeameAuthServices} */
	static getInstance() {

		return beameAuthServices;
	}

}

module.exports = BeameAuthServices;

