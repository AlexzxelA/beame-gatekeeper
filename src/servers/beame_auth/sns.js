/**
 * Created by zenit1 on 20/09/2016.
 */
"use strict";

/**
 * @typedef {Object} SnsNotificationToken
 * @property {SnsMessageType} type
 * @property {String} fqdn
 * @property {String} x509
 * @property {Object} metadata
 */

const beameSDK          = require('beame-sdk');
const module_name       = "SNS";
const BeameLogger       = beameSDK.Logger;
const logger            = new BeameLogger(module_name);
const BeameAuthServices = require('../../authServices');
const SnsMessageType    = require('../../../constants').SnsMessageType;
const https             = require('https'),
      validator         = new (require('sns-validator'))();


class SnsServices {

	parseSnsMessage(message) {
		logger.debug(`message received`, message);

		return new Promise((resolve, reject) => {

				validator.validate(message, error => {
					if (error) {
						logger.error(BeameLogger.formatError(error));
						reject(error);
						return;
					}

					let snsType = message['Type'];

					switch (snsType) {
						case 'SubscriptionConfirmation':
							https.get(message['SubscribeURL'], () => {
								//noinspection JSUnresolvedVariable
								logger.info(`Subscribed to ${message.TopicArn}`);
								resolve();
							});
							break;

						case 'Notification':
							//noinspection JSUnresolvedVariable
							/** @type {SnsNotificationToken} */
							let token = beameSDK.CommonUtils.parse(message.Message);
							if (token) {

								try {
									let msgType = token.type;

									switch (msgType) {
										case SnsMessageType.Cert:
											BeameAuthServices.onCertSnsReceived(token).then(resolve).catch(resolve);
											return;
										case SnsMessageType.Revoke:
											BeameAuthServices.onRevokeSnsReceived(token)
												.then(BeameAuthServices.onUserCertRevoked.bind(null,token))
												.then(resolve)
												.catch(resolve);
											return;
										case SnsMessageType.Delete:
											BeameAuthServices.onUserDeleted(token).then(resolve).catch(resolve);
											return;
									}
								}
								catch (e) {
									reject(`Sns notification error  ${BeameLogger.formatError(e)}`);
								}


							}
							else {
								resolve();
							}

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
