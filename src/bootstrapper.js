/**
 * Created by zenit1 on 09/11/2016.
 */
"use strict";


const path = require('path');

const defaults      = require('../defaults');
const SqliteProps   = defaults.ConfigProps.Sqlite;
const SettingsProps = defaults.ConfigProps.Settings;
//const ServersFqdn   = defaults.ConfigProps.CredentialType;
const execFile      = require('child_process').execFile;


const beameSDK    = require('beame-sdk');
const module_name = "Bootstrapper";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const CommonUtils = beameSDK.CommonUtils;
// const BeameStore        = beameSDK.BeameStore;
// const beameUtils        = beameSDK.BeameUtils;
const DirectoryServices = beameSDK.DirectoryServices;
const dirServices       = new DirectoryServices();

const Constants = require('../constants');
const DbProviders   = Constants.DbProviders;

const AppConfigFileName      = Constants.AppConfigFileName;
const CredsFileName          = Constants.CredsFileName;
const SqliteDbConfigFileName = Constants.SqliteDbConfigFileName;
const BeameRootPath          = Constants.BeameRootPath;

const CredsFolderPath      = Constants.CredsFolderPath;
const CredsJsonPath        = Constants.CredsJsonPath;
const ConfigFolderPath     = Constants.ConfigFolderPath;
const AppConfigJsonPath    = Constants.AppConfigJsonPath;
const SqliteConfigJsonPath = Constants.SqliteConfigJsonPath;

const __onConfigError = error=> {
	logger.error(error);
	process.exit(1);
};

class Bootstrapper {

	constructor() {
		let config   = DirectoryServices.readJSON(AppConfigJsonPath);
		this._config = CommonUtils.isObjectEmpty(config) ? null : config;
	}

	/**
	 * init config files and then db
	 */
	initAll() {
		return new Promise((resolve) => {
			this.initConfig(false).then(this.initDb.bind(this, false)).then(()=> {
				logger.info(`beame-insta-server bootstrapped successfully`);
				resolve();
			}).catch(__onConfigError);
		});
	}

	/**
	 *
	 * @param {boolean} exit
	 * @returns {Promise}
	 */
	initConfig(exit) {

		return new Promise((resolve) => {
				Bootstrapper._ensureBeameServerDir().then(this._ensureAppConfigJson.bind(this)).then(this._ensureCredsConfigJson.bind(this)).then(this._ensureDbConfig.bind(this)).then(()=> {
					logger.info(`Beame-insta-server config files ensured`);
					resolve();
					if (exit) {
						process.exit(0);
					}
				}).catch(__onConfigError)
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
						this._ensureSqliteDir().then(this._migrateSqliteSchema.bind(this)).then(()=> {
							logger.info(`Beame-insta-server ${provider} DB updated successfully`);
							resolve();
							if (exit) {
								process.exit(0);
							}
						}).catch(__onConfigError);
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

			let emptyServers = CommonUtils.filterHash(creds, (k, v) => v.fqdn === "");

			if (!CommonUtils.isObjectEmpty(emptyServers)) {
				Object.keys(emptyServers).forEach(key=>logger.info(`${key} not found`));
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

		return CommonUtils.filterHash(emptyServers, (k, v) => v.server);
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

				dirServices.saveFileAsync(CredsJsonPath, CommonUtils.stringify(creds)).then(()=> {
					logger.info(`${fqdn} saved as ${credType}...`);
					resolve();
				}).catch(reject);
			}
		);
	}

	//region Beame folder
	static _ensureBeameServerDir() {

		return new Promise((resolve, reject) => {
				Bootstrapper._ensureDir(BeameRootPath).then(Bootstrapper._ensureDir(ConfigFolderPath)).then(Bootstrapper._ensureDir(CredsFolderPath)).then(resolve).catch(reject);
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
					this._updateAppConfigJson().then(resolve).catch(__onConfigError);
				}
				else {
					this._createAppConfigJson().then(resolve).catch(__onConfigError);
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
					if (typeof defaults[prop] === "string") {
						//noinspection JSUnfilteredForInLoop
						config[prop] = defaults[prop];
					}
				}

				this._config = config;

				dirServices.saveFileAsync(AppConfigJsonPath, CommonUtils.stringify(config)).then(()=> {
					logger.debug(`${AppConfigFileName} saved in ${path.dirname(AppConfigJsonPath)}...`);
					resolve();
				}).catch(error=> {
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
						reject(`${AppConfigFileName} file corrupted`);
						return;
					}

					for (let prop in defaults) {
						//noinspection JSUnfilteredForInLoop
						if (typeof defaults[prop] === "string" && !config.hasOwnProperty(prop)) {
							updateFile   = true;
							//noinspection JSUnfilteredForInLoop
							config[prop] = defaults[prop];
						}
					}

					this._config = config;

					if (!updateFile) {
						logger.debug(`no changes found for ${AppConfigFileName}...`);
						resolve();
						return;
					}

					dirServices.saveFileAsync(AppConfigJsonPath, CommonUtils.stringify(config, false)).then(()=> {
						logger.debug(`${AppConfigFileName} updated...`);
						resolve();
					}).catch(error=> {
						this._config = null;
						reject(error);
					});

				} catch (error) {
					reject(error);
				}
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
					resolve();
				}
				else {
					this._createCredsConfigJson().then(resolve).catch(__onConfigError);
				}
			}
		);
	}

	_createCredsConfigJson() {

		return new Promise((resolve, reject) => {
				let credsConfig = defaults.CredsConfigTemplate;

				dirServices.saveFileAsync(CredsJsonPath, CommonUtils.stringify(credsConfig)).then(()=> {
					logger.debug(`${CredsFileName} saved in ${path.dirname(CredsJsonPath)}...`);
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
						this._ensureSqliteConfigJson().then(resolve).catch(__onConfigError);
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

		return new Promise((resolve) => {

				logger.debug(`validating sqlite ${SqliteDbConfigFileName}...`);

				let isExists = DirectoryServices.doesPathExists(SqliteConfigJsonPath);

				if (isExists) {
					logger.debug(`sqlite ${SqliteDbConfigFileName} found...`);
					resolve();
				}
				else {
					this._createSqliteConfigJson().then(resolve).catch(__onConfigError);
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
				dbConfig[env]["storage"]  = path.join(this._config[SqliteProps.StorageRoot], this._config[SqliteProps.DbName]);

				dirServices.saveFileAsync(SqliteConfigJsonPath, CommonUtils.stringify(dbConfig)).then(()=> {
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
				let action = path.join(__dirname, "..", "node_modules", ".bin", "sequelize"),
				    args   = ["db:migrate", "--env", "production", "--config", SqliteConfigJsonPath];

				try {
					execFile(action, args, (error) => {
						if (error) {
							reject(error);
							return;
						}
						logger.debug(`sqlite migration completed successfully...`);
						resolve();
					});
				}
				catch (e) {
					reject(e);
				}
			}
		);
	};

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

}

module.exports = Bootstrapper;
