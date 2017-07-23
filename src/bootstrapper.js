/**
 * Created by zenit1 on 09/11/2016.
 */
"use strict";

const uuid = require('uuid');
const path = require('path');

const packageJson       = require('../package.json');
const defaults          = require('../defaults');
const SettingsProps     = defaults.ConfigProps.Settings;
const NeDBProps         = defaults.ConfigProps.NeDB;
const utils             = require('./utils');
const beameSDK          = require('beame-sdk');
const module_name       = "Bootstrapper";
const BeameLogger       = beameSDK.Logger;
const logger            = new BeameLogger(module_name);
const CommonUtils       = beameSDK.CommonUtils;
const DirectoryServices = beameSDK.DirectoryServices;
const dirServices       = new DirectoryServices();

const Constants   = require('../constants');
const DbProviders = Constants.DbProviders;

const AppConfigFileName       = Constants.AppConfigFileName;
const CredsFileName           = Constants.CredsFileName;
const ProvisionConfigFileName = Constants.ProvisionConfigFileName;

const BeameServerConfigRootPath = Constants.BeameServerConfigRootPath;

const CredsFolderPath     = Constants.CredsFolderPath;
const CredsJsonPath       = Constants.CredsJsonPath;
const ProvisionConfigPath = Constants.ProvisionConfigPath;


const ConfigFolderPath  = Constants.ConfigFolderPath;
const AppConfigJsonPath = Constants.AppConfigJsonPath;


const _onConfigError = error => {
	logger.error(error);
	process.exit(1);
};

let bootstrapperInstance;

class Bootstrapper {

	constructor() {
		let config                            = DirectoryServices.readJSON(AppConfigJsonPath);
		this._config                          = CommonUtils.isObjectEmpty(config) ? null : config;
		this._provisionConfig                 = null;
		this._isDelegatedCentralLoginVerified = false;
		this._roles                           = [];
		this._proxyAgent                      = null;
		this._authServerLocalPort             = null;
	}

	/**
	 * init config files and then db
	 */
	initAll() {
		return new Promise((resolve) => {
			this.initConfig(false)
				.then(this.initDb.bind(this, false))
				.then(this.initProvisionSettings.bind(this))
				.then(() => {
					logger.info(`beame-gatekeeper bootstrapped successfully`);
					resolve();
				})
				.catch(_onConfigError);
		});
	}

	/**
	 *
	 * @param {boolean} exit
	 * @param {boolean} rejectInvalidDbProvider
	 * @returns {Promise}
	 */
	initConfig(exit, rejectInvalidDbProvider = true) {

		return new Promise((resolve) => {
				Bootstrapper._ensureBeameServerDir()
					.then(this._ensureAppConfigJson.bind(this))
					.then(this._ensureCredsConfigJson.bind(this))
					.then(this._ensureProvisionConfigJson.bind(this))
					.then(this._ensureDbConfig.bind(this, rejectInvalidDbProvider))
					.then(() => {
						logger.info(`Beame-gatekeeper config files ensured`);
						resolve();
						if (exit) {
							process.exit(0);
						}
					})
					.catch(_onConfigError)
			}
		);
	}

	/**
	 *
	 * @param {boolean} exit
	 * @returns {Promise}
	 */
	initDb(exit) {
		return new Promise((resolve, reject) => {
				let provider = this._config[SettingsProps.DbProvider];

				logger.debug(`DB Provider set to ${provider}...`);

				if (!provider) {
					reject(`Db Provider not defined`);
					return;
				}

				switch (provider) {
					case DbProviders.NeDB:
						this._ensureNedbDir()
							.then(() => {
								logger.info(`Beame-gatekeeper ${provider} DB updated successfully`);
								resolve();
								if (exit) {
									process.exit(0);
								}
							}).catch(_onConfigError);
						return;
					//TODO implement Couchbase connector
					// case DbProviders.Couchbase:
					// 	break;
				}

				reject(`Db Provider ${provider} currently not supported`);
			}
		);
	}

	initProvisionSettings() {
		this.provisionConfig = DirectoryServices.readJSON(ProvisionConfigPath);
	}

