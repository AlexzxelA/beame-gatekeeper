/**
 * Created by zenit1 on 09/11/2016.
 */
"use strict";

const path = require('path');
const os   = require('os');
const home = os.homedir();

const DbProviders = {
	"Sqlite":    "sqlite",
	"Couchbase": "couchbase"
};

const db_provider = DbProviders.Sqlite;

const sqlite_db_name           = "beame_server.db";
const sqlite_db_admin_username = "admin";
const sqlite_db_storage_root   = path.join(__dirname, "data");

const beame_server_folder_name = ".beame_server";
const beame_server_folder_path = path.join(home, beame_server_folder_name);

const ConfigProps = {
	Settings: {
		DbProvider: "db_provider"
	},
	Sqlite:   {
		DbName:        "sqlite_db_name",
		AdminUserName: "sqlite_db_admin_username",
		StorageRoot:   "sqlite_db_storage_root"
	},
	Servers:  {
		GatewayFqdn:   "gateway_server_fqdn",
		AuthFqdn:      "auth_server_fqdn",
		MatchingFqdn:  "matching_server_fqdn",
		AdminFqdn:     "admin_server_fqdn",
		WhispererFqdn: "whisperer_server_fqdn"
	},
	BeameDir: {
		BeameFolderRootPath: "beame_server_folder_path",
		BeameFolderName:     "beame_server_folder_name"
	}


};

module.exports = {
	ConfigProps,
	DbProviders,

	db_provider,

	sqlite_db_name,
	sqlite_db_storage_root,
	sqlite_db_admin_username,

	beame_server_folder_path,
	beame_server_folder_name,


	gateway_server_fqdn:   "",
	auth_server_fqdn:      "",
	admin_server_fqdn:     "",
	matching_server_fqdn:  "",
	whisperer_server_fqdn: ""


};