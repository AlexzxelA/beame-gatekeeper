/**
 * Created by zenit1 on 10/11/2016.
 */
"use strict";

const path = require('path');
const os   = require('os');
const home = os.homedir();

//DON'T change these settings
const beame_server_folder_name = ".beame_server";
const BeameRootPath            = path.join(home, beame_server_folder_name);

const ConfigFolder      = "config";
const CredsConfigFolder = "creds";

const AppConfigFileName      = "app_config.json";
const CredsFileName          = "creds.json";
const SqliteDbConfigFileName = "sqlite_config.json";


const CredsFolderPath      = path.join(BeameRootPath, CredsConfigFolder);
const CredsJsonPath        = path.join(BeameRootPath, CredsConfigFolder, CredsFileName);
const ConfigFolderPath     = path.join(BeameRootPath, ConfigFolder);
const AppConfigJsonPath    = path.join(BeameRootPath, ConfigFolder, AppConfigFileName);
const SqliteConfigJsonPath = path.join(BeameRootPath, ConfigFolder, SqliteDbConfigFileName);

/**
 * Registration sources
 * @readonly
 * @enum {Number}
 */
const RegistrationSource = {
	"Unknown":        0,
	"NodeJSSDK":      1,
	"InstaSSL":       2,
	"InstaServerSDK": 3,
	"IOSSDK":         4
};

const CredentialType = {
	ZeroLevel:       "ZeroLevel",
	GatewayServer:   "GatewayServer",
	AuthServer:      "AuthServer",
	MatchingServer:  "MatchingServer",
	AdminServer:     "AdminServer",
	WhispererServer: "WhispererServer"
};


const DbProviders = {
	"Sqlite":    "sqlite",
	"Couchbase": "couchbase"
};

module.exports = {
	RegistrationSource,
	CredentialType,
	DbProviders,

	BeameRootPath,

	AppConfigFileName,
	CredsFileName,
	SqliteDbConfigFileName,

	CredsFolderPath,
	CredsJsonPath,
	ConfigFolderPath,
	AppConfigJsonPath,
	SqliteConfigJsonPath
};