	getServersSettings() {

		return new Promise((resolve, reject) => {

			let creds = DirectoryServices.readJSON(CredsJsonPath);

			if (CommonUtils.isObjectEmpty(creds)) {
				reject('Credentials do not exist');
				return;
			}

			let emptyServers = CommonUtils.filterHash(creds, (k, v) => v.fqdn === "" && v.internal);

			if (!CommonUtils.isObjectEmpty(emptyServers)) {
				Object.keys(emptyServers).forEach(key => logger.info(`${key} not found`));
				reject(`Credentials for following servers not found: ${Object.keys(emptyServers).join(',')}`);
				return;
			}

			resolve(CommonUtils.filterHash(creds, (k, v) => v.server));
		});
	}

	/**
	 * Set OCSP cache which override default from SDK
	 * @param {Number|null} [days]
	 */
	setOcspCachePeriod(days) {
		process.env.BEAME_OCSP_CACHE_PERIOD = (days || this.ocspCachePeriod) * 1000 * 60 * 60 * 24;
	}

	setHtmlEnvMode() {
		let htmlMode = this.htmlEnvMode;

		if (htmlMode == Constants.HtmlEnvMode.Production) {
			process.env.BEAME_INSTA_DOC_ROOT = 'dist';
		}
		else {
			process.env.BEAME_INSTA_DOC_ROOT = 'public';
		}
	}

	setExternalOcspEnv() {
		if (this.externalOcspServerFqdn) {
			process.env.EXTERNAL_OCSP_FQDN = this.externalOcspServerFqdn;
		}
	}

	assertProxySettings() {

		return new Promise((resolve) => {
				let sett           = this.proxySettings,
				    initProxyAgent = false,
				    port;
				if (sett.host && sett.port) {

					try {
						port           = parseInt(sett.port);
						initProxyAgent = true;
					} catch (e) {
					}
				}

				if (initProxyAgent && !this._proxyAgent) {
					this._proxyAgent = beameSDK.ProxyAgent;

					this._proxyAgent.initialize({
						host: sett.host,
						port: port
					});
				}

				resolve();
			}
		);
	}

	static isConfigurationValid() {

		let responseObj = {
			valid:   true,
			message: null
		};

		try {
			let sdkProfile    = beameSDK.Config.EnvProfile,
			    keeperProfile = Constants.EnvProfile,
			    zeroLevelCred = Bootstrapper.getCredFqdn(Constants.CredentialType.ZeroLevel),
			    parts         = zeroLevelCred ? zeroLevelCred.split('.') : null,
			    credEnv       = parts ? `.${parts[parts.length - 3]}.` : null;


			if (sdkProfile.Name !== keeperProfile.Name) {
				responseObj.valid   = false;
				responseObj.message = `Mismatch between SDK and Keeper environments: SDK set to ${sdkProfile.Name} and Gatekeeper to ${keeperProfile.Name}`;

				return responseObj;
			}

			if (!credEnv) return responseObj;

			if (keeperProfile.FqdnPattern != credEnv) {
				responseObj.valid   = false;
				responseObj.message = `Mismatch between Keeper and saved credentials pattern: Gatekeeper has ${keeperProfile.FqdnPattern} and Zero Level Cred has ${credEnv} `;
			}

			return responseObj;

		} catch (e) {
			responseObj.valid   = false;
			responseObj.message = BeameLogger.formatError(e);

			return responseObj;
		}

	}

	static getServersToCreate() {
		let creds = DirectoryServices.readJSON(CredsJsonPath);

		if (CommonUtils.isObjectEmpty(creds)) return null;

		let emptyServers = CommonUtils.filterHash(creds, (k, v) => v.fqdn === "");

		return CommonUtils.filterHash(emptyServers, (k, v) => v.server && v.internal);
	}

	/**
	 * @param {String}type
	 * @returns {String|null}
	 */
	static getCredFqdn(type) {
		let creds = DirectoryServices.readJSON(CredsJsonPath);

		if (CommonUtils.isObjectEmpty(creds)) return null;

		let zero = creds[type];

		return zero ? (zero["fqdn"] === "" ? null : zero["fqdn"]) : null;
	}

	static getLogoutUrl() {
		let fqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
		return fqdn ? `https://${fqdn}${Constants.LogoutPath}` : null;
	}

	static getLogout2LoginUrl() {
		let fqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
		return fqdn ? `https://${fqdn}${Constants.LogoutToLoginPath}` : null;
	}

