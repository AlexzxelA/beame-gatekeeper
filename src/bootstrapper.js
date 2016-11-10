/**
 * Created by zenit1 on 09/11/2016.
 */

const path = require('path');


const execFile = require('child_process').execFile;


const beameSDK    = require('beame-sdk');
const module_name = "Bootstrapper";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const CommonUtils = beameSDK.CommonUtils;
// const BeameStore        = beameSDK.BeameStore;
// const beameUtils        = beameSDK.BeameUtils;
const DirectoryServices = beameSDK.DirectoryServices;
const dirServices       = new DirectoryServices();

const ConfigJsonPath       = path.join(__dirname, "..", "config", "config.json");
const SqliteConfigJsonPath = path.join(__dirname, "..", "config", "db_config.json");

const defaults      = require('../defaults');
const BeameDirProps = defaults.ConfigProps.BeameDir;
const SqliteProps   = defaults.ConfigProps.Sqlite;
//const ServersProps  = defaults.ConfigProps.Servers;
const SettingsProps = defaults.ConfigProps.Settings;
const DbProviders   = defaults.DbProviders;

class Bootstrapper {

	constructor() {
		this._config = null;
	}

	ensureConfiguration() {

		const __onConfigError = error=> {
			logger.error(error);
			process.exit(1);
		};

		return this._ensureConfigJson().then(this._ensureDb.bind(this)).then(this._ensureBeameServerDir.bind(this)).catch(__onConfigError);

	}


	_ensureConfigJson() {

		logger.debug(`ensuring config.json...`);

		let isExists = DirectoryServices.doesPathExists(ConfigJsonPath);

		if (isExists) {
			logger.debug(`config.json found...`);
			return this._updateConfigFile();
		}

		logger.debug(`creating config.json...`);
		let config = Bootstrapper._buildConfigJson();

		this._config = config;

		return dirServices.saveFileAsync(ConfigJsonPath, CommonUtils.stringify(config, false)).then(()=> {
			logger.debug(`config.json saved...`);
			return Promise.resolve();
		}).catch(error=> {
			this._config = null;
			return Promise.reject(error);
		});
	}

	static _buildConfigJson() {
		let config = {};

		for (let prop in defaults) {
			//noinspection JSUnfilteredForInLoop
			if (typeof defaults[prop] === "string") {
				//noinspection JSUnfilteredForInLoop
				config[prop] = defaults[prop];
			}

		}

		return config;
	}

	_updateConfigFile() {
		try {
			let config     = DirectoryServices.readJSON(ConfigJsonPath),
			    updateFile = false;

			if (CommonUtils.isObjectEmpty(config)) {
				return Promise.reject(`config json file corrupted`);
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
				logger.debug(`no changes found for config.json...`);
				return Promise.resolve();
			}

			return dirServices.saveFileAsync(ConfigJsonPath, CommonUtils.stringify(config, false)).then(()=> {
				logger.debug(`config.json updated...`);
				return Promise.resolve();
			}).catch(error=> {
				this._config = null;
				return Promise.reject(error);
			});

		} catch (e) {
			return Promise.reject(e);
		}
	}

	_ensureBeameServerDir() {

		return this._ensureDir(BeameDirProps.BeameFolderRootPath);
	}

	_ensureDb() {
		let provider = this._config[SettingsProps.DbProvider];

		logger.debug(`DB Provider set to ${provider}...`);

		if (!provider) {
			return Promise.reject(`Db Provider not defined`);
		}

		switch (provider) {
			case DbProviders.Sqlite:
				return this.ensureSqlite();
			//TODO implement Couchbase connector
			// case DbProviders.Couchbase:
			// 	break;
		}

		return Promise.reject(`Db Provider ${provider} currently not supported`);
	}

	ensureSqlite() {

		logger.debug(`ensuring sqlite...`);

		return this._ensureSqliteDir().then(this._ensureSqliteConfigJson.bind(this)).then(this._migrateSqliteSchema.bind(this)).catch(error=> {
			return Promise.reject(error);
		});
	}

	_migrateSqliteSchema() {

		logger.debug(`migrating sqlite schema...`);

		return new Promise((resolve, reject) => {
				//TODO implement https://github.com/sequelize/umzug
				let action = path.join(__dirname, "..", "node_modules", ".bin", "sequelize"),
				    args   = ["db:migrate", "--env", "production", "--config", path.join(__dirname, "..", "config", "db_config.json")];

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

		return this._ensureDir(SqliteProps.StorageRoot);
	}

	_ensureSqliteConfigJson() {

		logger.debug(`validating sqlite db_config.json...`);

		let dbConfig   = DirectoryServices.readJSON(SqliteConfigJsonPath),
		    updateFile = false;

		if (CommonUtils.isObjectEmpty(dbConfig)) {
			return Promise.reject(`sqlite db config.json file corrupted`);
		}

		let adminName = dbConfig["production"]["username"],
		    adminPwd  = dbConfig["production"]["password"],
		    storage   = dbConfig["production"]["storage"];

		if (adminName === "") {
			updateFile                         = true;
			dbConfig["production"]["username"] = this._config[SqliteProps.AdminUserName];
			logger.debug(`admin username set to ${this._config[SqliteProps.AdminUserName]}...`);
		}

		if (adminPwd === "") {
			updateFile                         = true;
			dbConfig["production"]["password"] = CommonUtils.randomPassword(12);
			logger.debug(`admin password created...`)
		}

		if (storage === "") {
			updateFile                        = true;
			dbConfig["production"]["storage"] = path.join(this._config[SqliteProps.StorageRoot], this._config[SqliteProps.DbName]);
			logger.debug(`sqlite storage path updated...`)
		}

		return updateFile ? dirServices.saveFileAsync(SqliteConfigJsonPath, CommonUtils.stringify(dbConfig, false)) : Promise.resolve();
	}

	_ensureDir(prop) {
		let dir = this._config[prop];

		if (!dir) {
			return Promise.reject(`config.json not contains required "beame-server dir root path" value`);
		}

		DirectoryServices.createDir(dir);

		logger.debug(`${dir} ensured...`);

		return Promise.resolve();
	}

	// static _readEdgeMetadata() {
	// 	return beameSDK.DirectoryServices.readJSON(beameUtils.makePath(config.rootDir, config.edgeMetadataFileName));
	// }
}

module.exports = Bootstrapper;