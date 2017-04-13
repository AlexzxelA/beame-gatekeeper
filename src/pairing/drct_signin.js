/**
 * Created by Alexz on 13/04/2017.
 */
"use strict";

const module_name      = "DrctSignin";
const beameSDK         = require('beame-sdk');
const BeameLogger      = beameSDK.Logger;
const store            = new beameSDK.BeameStore();
const crypto           = require('crypto');
const logger           = new BeameLogger(module_name);

const Bootstrapper     = require('../bootstrapper');
const bootstrapper     = Bootstrapper.getInstance();
const Constants        = require('../../constants');


class DrctSignin {

	/**
	 * @param {String} fqdn
	 * @param {String} serviceName
	 */
	constructor(fqdn, serviceName) {

		this._gwFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
		this._fqdn               = fqdn;
		this._cachedSessions     = null;
		this._socketTimeout      = bootstrapper.killSocketOnDisconnectTimeout;
		
		this._serviceName        = serviceName;
		this._pairingUtils       = null;
	}

	/**
	 * @param {Socket} socket
	 * @param {Object} cachedSessions
	 */
	onDrctBrowserConnection(socket, cachedSessions) {
		this._cachedSessions = cachedSessions;

		const pairingUtils = require('./pairing_utils');
		this._pairingUtils = new pairingUtils(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer),
			socket, module_name);

		this._pairingUtils.setCommonHandlers();

		logger.info('<<< Drct Browser just connected >>>');

		socket.on('disconnect', () => {
			logger.debug('Drct socket disconnected');

			setTimeout(() => {
				logger.debug('Drct socket closing');

			}, this._socketTimeout);

		});

		socket.on('_disconnect', () => {
			//force disconnect event
			socket.disconnect();
			socket = null;
		});

		socket.on('drct_browser_connected', (data) => {
			logger.debug(`browser socket connected with:${data}`);
			try {
				let parsed = this._cachedSessions && this._cachedSessions[data];

				let fqdn = (typeof parsed.token === 'object')?parsed.token.signedBy:(JSON.parse(parsed.token)).signedBy;
				store.find(fqdn).then(cred => {
					let hdr = '-----BEGIN PUBLIC KEY-----',
						ftr = '-----END PUBLIC KEY-----',
						pk = cred.publicKeyStr.substring(hdr.length, cred.publicKeyStr.length - ftr.length);
					socket.emit("sessionData", {
						service:this._serviceName,
						pk: pk,
						appId:bootstrapper.appId,
						imageRequired: bootstrapper.registrationImageRequired
					});
				}).catch(e => {
					logger.error(`drct_browser_connected error`, BeameLogger.formatError(e));
					socket.emit( "edgeError", "Failed to fetch mobile host public key");
				});

			}
			catch (e){
				console.error(e);
				socket.emit( "edgeError", "Invalid data, please retry");
			}
		});

		socket.on('beamePing', function () {
			setTimeout(function () {
				socket.emit('beamePong');
			}, 1000);
		});

		socket.on('close_session', () => {
			socket.disconnect();
		});
	}
}


module.exports = DrctSignin;