	/**
	 * @param {String} fqdn
	 * @param {String} credType
	 * @returns {Promise}
	 */
	updateCredsFqdn(fqdn, credType) {
		return new Promise((resolve, reject) => {
				let creds = DirectoryServices.readJSON(CredsJsonPath);

				if (CommonUtils.isObjectEmpty(creds)) {
					reject(`creds file not found`);
					return;
				}

				if (!creds[credType]) {
					reject(`unknown cred type ${credType}`);
					return;
				}

				creds[credType]["fqdn"] = fqdn;

				DirectoryServices.saveFileSync(CredsJsonPath, CommonUtils.stringify(creds, true), (error) => {
					if (error) {
						reject(error);
						return;
					}
					resolve();
				});
			}
		);
	}

	updateProvisionConfig(config) {
		return new Promise((resolve, reject) => {

				DirectoryServices.saveFileSync(ProvisionConfigPath, CommonUtils.stringify(config, true), (error) => {
					if (error) {
						reject(error);
						return;
					}
					resolve();
				});
			}
		);
	}

	//region getters and setters
	get delegatedLoginUrl() {
		return this.externalLoginUrl ? (this.isDelegatedCentralLoginVerified ? this.externalLoginUrl : (this.allowDirectSignin ? null : Constants.DCLSOfflinePath)) : null;
	}

	get isCentralLogin() {
		return this.envMode == Constants.EnvMode.CentralLogin || this.envMode == Constants.EnvMode.DelegatedLoginMaster
	}

	get isDelegatedCentralLoginVerified() {
		return this._isDelegatedCentralLoginVerified;
	}

	set isDelegatedCentralLoginVerified(value) {
		this._isDelegatedCentralLoginVerified = value;
	}

	get dbProvider() {
		return this._config && this._config[SettingsProps.DbProvider] ? this._config[SettingsProps.DbProvider] : null;
	}

	set setDbProvider(provider) {
		this._config[SettingsProps.DbProvider] = provider;
	}

	get registrationAuthTokenTtl() {
		return this._config && this._config[SettingsProps.RegistrationAuthTokenTtl] ? this._config[SettingsProps.RegistrationAuthTokenTtl] : defaults.RegistrationAuthTokenTtl;
	}

	get proxyInitiatingTtl() {
		return this._config && this._config[SettingsProps.ProxyInitiatingTtl] ? this._config[SettingsProps.ProxyInitiatingTtl] : defaults.ProxyInitiatingTtl;
	}

	get proxySessionTtl() {
		return this._config && this._config[SettingsProps.ProxySessionTtl] ? this._config[SettingsProps.ProxySessionTtl] : defaults.ProxySessionTtl;
	}

	get registrationMethod() {
		return this._config && this._config[SettingsProps.RegistrationMethod] ? this._config[SettingsProps.RegistrationMethod] : defaults.RegistrationMethod;
	}

	get browserSessionTtl() {
		return this._config && this._config[SettingsProps.BrowserSessionTtl] ? this._config[SettingsProps.BrowserSessionTtl] : defaults.BrowserSessionTtl;
	}

	get customerInvitationTtl() {
		return this._config && this._config[SettingsProps.CustomerInvitationTtl] ? this._config[SettingsProps.CustomerInvitationTtl] : defaults.CustomerInvitationTtl;
	}

	get sessionRecordDeleteTimeout() {
		return this._config && this._config[SettingsProps.SessionRecordDeleteTimeout] ? this._config[SettingsProps.SessionRecordDeleteTimeout] : defaults.SessionRecordDeleteTimeout;
	}

	get killSocketOnDisconnectTimeout() {
		return this._config && this._config[SettingsProps.KillSocketOnDisconnectTimeout] ? this._config[SettingsProps.KillSocketOnDisconnectTimeout] : defaults.KillSocketOnDisconnectTimeout;
	}

	get whispererSendPinInterval() {
		return this._config && this._config[SettingsProps.WhispererSendPinInterval] ? this._config[SettingsProps.WhispererSendPinInterval] : defaults.WhispererSendPinInterval;
	}

	get ocspCachePeriod() {
		return this._config && this._config[SettingsProps.OcspCachePeriod] ? this._config[SettingsProps.OcspCachePeriod] : defaults.OcspCachePeriod;
	}

