/**
 * Created by zenit1 on 09/11/2016.
 */
"use strict";

const path = require('path');
const os   = require('os');

const Constants   = require('./constants');
const Servers     = Constants.CredentialType;
const db_provider = Constants.DbProviders.NeDB;

const ServiceName = "ServiceName";
const AppId       = "";


const PublicRegistration           = true;
const RegistrationImageRequired    = false;
const EncryptUserData              = false;
const PairingRequired              = true;
const UseBeameAuthOnLocal          = true;
const AllowDirectSignin            = true;
const RunAuthServerOnZeroLevelCred = true;
const ShowZendeskSupport           = true;

const RegistrationMethod = Constants.RegistrationMethod.Pairing;
const EnvMode            = Constants.EnvMode.Gatekeeper;
const HtmlEnvMode        = Constants.HtmlEnvMode.Development;


const EmailPostUrl         = "https://rem064h0jljfwh4f.mpk3nobb568nycf5.v1.d.beameio.net/send/invitation";
const EmailSendCertUrl     = "https://rem064h0jljfwh4f.mpk3nobb568nycf5.v1.d.beameio.net/send/pfx";
const ExternalMatchingFqdn = "i5un73q6o42bc8r0.q6ujqecc83gg6fod.v1.d.beameio.net";


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


const DefaultProxyConfig = {
	host:     "",
	port:     "",
	excludes: "127.0.0.1,localhost"
};

const ConfigProps = {
	Settings: {
		ProxySettings:                 "ProxySettings",
		ServiceName:                   "ServiceName",
		AppId:                         "AppId",
		DbProvider:                    "db_provider",
		EnvMode:                       "EnvMode",
		HtmlEnvMode:                   "HtmlEnvMode",
		UseBeameAuthOnLocal:           "UseBeameAuthOnLocal",
		ExternalMatchingFqdn:          "ExternalMatchingFqdn",
		ExternalOcspServerFqdn:        "ExternalOcspServerFqdn",
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
		AllowDirectSignin:             "AllowDirectSignin",
		CustomLoginProvider:           "CustomLoginProvider",
		ActiveDirectoryDomains:        "ActiveDirectoryDomains",
		ShowZendeskSupport:            "ShowZendeskSupport",
		DisableDemoServers:            "DisableDemoServers"
	},
	NeDB:     {
		StorageRoot: "nedb_storage_root"
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
	[Servers.GatekeeperLoginManager]:   {
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

const ProvisionSettingsTemplate = {
	"Fields": [
		{
			"Order":         1,
			"Label":         "Email",
			"FieldName":     "email",
			"IsActive":      true,
			"Required":      true,
			"IsPassword":    false,
			"LoginProvider": null
		},
		{
			"Order":         2,
			"Label":         "Name",
			"FieldName":     "name",
			"IsActive":      true,
			"Required":      false,
			"IsPassword":    false,
			"LoginProvider": null
		},
		{
			"Order":         3,
			"Label":         "ExternalUserId",
			"FieldName":     "user_id",
			"IsActive":      true,
			"Required":      false,
			"IsPassword":    false,
			"LoginProvider": null
		},
		{
			"Order":         4,
			"Label":         "AD UserName",
			"FieldName":     Constants.ActiveDirectoryProviderFields.user_name,
			"IsActive":      false,
			"Required":      false,
			"IsPassword":    false,
			"LoginProvider": Constants.ActiveDirectoryProviderFields.code
		},
		{
			"Order":         5,
			"Label":         "AD Password",
			"FieldName":     Constants.ActiveDirectoryProviderFields.pwd,
			"IsActive":      false,
			"Required":      false,
			"IsPassword":    true,
			"LoginProvider": Constants.ActiveDirectoryProviderFields.code
		}
	]
};


module.exports = {
	ActiveDirectoryDomains:[],
	ConfigProps,
	AppId,
	ServiceName,

	ProxySettings: null,

	SessionRecordDeleteTimeout,
	KillSocketOnDisconnectTimeout,
	WhispererSendPinInterval,
	RegistrationAuthTokenTtl,
	ProxyInitiatingTtl,
	ProxySessionTtl,
	BrowserSessionTtl,
	CustomerInvitationTtl,
	OcspCachePeriod,
	ExternalMatchingFqdn:   ExternalMatchingFqdn,
	PostEmailUrl:           EmailPostUrl,
	EmailSendCertUrl:       EmailSendCertUrl,
	PostSmsUrl:             "",
	ExternalLoginServer:    "",
	ExternalOcspServerFqdn: "",
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
	ShowZendeskSupport,

	CredsConfigTemplate,
	ProvisionSettingsTemplate,

	db_provider,
	nedb_storage_root: Constants.BeameDataStorageRootPath,

	DefaultProxyConfig

};