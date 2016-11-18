/**
 * Created by zenit1 on 10/11/2016.
 */
"use strict";

const path = require('path');
const os   = require('os');
const home = os.homedir();

const WebRootFolder = process.env.BEAME_INSTA_DOC_ROOT || 'public';

const GatewayControllerPath = '/beame-gw';
const LogoutPath = `${GatewayControllerPath}/logout`;
const AppSwitchPath = `${GatewayControllerPath}/choose-app`;

const beame_server_folder_name = ".beame_server";
const BeameRootPath            = path.join(home, beame_server_folder_name);

const ConfigFolder      = "config";
const CredsConfigFolder = "creds";

const AppConfigFileName           = "app_config.json";
const CredsFileName               = "creds.json";
const CustomerAuthServersFileName = "auth_servers.json";
const SqliteDbConfigFileName      = "sqlite_config.json";


const CredsFolderPath             = path.join(BeameRootPath, CredsConfigFolder);
const CredsJsonPath               = path.join(BeameRootPath, CredsConfigFolder, CredsFileName);
const CustomerAuthServersJsonPath = path.join(BeameRootPath, CredsConfigFolder, CustomerAuthServersFileName);
const ConfigFolderPath            = path.join(BeameRootPath, ConfigFolder);
const AppConfigJsonPath           = path.join(BeameRootPath, ConfigFolder, AppConfigFileName);
const SqliteConfigJsonPath        = path.join(BeameRootPath, ConfigFolder, SqliteDbConfigFileName);

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
	ZeroLevel:                "ZeroLevel",
	GatewayServer:            "GatewayServer",
	BeameAuthorizationServer: "BeameAuthorizationServer",
	MatchingServer:           "MatchingServer",
	AdminServer:              "AdminServer",
	CustomerAuthServer:       "CustomerAuthServer"
};


const DbProviders = {
	"Sqlite":    "sqlite",
	"Couchbase": "couchbase"
};

module.exports = {
	RegistrationSource,
	CredentialType,
	DbProviders,
	AuthMode : {
		"SESSION":   "Session",
		"PROVISION": "Provision"
	},
	WebRootFolder,
	GatewayControllerPath,
	LogoutPath,
	AppSwitchPath,

	BeameRootPath,

	AppConfigFileName,
	CredsFileName,
	CustomerAuthServersFileName,
	SqliteDbConfigFileName,

	CredsFolderPath,
	CredsJsonPath,
	CustomerAuthServersJsonPath,
	ConfigFolderPath,
	AppConfigJsonPath,
	SqliteConfigJsonPath
};
