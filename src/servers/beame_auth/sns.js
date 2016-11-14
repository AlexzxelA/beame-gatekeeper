/**
 * Created by zenit1 on 20/09/2016.
 */
"use strict";

/**
 * @typedef {Object} CertNotificationToken
 * @property {String} fqdn
 * @property {String} x509
 * @property {Object} metadata
 */

const beameSDK    = require('beame-sdk');
const module_name = "SNS";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const AuthServices = require('./authServices');
const https     = require('https'),
      validator = new (require('sns-validator'))();


class SnsServices {

	parseSnsMessage(message) {
		logger.debug(`message received`,message);

		return new Promise((resolve, reject) => {

				validator.validate(message, error => {
					if (error) {
						logger.error(BeameLogger.formatError(error));
						reject(error);
						return;
					}

					let msgType = message['Type'];

					switch (msgType) {
						case 'SubscriptionConfirmation':
							https.get(message['SubscribeURL'], (res) => {
								logger.info(`Subscribed to ${message.TopicArn}`);
								resolve();
							});
							break;

						case 'Notification':
							/** @type {CertNotificationToken} */
							var token = beameSDK.CommonUtils.parse(message.Message);
							if (token) {
								AuthServices.markRegistrationAsCompleted(token);
							}
							resolve();
							break;
						default:
							reject('Unknown message type');
							return;
					}
				});
			}
		);
	}
}


module.exports = SnsServices;
