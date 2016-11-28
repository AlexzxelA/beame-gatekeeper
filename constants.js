/**
 * Created by zenit1 on 10/11/2016.
 */
"use strict";

const path = require('path');
const os   = require('os');
const home = os.homedir();

const WebRootFolder = process.env.BEAME_INSTA_DOC_ROOT || 'public';

const GatewayControllerPath = '/beame-gw';
const LogoutPath            = `${GatewayControllerPath}/logout`;
const AppSwitchPath         = `${GatewayControllerPath}/choose-app`;

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

const LoadBalancerURL = process.env.BEAME_LOAD_BALANCER_URL || "https://may129m153e6emrn.bqnp2d2beqol13qn.v1.d.beameio.net";

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


const SetupServices = {
	"Admin":           {code: "ADMIN"},
	"MobilePhoto":     {code: "MOBILE_PHOTO", port: 65510},
	"MobileStream":    {code: "MOBILE_STREAM", port: 65511},
	"SampleChat":      {code: "SAMPLE_CHAT", port: 65512},
	"SampleFileShare": {code: "SAMPLE_FILE_SHARE", port: 65513}
};


module.exports = {
	RegistrationSource,
	LoadBalancerURL,
	CredentialType,
	SetupServices,
	DbProviders,
	AuthMode: {
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