	get postEmailUrl() {
		return this._config && this._config[SettingsProps.PostEmailUrl] ? this._config[SettingsProps.PostEmailUrl] : null;
	}

	get emailSendCertUrl() {
		return this._config && this._config[SettingsProps.EmailSendCertUrl] ? this._config[SettingsProps.EmailSendCertUrl] : null;
	}

	get postSmsUrl() {
		return this._config && this._config[SettingsProps.PostSmsUrl] ? this._config[SettingsProps.PostSmsUrl] : null;
	}

	get externalMatchingFqdn() {
		return this._config && this._config[SettingsProps.ExternalMatchingFqdn] ? this._config[SettingsProps.ExternalMatchingFqdn] : null;
	}

	get externalOcspServerFqdn() {
		return this._config && this._config[SettingsProps.ExternalOcspServerFqdn] ? this._config[SettingsProps.ExternalOcspServerFqdn] : null;
	}

	get proxySettings() {
		return this._config && this._config[SettingsProps.ProxySettings] ? this._config[SettingsProps.ProxySettings] : defaults.DefaultProxyConfig;
	}

	set setProxySettings(settings) {
		this._config[SettingsProps.ProxySettings] = settings;
	}

	get externalLoginUrl() {
		return this._config && this._config[SettingsProps.ExternalLoginServer] ? this._config[SettingsProps.ExternalLoginServer] : null;
	}

	set externalLoginUrl(data) {
		this._config[SettingsProps.ExternalLoginServer] = data;
	}

	get serviceName() {
		return this._config && this._config[SettingsProps.ServiceName] ? this._config[SettingsProps.ServiceName] : null;
	}

	get appConfig() {
		return this._config;
	}

	get appId() {
		return this._config && this._config[SettingsProps.AppId] ? this._config[SettingsProps.AppId] : null;
	}

	set appId(value) {
		this._config[SettingsProps.AppId] = value;
	}

	get appData() {
		return {
			name:    this.serviceName,
			version: Bootstrapper.version
			//appId:   this.appId
		}
	}

	get registrationImageRequired() {
		return this._config[SettingsProps.RegistrationImageRequired];
	}

	get publicRegistration() {
		return this._config[SettingsProps.PublicRegistration];
	}

	static get neDbRootPath() {
		return Constants.BeameDataStorageRootPath;
	}

	get pairingRequired() {
		return this._config[SettingsProps.PairingRequired];
	}

	get envMode() {
		return this._config[SettingsProps.EnvMode] || Constants.EnvMode.Gatekeeper;
	}

	get htmlEnvMode() {
		return this._config[SettingsProps.HtmlEnvMode] || Constants.HtmlEnvMode.Production;
	}

	get encryptUserData() {
		return this._config[SettingsProps.EncryptUserData];
	}

	get useBeameAuthOnLocal() {
		return this._config[SettingsProps.UseBeameAuthOnLocal];
	}

	get allowDirectSignin() {
		return this._config[SettingsProps.AllowDirectSignin];
	}

	static get creds() {
		let creds = DirectoryServices.readJSON(CredsJsonPath);

		if (CommonUtils.isObjectEmpty(creds)) {
			return {};
		}

		return creds;
	}

	static get version() {
		return packageJson.version;
	}

	set setAppConfig(config) {
		this._config = config;
	}

	set setRoles(roles) {
		this._roles = roles.map(item => {
			return {
				id:   item.id,
				name: item.name
			}
		});
	}

	get roles() {
		return this._roles;
	}

	set authServerLocalPort(port) {
		this._authServerLocalPort = port;
	}

	get authServerLocalPort() {
		return this._authServerLocalPort;
	}

	get customLoginProvider() {
		return this._config[SettingsProps.CustomLoginProvider] || null;
	}


	get provisionConfig() {
		return this._provisionConfig;
	}

	static get readProvisionConfig() {
		return DirectoryServices.readJSON(ProvisionConfigPath);
	}


	set provisionConfig(config) {
		this._provisionConfig = config;
	}


	//endregion

	//region Beame folder
	static _ensureBeameServerDir() {

		return new Promise((resolve, reject) => {
				Bootstrapper._ensureDir(BeameServerConfigRootPath)
					.then(Bootstrapper._ensureDir(ConfigFolderPath))
					.then(Bootstrapper._ensureDir(CredsFolderPath))
					.then(resolve)
					.catch(reject);
			}
		);

	}

