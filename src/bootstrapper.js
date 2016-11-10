/**
 * Created by zenit1 on 09/11/2016.
 */

const path = require('path');
// const os   = require('os');
// const home = os.homedir();

const defaults      = require('../defaults');
//const BeameDirProps = defaults.ConfigProps.BeameDir;
const SqliteProps   = defaults.ConfigProps.Sqlite;
//const ServersProps  = defaults.ConfigProps.Servers;
const SettingsProps = defaults.ConfigProps.Settings;
const DbProviders   = defaults.DbProviders;
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

const AppConfigFileName      = "app_config.json";
const SqliteDbConfigFileName = "db_config.json";
const BeameRootPath          = defaults.beame_server_folder_path;
const ConfigFolderPath       = path.join(BeameRootPath, "config");
const CredsFolderPath        = path.join(BeameRootPath, "creds");
const ConfigJsonPath         = path.join(BeameRootPath, "config", AppConfigFileName);
const SqliteConfigJsonPath   = path.join(BeameRootPath, "config", SqliteDbConfigFileName);

const __onConfigError = error=> {
	logger.error(error);
	process.exit(1);
};

class Bootstrapper {

	constructor() {
		let config   = DirectoryServices.readJSON(ConfigJsonPath);
		this._config = CommonUtils.isObjectEmpty(config) ? null : config;
	}

	initAll(){
		this.initConfig().then(this.initDb.bind(this)).then(()=>{
			logger.info(`beame-insta-server bootstrapped successfully`);
			process.exit(0);
		}).catch(__onConfigError);
	}

	initConfig() {

		return new Promise((resolve) => {
			Bootstrapper._ensureBeameServerDir().then(this._ensureAppConfigJson.bind(this)).then(this._ensureDbConfig.bind(this)).then(resolve).catch(__onConfigError)
			}
		);


	}

	initDb() {
		return new Promise((resolve, reject) => {
				let provider = this._config[SettingsProps.DbProvider];

				logger.debug(`DB Provider set to ${provider}...`);

				if (!provider) {
					reject(`Db Provider not defined`);
					return;
				}

				switch (provider) {
					case DbProviders.Sqlite:
						this._ensureSqliteDir().then(this._migrateSqliteSchema.bind(this)).then(resolve).catch(__onConfigError);
						return;
					//TODO implement Couchbase connector
					// case DbProviders.Couchbase:
					// 	break;
				}

				reject(`Db Provider ${provider} currently not supported`);
			}
		);
	}

	//region Beame folder
	static _ensureBeameServerDir() {

		return Bootstrapper._ensureDir(BeameRootPath).then(Bootstrapper._ensureDir(ConfigFolderPath)).then(Bootstrapper._ensureDir(CredsFolderPath));
	}
	//endregion

	//region App Config
	_ensureAppConfigJson() {

		return new Promise((resolve) => {
				logger.debug(`ensuring ${AppConfigFileName}...`);

				let isExists = DirectoryServices.doesPathExists(ConfigJsonPath);

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

				dirServices.saveFileAsync(ConfigJsonPath, CommonUtils.stringify(config)).then(()=> {
					logger.debug(`${AppConfigFileName} saved in ${path.dirname(ConfigJsonPath)}...`);
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
					let config     = DirectoryServices.readJSON(ConfigJsonPath),
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

					dirServices.saveFileAsync(ConfigJsonPath, CommonUtils.stringify(config, false)).then(()=> {
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
				}).catch(error=> {
					reject(error);
				});

			}
		);


	}
	//endregion

	//region initConfig

	_migrateSqliteSchema() {

		logger.debug(`migrating sqlite schema...`);

		return new Promise((resolve, reject) => {
				//TODO implement https://github.com/sequelize/umzug
				let action = path.join(__dirname, "..", "node_modules", ".bin", "sequelize"),
				    args   = ["db:migrate", "--env", "production", "--config", SqliteConfigJsonPath];

				try {
					execFile(action, args, function (error) {
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
		let dir = this._config[prop];

		if (!dir) {
			return Promise.reject(`config.json not contains required "beame-server dir root path" value`);
		}

		return Bootstrapper._ensureDir(dir);
	}

	static _ensureDir(dir) {
		DirectoryServices.createDir(dir);

		logger.debug(`directory ${dir} ensured...`);

		return Promise.resolve();
	}
	//endregion

}

module.exports = Bootstrapper;