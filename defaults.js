/**
 * Created by zenit1 on 09/11/2016.
 */
"use strict";

const path = require('path');
const os   = require('os');
const home = process.env.BEAME_FILES_HOME_DIR || os.homedir();

const Constants   = require('./constants');
const Servers     = Constants.CredentialType;
const db_provider = Constants.DbProviders.Sqlite;

const ServiceName              = "ServiceName";
const AppId                    = "";
const sqlite_db_name           = "beame_server.db";
const sqlite_db_admin_username = "admin";
const sqlite_env_name          = "production";
const sqlite_db_storage_root   = path.join(home,process.env.BEAME_DATA_FOLDER || ".beame_data");

const PublicRegistration           = true;
const RegistrationImageRequired    = false;
const EncryptUserData              = false;
const PairingRequired              = true;
const UseBeameAuthOnLocal          = true;
const AllowDirectSignin            = true;
const RunAuthServerOnZeroLevelCred = true;

const RegistrationMethod = Constants.RegistrationMethod.Pairing;
const EnvMode            = Constants.EnvMode.Gatekeeper;
const HtmlEnvMode        = Constants.HtmlEnvMode.Development;


const EmailPostUrl         = "https://rem064h0jljfwh4f.mpk3nobb568nycf5.v1.d.beameio.net/send/invitation";
const EmailSendCertUrl     = "https://rem064h0jljfwh4f.mpk3nobb568nycf5.v1.d.beameio.net/send/pfx";
const ExternalMatchingFqdn = "i5un73q6o42bc8r0.q6ujqecc83gg6fod.v1.d.beameio.net";

//const delegatedLoginServers     = "";
//in sec
const RegistrationAuthTokenTtl      = 60 * 10;
const ProxyInitiatingTtl            = 60 * 10;
const ProxySessionTtl               = 86400;
const BrowserSessionTtl             = 86400;
const CustomerInvitationTtl         = 60 * 60 * 24 * 2;
// in millisec
const SessionRecordDeleteTimeout    = 1000 * 60 * 10;
const KillSocketOnDisconnectTimeout = 1000 * 60 * 3;
const WhispererSendPinInterval      = 1000 * 60;
const OcspCachePeriod               = 30; //in days
const DisableDemoServers            = process.env.BEAME_DISABLE_DEMO_SERVERS || false;

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
		EnvMode:                       "EnvMode",
		HtmlEnvMode:                   "HtmlEnvMode",
		UseBeameAuthOnLocal:           "UseBeameAuthOnLocal",
		ExternalMatchingFqdn:          "ExternalMatchingFqdn",
		PublicRegistration:            "PublicRegistration",
		PairingRequired:               "PairingRequired",
		RegistrationImageRequired:     "RegistrationImageRequired",
		EncryptUserData:               "EncryptUserData",
		RegistrationMethod:            "RegistrationMethod",
		PostEmailUrl:                  "PostEmailUrl",
		EmailSendCertUrl:              "EmailSendCertUrl",
		PostSmsUrl:                    "PostSmsUrl",
		ExternalLoginServer:           "ExternalLoginServer",
		OcspCachePeriod:               "OcspCachePeriod",
		RegistrationAuthTokenTtl:      "RegistrationAuthTokenTtl",
		SessionRecordDeleteTimeout:    "SessionRecordDeleteTimeout",
		KillSocketOnDisconnectTimeout: "KillSocketOnDisconnectTimeout",
		WhispererSendPinInterval:      "WhispererSendPinInterval",
		ProxyInitiatingTtl:            "ProxyInitiatingTtl",
		ProxySessionTtl:               "ProxySessionTtl",
		BrowserSessionTtl:             "BrowserSessionTtl",
		CustomerInvitationTtl:         "CustomerInvitationTtl",
		AllowDirectSignin:             "AllowDirectSignin"
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
		fqdn:     "",
		server:   true,
		internal: true
	},
	[Servers.BeameAuthorizationServer]: {
		fqdn:     "",
		server:   true,
		internal: true
	},
	[Servers.MatchingServer]:           {
		fqdn:     "",
		server:   true,
		internal: true
	},
	[Servers.ExternalMatchingServer]:   {
		fqdn:     ExternalMatchingFqdn,
		server:   true,
		internal: false
	},
	[Servers.ExternalLoginServer]:      {
		fqdn:     "",
		server:   true,
		internal: false
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
	OcspCachePeriod,
	ExternalMatchingFqdn: ExternalMatchingFqdn,
	PostEmailUrl:         EmailPostUrl,
	EmailSendCertUrl:     EmailSendCertUrl,
	PostSmsUrl:           "",
	ExternalLoginServer:  "",
	RegistrationMethod,
	EnvMode,
	HtmlEnvMode,
	UseBeameAuthOnLocal,
	PublicRegistration,
	PairingRequired,
	RegistrationImageRequired,
	EncryptUserData,
	AllowDirectSignin,
	RunAuthServerOnZeroLevelCred,
	DisableDemoServers,

	CredsConfigTemplate,
	CustomerAuthServersTemplate,
	SqliteConfigTemplate,

	db_provider,

	sqlite_db_name,
	sqlite_db_storage_root,
	sqlite_db_admin_username,
	sqlite_env_name
};