	//endregion

	//region App Config
	_ensureAppConfigJson() {

		return new Promise((resolve) => {
				logger.debug(`ensuring ${AppConfigFileName}...`);

				let isExists = DirectoryServices.doesPathExists(AppConfigJsonPath);

				if (isExists) {
					logger.debug(`${AppConfigFileName} found...`);
					this._updateAppConfigJson().then(resolve).catch(_onConfigError);
				}
				else {
					this._createAppConfigJson().then(resolve).catch(_onConfigError);
				}

			}
		);
	}

	_createAppConfigJson() {

		return new Promise((resolve, reject) => {
				logger.debug(`creating ${AppConfigFileName}...`);

				let config = {};

				for (let prop in defaults) {
					//noinspection JSUnfilteredForInLoop
					if (typeof defaults[prop] !== "object" || prop == SettingsProps.ProxySettings) {
						if (prop == SettingsProps.AppId) {
							//noinspection JSUnfilteredForInLoop
							config[prop] = uuid.v4();
						}
						else if (prop == SettingsProps.ProxySettings) {
							// noinspection JSUnfilteredForInLoop
							config[prop] = defaults.DefaultProxyConfig;
						}
						else {
							//noinspection JSUnfilteredForInLoop
							config[prop] = defaults[prop];
						}

					}
				}

				this._config = config;

				this.saveAppConfigFile().then(() => {
					logger.debug(`${AppConfigFileName} saved in ${path.dirname(AppConfigJsonPath)}...`);
					resolve();
				}).catch(error => {
					this._config = null;
					reject(error);
				});
			}
		);
	}

	_updateAppConfigJson() {

		return new Promise((resolve, reject) => {
				try {
					let config     = DirectoryServices.readJSON(AppConfigJsonPath),
					    updateFile = false;

					if (CommonUtils.isObjectEmpty(config)) {
						return this._createAppConfigJson();
					}

					for (let prop in defaults) {
						//noinspection JSUnfilteredForInLoop
						if ((typeof defaults[prop] !== "object") && !config.hasOwnProperty(prop)) {
							updateFile   = true;
							//noinspection JSUnfilteredForInLoop
							config[prop] = defaults[prop];
						}

						//noinspection JSUnfilteredForInLoop
						if (prop == SettingsProps.ProxySettings && (!config[prop] || CommonUtils.isObjectEmpty(config[prop]))) {
							updateFile   = true;
							//noinspection JSUnfilteredForInLoop
							config[prop] = defaults.DefaultProxyConfig;
						}
					}

					this._config = config;

					if (!updateFile) {
						logger.debug(`no changes found for ${AppConfigFileName}...`);
						resolve();
						return;
					}

					this.saveAppConfigFile().then(() => {
						logger.debug(`${AppConfigFileName} updated...`);
						resolve();
					}).catch(error => {
						this._config = null;
						reject(error);
					});

				} catch (error) {
					reject(error);
				}
			}
		);
	}

	saveAppConfigFile() {

		return dirServices.saveFileAsync(AppConfigJsonPath, CommonUtils.stringify(this._config, true));
	}

	setServiceName(name) {
		return new Promise((resolve, reject) => {
				if (!name) {
					reject(`name required`);
					return;
				}

				this._config[SettingsProps.ServiceName] = name;

				return this.saveAppConfigFile();
			}
		);
	}

	//endregion

	//region Creds config
	_ensureCredsConfigJson() {
		return new Promise((resolve) => {
				logger.debug(`ensuring ${CredsFileName}...`);

				let isExists = DirectoryServices.doesPathExists(CredsJsonPath);

				if (isExists) {
					logger.debug(`${CredsFileName} found...`);
					this._updateCredsConfigJson().then(resolve).catch(_onConfigError);
				}
				else {
					this._createCredsConfigJson().then(resolve).catch(_onConfigError);
				}
			}
		);
	}

	_createCredsConfigJson() {
		let credsConfig = defaults.CredsConfigTemplate;

		return this._saveCredsConfig(credsConfig);
	}

