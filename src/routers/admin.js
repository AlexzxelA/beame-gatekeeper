/**
 * Created by zenit1 on 13/11/2016.
 */

"use strict";

const path    = require('path');
const express = require('express');

const Constants  = require('../../constants');
const public_dir = path.join(__dirname, '..', '..', process.env.BEAME_INSTA_DOC_ROOT);
const base_path  = path.join(public_dir, 'pages', 'admin');

const beameSDK     = require('beame-sdk');
const BeameStore   = new beameSDK.BeameStore();
const CommonUtils  = beameSDK.CommonUtils;
const module_name  = "BeameAdminServices";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const Bootstrapper = require('../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();
const cookieNames       = Constants.CookieNames;

const BeameAuthServices = require('../authServices');
const beameAuthServices = BeameAuthServices.getInstance();

const centralLoginServices = require('../centralLoginServices').getInstance();
const hookServices         = require('../hooksServices').getInstance();

const RESPONSE_SUCCESS_CODE = 1;
const RESPONSE_ERROR_CODE   = 0;

class AdminRouter {
	constructor(adminServices) {
		this._beameAdminServices = adminServices;

		this._router = express.Router();

		this._initRoutes();
	}

	_initRoutes() {
		//region static
		this._router.get('/invitation', (req, res) => {
			res.sendFile(path.join(base_path, 'invitation.html'));
		});

		this._router.get('/', (req, res) => {
			res.cookie(cookieNames.ClientLogin, JSON.stringify({url: `https://${Bootstrapper.getCredFqdn(Constants.CredentialType.GatekeeperLoginManager)}`}));

			res.sendFile(path.join(base_path, 'index.html'));
		});
		//endregion

		//region settings
		this._router.get('/settings/get', (req, res) => {
			this._beameAdminServices.getSettings().then(data => {
				res.json(data);
			}).catch(() => {
				res.json({});
			});
		});

		this._router.post('/settings/save', (req, res) => {
			this._beameAdminServices.saveAppConfig(req.body).then(() => {
				res.json({success: true});
			}).catch(error => {
				res.json({success: false, error: BeameLogger.formatError(error)});
			});
		});
		//endregion

		//region creds

		this._router.post('/cred/create', (req, res) => {

			let data = req.body;

			logger.info(`Create pfx  with ${CommonUtils.data}`);

			function resolve(resp) {

				return res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					"responseDesc": resp.message,
					"data":         resp.data,
					"newFqdn":      resp.fqdn
				});
			}

			function sendError(e) {
				logger.error('/regtoken/create error', e);
				return res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			}

			beameAuthServices.createCred(data)
				.then(resolve)
				.catch(sendError);

		});

		this._router.post('/cred/user/create', (req, res) => {

			let data = req.body, responseMessage = null;

			logger.info(`Create user  with ${CommonUtils.data}`);

			function resolve() {

				return res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					"responseDesc": responseMessage.message,
					"data":         responseMessage.data,
					"newFqdn":      responseMessage.fqdn
				});
			}

			function sendError(e) {
				logger.error('/regtoken/user/create error', e);
				return res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			}

			beameAuthServices.createCred(data)
				.then(resp=>{
					responseMessage = resp;
					data.fqdn = resp.fqdn;
					return beameAuthServices.createUser(data);
				})
				.then(resolve)
				.catch(sendError);

		});

		this._router.get('/cred/detail/:fqdn', (req, res) => {

			let fqdn = req.params.fqdn;

			beameAuthServices.getCredDetail(fqdn).then(data => {
				res.json(data);
			}).catch(e => {
				console.error('/cred/detail/', e);
				res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			})
		});

		this._router.post('/regtoken/create', (req, res) => {

			let data = req.body;

			logger.info(`Create registration token  with ${CommonUtils.data}`);

			function resolve(resp) {
				return res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					"token":        resp.token,
					"data":         resp.data
				});
			}

			function sendError(e) {
				console.error('/regtoken/create error', e);
				return res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			}

			beameAuthServices.createRegToken(data)
				.then(resolve)
				.catch(sendError);

		});

		this._router.get('/creds/filter', (req, res) => {

			let parts = req.query.filter && req.query.filter.filters && req.query.filter.filters.length ? req.query.filter.filters[0].value : '';

			beameAuthServices.findCreds(parts).then(list => {
				res.json(list);
			})
		});

		this._router.get('/creds/list', (req, res) => {

			let parent  = req.query.fqdn,
			    options = req.query.options;

			beameAuthServices.credsList(parent, options).then(list => {
				res.json(list);
			}).catch(e => {
				console.error('/creds/list/', e);
				return res.json([]);
			})
		});

		this._router.get('/creds/reload', (req, res) => {

			BeameAuthServices.reloadStore().then(() => {
				res.json({
					"responseCode": RESPONSE_SUCCESS_CODE
				});
			}).catch(e => {
				console.error('/creds/reload/', e);
				res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			})
		});

		this._router.post('/cred/renew/:fqdn', (req, res) => {

			let fqdn = req.params.fqdn;

			beameAuthServices.renewCert(fqdn).then(data => {
				res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					"responseDesc": "Cert successfully renewed",
					data
				});
			}).catch(e => {
				console.error('/cred/renew/', e);
				res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			})
		});

		this._router.post('/cred/revoke/:fqdn', (req, res) => {

			let fqdn = req.params.fqdn;

			beameAuthServices.revokeCert(fqdn).then(data => {
				res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					"responseDesc": "Cert successfully revoked",
					data
				});
			}).catch(e => {
				console.error('/cred/renew/', e);
				res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			})
		});

		this._router.get('/cred/ocsp/:fqdn', (req, res) => {

			let fqdn = req.params.fqdn;

			beameAuthServices.checkOcsp(fqdn).then(resp => {
				res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					"data":         resp
				});
			}).catch(e => {
				logger.error('/dns/create', e);
				return res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			});

		});

		this._router.get('/cred/pfx/:fqdn', (req, res) => {

			let fqdn = req.params.fqdn;

			beameAuthServices.getPfx(fqdn).then(data => {
				res.writeHead(200, {
					'Content-Type':        'application/x-pkcs12',
					'Content-disposition': 'attachment;filename=' + (fqdn + '.pfx'),
					'Content-Length':      data.length
				});
				//res.write(new Buffer(token.pfx, 'binary'));
				res.end(data);
			}).catch(e => {
				res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			})
		});

		this._router.post('/cred/invite/:fqdn*?', (req, res) => {

			if (bootstrapper.registrationImageRequired) {
				return res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": 'Offline registration not allowed, when Required Image flag set to true'
				});
			}

			let data = req.body,
			    fqdn = req.params.fqdn || Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer);

			logger.info(`Save invitation  with ${CommonUtils.stringify(data)}`);

			const _resolve = (resp) => {
				return res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					"data":         resp
				});
			};

			const _sendError = (e) => {
				console.error(`/cred/invitation error ${fqdn}`, e);
				return res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			};

			this._getInvitation(fqdn, data, data.sendEmail)
				.then(_resolve)
				.catch(_sendError);

		});

		this._router.get('/cred/ios-profile/:fqdn', (req, res) => {

			let fqdn = req.params.fqdn;

			beameAuthServices.getIosProfile(fqdn).then(data => {
				res.writeHead(200, {
					'Content-Type':        'application/x-plist',
					'Content-disposition': `attachment;filename=${fqdn}.mobileconfig`,
					'Content-Length':      data.length
				});
				//res.write(new Buffer(token.pfx, 'binary'));
				res.end(data);
			}).catch(e => {
				res.send(BeameLogger.formatError(e));
			})
		});

		this._router.post('/cred/set-vpn/:action', (req, res) => {

			let fqdn       = req.body.fqdn,
			    name       = req.body.vpn_name,
			    id         = req.body.vpn_id,
			    createCred = req.body.createCred,
			    data       = CommonUtils.parse(req.body.cred),
			    action     = req.params.action;

			const _setVpn = (vpn_fqdn) => {

				beameAuthServices.setCredVpnStatus(vpn_fqdn, id, name, action).then(data => {
					res.json({
						"responseCode": RESPONSE_SUCCESS_CODE,
						data
					});
				}).catch(e => {
					res.json({
						"responseCode": RESPONSE_ERROR_CODE,
						"responseDesc": BeameLogger.formatError(e)
					});
				})
			};

			if (createCred) {
				data.fqdn = fqdn;
				beameAuthServices.createCred(data)
					.then(newCred => {
						_setVpn(newCred.fqdn);
					})
					.catch(err => {
						res.json({
							"responseCode": RESPONSE_ERROR_CODE,
							"responseDesc": BeameLogger.formatError(err)
						});
					})
			}
			else {
				_setVpn(fqdn);
			}
		});

		this._router.post('/send/pfx', (req, res) => {

			let fqdn  = req.body.fqdn,
			    email = req.body.email;

			beameAuthServices.sendPfx(fqdn, email).then(data => {
				res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					data
				});
			}).catch(e => {
				res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			})
		});

		this._router.post('/dns/create', (req, res) => {

			let body = req.body,
			    data = {
				    fqdn:     body.fqdn,
				    dnsFqdn:  body.dnsFqdn,
				    dnsValue: body.dnsValue
			    };

			beameAuthServices.saveDns(data).then(token => {
				res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					"responseDesc": token.message,
					"dnsValue":     token.value,
					"data":         token.data
				});
			}).catch(e => {
				logger.error('/dns/create', e);
				return res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			});

		});

		this._router.post('/dns/delete', (req, res) => {

			let body = req.body,
			    data = {
				    fqdn:    body.fqdn,
				    dnsFqdn: body.dnsFqdn
			    };

			beameAuthServices.deleteDns(data).then(token => {
				res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					"responseDesc": token.message,
					"data":         token.data
				});
			}).catch(e => {
				logger.error('/dns/create', e);
				return res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": BeameLogger.formatError(e)
				});
			});

		});

		this._router.get('/vpn/settings', (req, res) => {
			beameAuthServices.getVpnSettings().then(data => {
				res.json(data);
			})
		});
		//endregion

		//region grids actions
		//region user
		this._router.get('/user/list', (req, res) => {
			this._beameAdminServices.getUsers().then(
				array => {
					res.json(array);
				}
			).catch(array => {
				res.json(array);
			});
		});

		this._router.post('/user/update', (req, res) => {
			let user = req.body;
			this._beameAdminServices.updateUser(user).then(
				array => {
					res.json(array);
				}
			).catch(error => {
				res.status(400).send(error);
			});
		});
		//endregion

		//region registrations
		this._router.get('/registration/list', (req, res) => {
			this._beameAdminServices.getRegistrations().then(
				array => {
					res.json(array);
				}
			).catch(error => {
				logger.error(error);
				res.json([]);
			});
		});

		this._router.delete('/registration/destroy', (req, res) => {
			let data = req.body,
			    id   = parseInt(data.id);

			this._beameAdminServices.deleteRegistration(id).then(() => {
				res.status(200).json({});
			}).catch(error => {
				res.status(400).send(error);
			});

		});
		//endregion

		//region services
		this._router.get('/service/list', (req, res) => {
			this._beameAdminServices.getServices().then(
				array => {
					res.status(200).json(array);
				}
			).catch(error => {
				logger.error(error);
				res.json([]);
			});
		});

		this._router.post('/service/create', (req, res) => {
			let service = req.body;
			this._beameAdminServices.saveService(service).then(
				array => {
					res.status(200).json(array);
				}
			).catch(error => {
				res.status(400).send(error);
			});
		});

		this._router.post('/service/update', (req, res) => {
			let service = req.body;
			this._beameAdminServices.updateService(service).then(
				array => {
					res.status(200).json(array);
				}
			).catch(error => {
				res.status(400).send(error);
			});
		});

		this._router.post('/service/destroy', (req, res) => {
			let data = req.body,
			    id   = parseInt(data.id);

			this._beameAdminServices.deleteService(id).then(() => {
				res.status(200).json({});
			}).catch(error => {
				res.status(400).send(error);
			});

		});
		//endregion

		//region gk logins
		this._router.get('/login/list', (req, res) => {
			centralLoginServices.getGkLogins().then(
				array => {
					res.status(200).json(array);
				}
			).catch(error => {
				logger.error(error);
				res.json([]);
			});
		});

		this._router.post('/login/create', (req, res) => {
			let login = req.body;
			centralLoginServices.saveGkLogin(login).then(
				array => {
					res.status(200).json(array);
				}
			).catch(error => {
				res.status(400).send(error);
			});
		});

		this._router.post('/login/update', (req, res) => {
			let login = req.body;
			centralLoginServices.updateGkLogin(login).then(
				array => {
					res.status(200).json(array);
				}
			).catch(error => {
				res.status(400).send(error);
			});
		});

		this._router.post('/login/destroy', (req, res) => {
			let data = req.body;

			centralLoginServices.deleteGkLogin(data).then(() => {
				res.status(200).json({});
			}).catch(error => {
				res.status(400).send(error);
			});

		});
		//endregion

		//region invitations
		this._router.get('/invitation/list', (req, res) => {
			beameAuthServices.getInvitations().then(
				array => {
					res.json(array);
				}
			).catch(error => {
				logger.error(error);
				res.json([]);
			});
		});

		this._router.post('/invitation/send', (req, res) => {

			if (bootstrapper.registrationImageRequired) {
				return res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": 'Offline registration not allowed, when Required Image flag set to true'
				});
			}

			let data = req.body;

			logger.info(`Save invitation  with ${CommonUtils.stringify(data)}`);

			function resolve() {
				return res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					"responseDesc": `Invitation sent`
				});
			}

			function sendError(e) {
				console.error('/invitation/send error', e);
				return res.json({
					"responseCode": RESPONSE_ERROR_CODE,
					"responseDesc": e
				});
			}

			this._sendInvitation(data)
				.then(resolve)
				.catch(sendError);

		});

		this._router.post("/invitation/upload", (req, res) => {

			if (bootstrapper.registrationImageRequired) {
				res.sendFile(path.join(base_path, 'offline_reg_forbidden.html'));
				return;
			}

			const fs         = require('fs');
			const formidable = require('formidable');


			let form = new formidable.IncomingForm();

			form.parse(req, (err, fields, files) => {

				const parse          = require('csv-parse');
				let totalRows        = 0,
				      invitationSend = 0,
				      totalInvalid   = 0,
				      csvData        = [],
				      resultCsvData  = [];
				try {
					fs.createReadStream(files.csvdata.path)
						.pipe(parse({delimiter: ','}))
						.on('data', csvrow => {

							totalRows++;

							if (csvrow.length != 3) {
								resultCsvData.push(csvrow.concat([RESPONSE_ERROR_CODE, 'invalid row format']));
								totalInvalid++;
							}
							else {
								csvData.push({
									name:    csvrow[0],
									email:   csvrow[1],
									user_id: csvrow[2]
								})
							}

						})
						.on('end', () => {

							const async = require('async');

							const handler = (item, cb) => {
								let csvrow = [item.name, item.email, item.user_id];

								this._sendInvitation(item).then(
									() => {
										invitationSend++;
										resultCsvData.push(csvrow.concat([RESPONSE_SUCCESS_CODE]));
										cb();
									}).catch((err) => {
										resultCsvData.push(csvrow.concat([RESPONSE_ERROR_CODE, BeameLogger.formatError(err).replace(',', ';')]));
										totalInvalid++;
										cb();
									}
								);
							};

							const finalCallback = (responseCsv) => {

								const csv = require('express-csv');

								res.setHeader('Content-disposition', `attachment; filename=${CommonUtils.timeStampShort()}_upload_result.csv`);
								res.set('Content-Type', 'application/octet-stream');
								res.clearCookie('fileDownloadToken');
								res.csv(responseCsv);

							};

							async.each(csvData, handler, finalCallback.bind(null, resultCsvData));

						});
				} catch (e) {
					res.status(500).send(e);
				}

			});
		});

		this._router.delete('/invitation/destroy', (req, res) => {
			let data   = req.body,
			    id     = parseInt(data.id),
			    reg_id = parseInt(data.reg_id),
			    fqdn   = data.fqdn;

			beameAuthServices.deleteInvitation(id, fqdn)
				.then(this._beameAdminServices.deleteRegistration.bind(this, reg_id))
				.then(() => {
					res.status(200).json({});
				}).catch(error => {
				res.status(400).send(error);
			});

		});
		//endregion
		//endregion
	}

	_sendInvitation(data) {
		return new Promise((resolve, reject) => {
				this._encryptUserData(data).then((encryptedData) => {
					let data4hash = {email: encryptedData.email || 'email', user_id: encryptedData.user_id || 'user_id'};
					encryptedData.hash     = CommonUtils.generateDigest(data4hash);

					let method = bootstrapper.registrationMethod;

					beameAuthServices.sendCustomerInvitation(method, encryptedData, null, true).then(pincode => {
						encryptedData.pin = pincode;
						resolve(encryptedData);
					}).catch(reject);

				}).catch(reject);
			}
		);
	}

	_getInvitation(fqdn, data, sendByEmail) {
		return new Promise((resolve, reject) => {
			this._encryptUserData(data).then((encryptedData) => {
				let data4hash = {email: encryptedData.email || 'email', user_id: encryptedData.user_id || 'user_id'};
				encryptedData.hash     = CommonUtils.generateDigest(data4hash);

				beameAuthServices.getInvitationForCred(fqdn, encryptedData, sendByEmail).then(resolve).catch(reject);
			}).catch(reject);
		});
	}

	_encryptUserData(data) {
		return new Promise((resolve, reject) => {
				if (bootstrapper.encryptUserData) {

					BeameStore.find(Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer)).then(cred => {

						let data2encrypt = CommonUtils.stringify(data, false);//TODO - check final length to be < 214 bytes if QR is overloaded
						data.user_id     = cred.encryptWithRSA(data2encrypt);
						resolve(data);

					}).catch(function (e) {
						let errMsg = `Failed to encrypt user_id ${e.message}`;
						logger.error(errMsg);
						reject(errMsg)
					});
				}
				else {
					resolve(data);
				}
			}
		);
	}

	get router() {
		return this._router;
	}
}

module.exports = AdminRouter;