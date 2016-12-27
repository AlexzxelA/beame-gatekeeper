/**
 * Created by zenit1 on 10/11/2016.
 */
"use strict";
const async = require('async');


const beameSDK    = require('beame-sdk');
const module_name = "ServersManager";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const CommonUtils = beameSDK.CommonUtils;

const Constants = require('../constants');

class ServersManager {

	constructor(serversSettings, _serviceManager) {

		if (CommonUtils.isObjectEmpty(serversSettings)) {
			logger.error(`Creds settings required`);
			process.exit(1);
		}

		this._serviceManager = _serviceManager;
		this._settings       = serversSettings;
		this._servers        = {};
	}

	start() {


		async.parallel([
				callback => {

					logger.debug('SETTINGS', this._settings);
					const gws = new (require('./servers/gw/gateway'))(this._settings.GatewayServer.fqdn, this._settings.MatchingServer.fqdn, this._serviceManager);
					gws.start((error, app) => {
						if (!error) {
							logger.info(`Gateway server started on https://${this._settings.GatewayServer.fqdn}`);
							this._servers[Constants.CredentialType.GatewayServer] = app;
							callback();
						}
						else {
							callback(error);
						}
					});
				},
				callback => {

					const BeameAuthServer = require('../src/servers/beame_auth/server');

					let beame_auth_server = new BeameAuthServer(this._settings.BeameAuthorizationServer.fqdn, this._settings.MatchingServer.fqdn);

					beame_auth_server.start((error, app) => {
						if (!error) {
							logger.info(`Beame Auth server started on https://${this._settings.BeameAuthorizationServer.fqdn}`);
							this._servers[Constants.CredentialType.BeameAuthorizationServer] = app;
							callback()
						}
						else {
							callback(error);
						}
					});
				},

				callback => {

					const MatchingServer = require('BeameMatchingServer').Server;

					let matching_server = new MatchingServer(this._settings.MatchingServer.fqdn, null, [this._settings.GatewayServer.fqdn, this._settings.BeameAuthorizationServer.fqdn]);

					matching_server.start((error, app) => {
						if (!error) {
							logger.info(`Matching server started on https://${this._settings.MatchingServer.fqdn}`);
							this._servers[Constants.CredentialType.MatchingServer] = app;
							callback();
						}
						else {
							callback(error);
						}
					});
				},
				callback => {
					let chatApp = new (require('../apps/chat'))();
					chatApp.start();
					callback();
				},
				callback => {
					let fileApp = new (require('../apps/files'))();
					fileApp.start();
					callback();
				},
				callback => {
					let mobilePhotoApp = new (require('../apps/photo'))();
					mobilePhotoApp.start();
					callback();
				},
				callback => {
					let mobileStreamApp = new (require('../apps/stream'))();
					mobileStreamApp.start();
					callback();
				}
			],
			error => {
				if (error) {

					logger.error(`server starting error ${BeameLogger.formatError(error)}`);

					for (let type in this._servers) {
						//noinspection JSUnfilteredForInLoop
						let server = this._servers[type];

						if (server.stop && typeof  server.stop == "function") {
							server.stop();
						}
					}
				}
				else {
					logger.info(`Servers started successfully`);
				}
			});

	}

	static go(serviceManager, serversSettings) {
		return (new ServersManager(serversSettings, serviceManager)).start();
	}
}


module.exports = ServersManager;