	_updateCredsConfigJson() {

		return new Promise((resolve, reject) => {
				try {
					let config      = DirectoryServices.readJSON(CredsJsonPath),
					    credsConfig = defaults.CredsConfigTemplate,
					    updateFile  = false;

					if (CommonUtils.isObjectEmpty(config)) {
						return this._createCredsConfigJson();
					}

					for (let prop in credsConfig) {
						//noinspection JSUnfilteredForInLoop
						if (!config.hasOwnProperty(prop)) {
							updateFile   = true;
							//noinspection JSUnfilteredForInLoop
							config[prop] = credsConfig[prop];
						}
						else {
							//noinspection JSUnfilteredForInLoop
							for (let subProp in credsConfig[prop]) {
								//noinspection JSUnfilteredForInLoop
								if (!config[prop].hasOwnProperty(subProp)) {
									updateFile            = true;
									//noinspection JSUnfilteredForInLoop
									config[prop][subProp] = credsConfig[prop][subProp];
								}
							}
						}
					}

					if (!updateFile) {
						logger.debug(`no changes found for ${CredsFileName}...`);
						resolve();
						return;
					}

					return this._saveCredsConfig(config);

				} catch (error) {
					reject(error);
				}
			}
		);
	}

	_saveCredsConfig(credsConfig) {
		return new Promise((resolve, reject) => {
				dirServices.saveFileAsync(CredsJsonPath, CommonUtils.stringify(credsConfig, true)).then(() => {
					logger.debug(`${CredsFileName} saved in ${path.dirname(CredsJsonPath)}...`);
					resolve();
				}).catch(reject);
			}
		);
	}

	//endregion

	// region Provision  config

	/**
	 * @returns {Promise}
	 * @private
	 */
	_ensureProvisionConfigJson() {
		return new Promise((resolve) => {
				logger.debug(`ensuring ${ProvisionConfigFileName}...`);

				let isExists = DirectoryServices.doesPathExists(ProvisionConfigPath);

				if (isExists) {
					logger.debug(`${CredsFileName} found...`);
					resolve();
				}
				else {
					this._createProvisionConfigJson().then(resolve).catch(_onConfigError);
				}
			}
		);
	}

	/**
	 ** @returns {Promise}
	 * @private
	 */
	_createProvisionConfigJson() {

		return new Promise((resolve, reject) => {
				let provision = defaults.ProvisionSettingsTemplate;


				dirServices.saveFileAsync(ProvisionConfigPath, CommonUtils.stringify(provision, true)).then(() => {
					logger.debug(`${ProvisionConfigFileName} saved in ${path.dirname(ProvisionConfigPath)}...`);
					resolve();
				}).catch(reject);

			}
		);
	}

	//endregion

	//region Db services
	//region config
	_ensureDbConfig(rejectInvalidDbProvider) {

		return new Promise((resolve, reject) => {
				let provider = this._config[SettingsProps.DbProvider];

				logger.debug(`DB Provider set to ${provider}...`);

				if (!provider) {
					reject(`Db Provider not defined`);
					return;
				}

				switch (provider) {
					case DbProviders.NeDB:
						const nedb = new (require('./db/nedb'))(Bootstrapper.neDbRootPath, {});
						nedb.start().then(resolve).catch(reject);
						return;
					//TODO implement Couchbase connector
					// case DbProviders.Couchbase:
					// 	break;
				}

				let msg = `Db Provider ${provider} currently not supported`;

				if (rejectInvalidDbProvider) {
					reject(msg);
				}
				else {
					console.warn(msg);
					resolve()
				}
			}
		);
	}

	//region NeDB
	_ensureNedbDir() {

		return this._ensureConfigDir(NeDBProps.StorageRoot);
	}

	//endregion

	//endregion

	//region Directory services
	_ensureConfigDir(prop) {

		return new Promise((resolve, reject) => {
				let dir = this._config[prop];

				if (!dir) {
					reject(`config.json not contains required "beame-server dir root path" value`);
					return;
				}

				Bootstrapper._ensureDir(dir).then(resolve);
			}
		);


	}

	static _ensureDir(dir) {
		return new Promise((resolve) => {
				DirectoryServices.createDir(dir);

				logger.debug(`directory ${dir} ensured...`);

				resolve();
			}
		);

	}

	//endregion

	/**
	 *
	 * @returns {Bootstrapper}
	 */
	static getInstance() {
		if (!bootstrapperInstance) {
			bootstrapperInstance = new Bootstrapper();
		}

		return bootstrapperInstance;
	}
}

module.exports = Bootstrapper;
