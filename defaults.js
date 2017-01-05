/**
 * Created by zenit1 on 09/11/2016.
 */
"use strict";

const path = require('path');
const os   = require('os');
const home = os.homedir();

const Constants   = require('./constants');
const Servers     = Constants.CredentialType;
const db_provider = Constants.DbProviders.Sqlite;

const ServiceName              = "ServiceName";
const AppId                    = "";
const sqlite_db_name           = "beame_server.db";
const sqlite_db_admin_username = "admin";
const sqlite_env_name          = "production";
const sqlite_db_storage_root   = path.join(home, ".beame_data");

const RegistrationImageRequired = true;
const EncryptUserData           = true;
const UseBeameAuthOnLocal = true;
const RegistrationMethod        = Constants.RegistrationMethod.Pairing;
//in sec
const RegistrationAuthTokenTtl  = 60 * 10;
const ProxyInitiatingTtl        = 60 * 10;
const ProxySessionTtl           = 86400;
const BrowserSessionTtl         = 86400;
const CustomerInvitationTtl     = 60 * 60 * 24 * 2;
// in millisec
const SessionRecordDeleteTimeout    = 1000 * 60 * 10;
const KillSocketOnDisconnectTimeout = 1000 * 60 * 3;
const WhispererSendPinInterval      = 1000 * 60;

const SqliteConfigTemplate = {
	[sqlite_env_name]: {
		"username":             "",
		"password":             "",
		"storage":              "",
		"database":             "beame_server",
		"host":                 "127.0.0.1",
		"dialect":              "sqlite",
		"autoMigrateOldSchema": true,
		"seederStorage":        "sequelize"
	}
};


const ConfigProps = {
	Settings: {
		ServiceName:                   "ServiceName",
		AppId:                         "AppId",
		DbProvider:                    "db_provider",
		UseBeameAuthOnLocal:"UseBeameAuthOnLocal",
		RegistrationImageRequired:     "RegistrationImageRequired",
		EncryptUserData:               "EncryptUserData",
		RegistrationMethod:            "RegistrationMethod",
		PostEmailUrl:                  "PostEmailUrl",
		PostSmsUrl:                    "PostSmsUrl",
		RegistrationAuthTokenTtl:      "RegistrationAuthTokenTtl",
		SessionRecordDeleteTimeout:    "SessionRecordDeleteTimeout",
		KillSocketOnDisconnectTimeout: "KillSocketOnDisconnectTimeout",
		WhispererSendPinInterval:      "WhispererSendPinInterval",
		ProxyInitiatingTtl:            "ProxyInitiatingTtl",
		ProxySessionTtl:               "ProxySessionTtl",
		BrowserSessionTtl:             "BrowserSessionTtl",
		CustomerInvitationTtl:"CustomerInvitationTtl"
	},
	Sqlite:   {
		ConfigTemplate: "SqliteConfigTemplate",
		DbName:         "sqlite_db_name",
		AdminUserName:  "sqlite_db_admin_username",
		StorageRoot:    "sqlite_db_storage_root",
		EnvName:        "sqlite_env_name"
	},
	BeameDir: {
		BeameFolderRootPath: "beame_server_folder_path",
		BeameFolderName:     "beame_server_folder_name"
	}
};

const CredsConfigTemplate = {
	[Servers.ZeroLevel]:                {
		fqdn:   "",
		server: false
	},
	[Servers.GatewayServer]:            {
		fqdn:   "",
		server: true
	},
	[Servers.BeameAuthorizationServer]: {
		fqdn:   "",
		server: true
	},
	[Servers.MatchingServer]:           {
		fqdn:   "",
		server: true
	}
};

const CustomerAuthServersTemplate = {
	"Servers": []
};

module.exports = {
	ConfigProps,
	AppId,
	ServiceName,

	SessionRecordDeleteTimeout,
	KillSocketOnDisconnectTimeout,
	WhispererSendPinInterval,
	RegistrationAuthTokenTtl,
	ProxyInitiatingTtl,
	ProxySessionTtl,
	BrowserSessionTtl,
	CustomerInvitationTtl,

	PostEmailUrl: "",
	PostSmsUrl:   "",

	RegistrationMethod,
	UseBeameAuthOnLocal,
	RegistrationImageRequired,
	EncryptUserData,

	CredsConfigTemplate,
	CustomerAuthServersTemplate,
	SqliteConfigTemplate,

	db_provider,

	sqlite_db_name,
	sqlite_db_storage_root,
	sqlite_db_admin_username,
	sqlite_env_name
};