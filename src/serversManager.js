/**
 * Created by zenit1 on 10/11/2016.
 */
"use strict";

const beameSDK = require('beame-sdk');
const module_name = "ServersManager";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const CommonUtils = beameSDK.CommonUtils;

class ServersManager{
	constructor(credSettings){

		if(CommonUtils.isObjectEmpty(credSettings)){
			logger.error(`Creds settings required`);
			process.exit(1);
		}

		this._settings = credSettings;
	}
}
