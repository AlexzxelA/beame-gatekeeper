/**
 * Created by zenit1 on 09/11/2016.
 */
"use strict";

const uuid = require('uuid');
const path = require('path');

const packageJson       = require('../package.json');
const defaults          = require('../defaults');
const SqliteProps       = defaults.ConfigProps.Sqlite;
const SettingsProps     = defaults.ConfigProps.Settings;
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

const AppConfigFileName           = Constants.AppConfigFileName;
const CredsFileName               = Constants.CredsFileName;
const CustomerAuthServersFileName = Constants.CustomerAuthServersFileName;


const SqliteDbConfigFileName = Constants.SqliteDbConfigFileName;
const BeameRootPath          = Constants.BeameRootPath;

const CredsFolderPath             = Constants.CredsFolderPath;
const CredsJsonPath               = Constants.CredsJsonPath;
const CustomerAuthServersJsonPath = Constants.CustomerAuthServersJsonPath;


const ConfigFolderPath     = Constants.ConfigFolderPath;
const AppConfigJsonPath    = Constants.AppConfigJsonPath;
const SqliteConfigJsonPath = Constants.SqliteConfigJsonPath;

const _onConfigError = error => {
	logger.error(error);
	process.exit(1);
};

let bootstrapperInstance;

class Bootstrapper {


	constructor() {
		let config   = DirectoryServices.readJSON(AppConfigJsonPath);
		this._config = CommonUtils.isObjectEmpty(config) ? null : config;
		this._isDelegatedCentralLoginVerified = false;
	}

	/**
	 * init config files and then db
	 */
	initAll() {
		return new Promise((resolve) => {
			this.initConfig(false)
				.then(this.initDb.bind(this, false))
				.then(() => {
					logger.info(`beame-insta-server bootstrapped successfully`);
					resolve();
				})
				.catch(_onConfigError);
		});
	}

