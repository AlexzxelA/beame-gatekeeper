/**
 * Created by zenit1 on 10/11/2016.
 */
"use strict";

const beameSDK    = require('beame-sdk');
const module_name = "ServersManager";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const CommonUtils = beameSDK.CommonUtils;

class ServersManager {
	constructor(serversSettings) {

		if (CommonUtils.isObjectEmpty(serversSettings)) {
			logger.error(`Creds settings required`);
			process.exit(1);
		}

		this._settings = serversSettings;
	}

	start() {
		return new Promise((resolve, reject) => {
			logger.info('Starting services');

		});
	}

	static go(serversSettings) {
		return (new ServersManager(serversSettings)).start();
	}
}


module.exports = ServersManager;