	/**
	 *
	 * @param {boolean} exit
	 * @returns {Promise}
	 */
	initConfig(exit) {

		return new Promise((resolve) => {
				Bootstrapper._ensureBeameServerDir()
					.then(this._ensureAppConfigJson.bind(this))
					.then(this._ensureCredsConfigJson.bind(this))
					.then(this._ensureCustomerAuthServersJson.bind(this))
					.then(this._ensureDbConfig.bind(this))
					.then(() => {
						logger.info(`Beame-insta-server config files ensured`);
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
					case DbProviders.Sqlite:
						this._ensureSqliteDir()
							.then(this._migrateSqliteSchema.bind(this))
							.then(this._runSqliteSeeders.bind(this))
							.then(() => {
								logger.info(`Beame-insta-server ${provider} DB updated successfully`);
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

	// setDelegatedLoginServers(data) {
	// 	this._config.delegatedLoginServers = (data && (data.length > 0)) ? '[' + data.map(JSON.stringify).join() + ']' : "";
	// 	let old                            = this._config;
	// 	this.setAppConfig(this._config);
	// 	this.saveAppConfigFile().then(console.log('delegatedLoginServers: updated appConfig file')).catch(error => {
	// 		logger.error(`update app config error ${BeameLogger.formatError(error)}`);
	// 		this.setAppConfig(old);
	// 		this.saveAppConfigFile();
	// 	});
	// 	//this._updateAppConfigJson().then(console.log('delegatedLoginServers: updated appConfig file')).catch(_onConfigError);
	// }

	get delegatedLoginUrl() {
		return this.externalLoginUrl ? (this.isDelegatedCentralLoginVerified ? this.externalLoginUrl : Constants.DCLSOfflinePath) : null;
	}

	//region getters
	get isDelegatedCentralLoginVerified() {
		return this._isDelegatedCentralLoginVerified;
	}

	set isDelegatedCentralLoginVerified(value) {
		this._isDelegatedCentralLoginVerified = value;
	}

	get dbProvider() {
		return this._config && this._config[SettingsProps.DbProvider] ? this._config[SettingsProps.DbProvider] : null;
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

	get postEmailUrl() {
		return this._config && this._config[SettingsProps.PostEmailUrl] ? this._config[SettingsProps.PostEmailUrl] : null;
	}

	get postSmsUrl() {
		return this._config && this._config[SettingsProps.PostSmsUrl] ? this._config[SettingsProps.PostSmsUrl] : null;
	}

	get externalMatchingFqdn() {
		return this._config && this._config[SettingsProps.ExternalMatchingFqdn] ? this._config[SettingsProps.ExternalMatchingFqdn] : null;
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

	get sqliteConfig() {
		let config = DirectoryServices.readJSON(SqliteConfigJsonPath);

		if (CommonUtils.isObjectEmpty(config)) {
			//noinspection JSConstructorReturnsPrimitive
			return null;
		}

		let env = this._config[SqliteProps.EnvName];

		return config[env];
	}

	get appConfig() {
		return this._config;
	}

	get appId() {
		return this._config && this._config[SettingsProps.AppId] ? this._config[SettingsProps.AppId] : null;
	}

	get appData() {
		return {
			name:    this.serviceName,
			version: this.version
			//appId:   this.appId
		}
	}

	get registrationImageRequired() {
		return this._config[SettingsProps.RegistrationImageRequired];
	}

	get publicRegistration() {
		return this._config[SettingsProps.PublicRegistration];
	}

	//noinspection JSUnusedGlobalSymbols
	get pairingRequired() {
		return this._config[SettingsProps.PairingRequired];
	}

	get isCentralLoginMode() {
		return this._config[SettingsProps.IsCentralLoginMode];
	}

	get encryptUserData() {
		return this._config[SettingsProps.EncryptUserData];
	}

	get useBeameAuthOnLocal() {
		return this._config[SettingsProps.UseBeameAuthOnLocal];
	}

	get startRaspberryApp() {
		return this._config[SettingsProps.StartRaspberryApp];
	}

	//noinspection JSMethodCanBeStatic
	get creds() {
		let creds = DirectoryServices.readJSON(CredsJsonPath);

		if (CommonUtils.isObjectEmpty(creds)) {
			return {};
		}

		return creds;
	}

	//noinspection JSMethodCanBeStatic
	get version() {
		return packageJson.version;
	}

	set setAppConfig(config) {
		this._config = config;
	}

	// setAppConfig(config) {
	//
	// 	let externalLoginState = this.externalLoginUrl;
	// 	if (!config)
	// 		config = this._config;
	// 	else
	// 		config.delegatedLoginServers = this._config.delegatedLoginServers;
	//
	// 	this._config = config;
	//
	// 	logger.info(`BOOTSRTPR: {${this.externalLoginUrl}}`);
	// 	if (externalLoginState != this.externalLoginUrl) {
	// 		let gwFqdn               = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer),
	// 		    centralLoginServices = require('../src/centralLoginServices').getInstance();
	//
	//
	// 		centralLoginServices.registerServerOnDelegatedCentralLogin(
	// 			this.externalLoginUrl,
	// 			{
	// 				fqdn:   gwFqdn,
	// 				id:     this.appId,
	// 				action: 'register'
	// 			}
	// 		).then((setUrl) => {
	//
	// 			if (setUrl) {
	// 				logger.info(`Registered on external login server: ${setUrl}`);
	// 				this._config[SettingsProps.ExternalLoginServer] = setUrl;
	// 			}
	// 			centralLoginServices.registerServerOnDelegatedCentralLogin(
	// 				externalLoginState,
	// 				{
	// 					fqdn:   gwFqdn,
	// 					id:     this.appId,
	// 					action: 'unregister'
	// 				}
	// 			).then(() => {
	// 				externalLoginState && logger.info(`Un-Registered on external login server: ${externalLoginState}`);
	// 			});
	// 		});
	// 	}
	// }

	//endregion

	//region Beame folder
	static _ensureBeameServerDir() {

		return new Promise((resolve, reject) => {
				Bootstrapper._ensureDir(BeameRootPath)
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
					if (typeof defaults[prop] !== "object") {
						if (prop == SettingsProps.AppId) {
							//noinspection JSUnfilteredForInLoop
							config[prop] = uuid.v4();
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
						if (prop == SettingsProps.AppId && !config[prop]) {
							updateFile   = true;
							//noinspection JSUnfilteredForInLoop
							config[prop] = uuid.v4();
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

	// region Customer Auth servers config
	registerCustomerAuthServer(fqdn) {
		return new Promise((resolve, reject) => {
				if (!fqdn) {
					reject(`fqdn required`);
					return;
				}

				let servers = DirectoryServices.readJSON(CustomerAuthServersJsonPath);

				if (CommonUtils.isObjectEmpty(servers)) {
					reject(`customer auth servers configuration file not found`);
					return;
				}

				if (servers.Servers.indexOf(fqdn) >= 0) {
					resolve();
					return;
				}

				servers.Servers.push(fqdn);

				DirectoryServices.saveFileSync(CustomerAuthServersJsonPath, CommonUtils.stringify(servers, true), (error) => {
					if (error) {
						reject(error);
						return;
					}
					logger.info(`${fqdn} added to authorized customer servers...`);
					resolve();
				});
			}
		);
	}

	static listCustomerAuthServers() {
		return new Promise((resolve) => {
			resolve(DirectoryServices.readJSON(CustomerAuthServersJsonPath).Servers);
		});
	}

	/**
	 * @returns {Promise}
	 * @private
	 */
	_ensureCustomerAuthServersJson() {
		return new Promise((resolve) => {
				logger.debug(`ensuring ${CustomerAuthServersFileName}...`);

				let isExists = DirectoryServices.doesPathExists(CustomerAuthServersJsonPath);

				if (isExists) {
					logger.debug(`${CredsFileName} found...`);
					resolve();
				}
				else {
					this._createCustomerAuthServersJson().then(resolve).catch(_onConfigError);
				}
			}
		);
	}

	/**
	 ** @returns {Promise}
	 * @private
	 */
	_createCustomerAuthServersJson() {

		return new Promise((resolve, reject) => {
				let credsConfig = defaults.CustomerAuthServersTemplate;


				dirServices.saveFileAsync(CustomerAuthServersJsonPath, CommonUtils.stringify(credsConfig, true)).then(() => {
					logger.debug(`${CustomerAuthServersFileName} saved in ${path.dirname(CustomerAuthServersJsonPath)}...`);
					resolve();
				}).catch(reject);

			}
		);
	}

	//endregion

	//region Db services
	//region config
	_ensureDbConfig() {

		return new Promise((resolve, reject) => {
				let provider = this._config[SettingsProps.DbProvider];

				logger.debug(`DB Provider set to ${provider}...`);

				if (!provider) {
					reject(`Db Provider not defined`);
					return;
				}

				switch (provider) {
					case DbProviders.Sqlite:
						this._ensureSqliteConfigJson().then(resolve).catch(_onConfigError);
						return;
					//TODO implement Couchbase connector
					// case DbProviders.Couchbase:
					// 	break;
				}

				reject(`Db Provider ${provider} currently not supported`);
			}
		);
	}

	_ensureSqliteConfigJson() {

		return new Promise((resolve, reject) => {

				logger.debug(`validating sqlite ${SqliteDbConfigFileName}...`);

				let dbConfig = DirectoryServices.readJSON(SqliteConfigJsonPath);

				if (CommonUtils.isObjectEmpty(dbConfig)) {
					this._createSqliteConfigJson().then(resolve).catch(_onConfigError);
					return;
				}

				logger.debug(`sqlite ${SqliteDbConfigFileName} found...`);

				let dbConfigTemplate = defaults.SqliteConfigTemplate,
				    env              = this._config[SqliteProps.EnvName],
				    dbConfigKeys     = Object.keys(dbConfigTemplate[env]),
				    updateFile       = false;

				dbConfigKeys.forEach(key => {
					if (!dbConfig[env].hasOwnProperty(key)) {
						updateFile         = true;
						dbConfig[env][key] = dbConfigTemplate[env][key];
					}
				});


				if (updateFile) {
					dirServices.saveFileAsync(SqliteConfigJsonPath, CommonUtils.stringify(dbConfig, true)).then(() => {
						logger.debug(`${SqliteDbConfigFileName} updated successfully...`);
						resolve();
					}).catch(reject);
				}
				else {
					resolve();
				}

			}
		);

	}

	_createSqliteConfigJson() {

		return new Promise((resolve, reject) => {
				let dbConfig = defaults.SqliteConfigTemplate,
				    env      = this._config[SqliteProps.EnvName];

				dbConfig[env]["username"] = this._config[SqliteProps.AdminUserName];
				dbConfig[env]["password"] = CommonUtils.randomPassword(12);
				dbConfig[env]["storage"]  = path.join(process.env.BEAME_SERVERS_AUTH_DATA_DIR || this._config[SqliteProps.StorageRoot], this._config[SqliteProps.DbName]);

				dirServices.saveFileAsync(SqliteConfigJsonPath, CommonUtils.stringify(dbConfig, true)).then(() => {
					logger.debug(`${SqliteDbConfigFileName} saved in ${path.dirname(SqliteConfigJsonPath)}...`);
					resolve();
				}).catch(reject);

			}
		);
	}

	//endregion

	//region init sqlite db


	_migrateSqliteSchema() {

		logger.debug(`migrating sqlite schema...`);

		return new Promise((resolve, reject) => {
				//TODO implement https://github.com/sequelize/umzug
				let args = ["db:migrate", "--env", this._config[SqliteProps.EnvName], "--config", SqliteConfigJsonPath];


				CommonUtils.runSequilizeCmd(require.resolve('sequelize'), args, path.dirname(__dirname)).then(() => {
					logger.debug(`sqlite migration completed successfully...`);
					resolve();
				}).catch(reject);

			}
		);
	}

	_runSqliteSeeders() {

		logger.debug(`running sqlite seeders...`);

		return new Promise((resolve, reject) => {
				let args = ["db:seed:all", "--env", this._config[SqliteProps.EnvName], "--config", SqliteConfigJsonPath];

				CommonUtils.runSequilizeCmd(require.resolve('sequelize'), args, path.dirname(__dirname)).then(() => {
					logger.debug(`sqlite seeders applied successfully...`);
					resolve();
				}).catch(reject);
			}
		);
	}

	_ensureSqliteDir() {

		return this._ensureConfigDir(SqliteProps.StorageRoot);
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
