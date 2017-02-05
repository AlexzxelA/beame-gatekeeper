/**
 * Created by zenit1 on 13/11/2016.
 */

"use strict";

const path    = require('path');
const express = require('express');

const Constants  = require('../../constants');
const public_dir            = path.join(__dirname, '..', '..', Constants.WebRootFolder);
const base_path           = path.join(public_dir, 'pages', 'admin');

const beameSDK          = require('beame-sdk');
const CommonUtils       = beameSDK.CommonUtils;
const module_name       = "BeameAdminServices";
const BeameLogger       = beameSDK.Logger;
const logger            = new BeameLogger(module_name);
const Bootstrapper      = require('../bootstrapper');
const bootstrapper      = Bootstrapper.getInstance();
const beameAuthServices = require('../authServices').getInstance();

const RESPONSE_SUCCESS_CODE = 1;
const RESPONSE_ERROR_CODE = 0;

class AdminRouter {
	constructor(adminServices) {
		this._beameAdminServices = adminServices;

		this._router = express.Router();

		this._initRoutes();
	}

	_initRoutes() {
		//region static
		this._router.get('/', (req, res) => {

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

		//region Registration token
		this._router.get('/creds/filter', (req, res) => {

			let parts = req.query.filter.filters[0].value;

			beameAuthServices.findCreds(parts).then(list=>{
				res.json(list);
			})
		});

		this._router.post('/regtoken/create', (req, res) => {

			let data = req.body;

			logger.info(`Create registration token  with ${CommonUtils.data}`);

			function resolve(token) {
				return res.json({
					"responseCode": RESPONSE_SUCCESS_CODE,
					"token": token
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

			let data = req.body;

			logger.info(`Save invitation  with ${CommonUtils.data}`);

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

			const fs         = require('fs');
			const formidable = require('formidable');


			var form = new formidable.IncomingForm();

			form.parse(req, (err, fields, files) => {

				const parse          = require('csv-parse');
				let totalRows        = 0,
				      invitationSend = 0,
				      totalInvalid   = 0,
				      csvData        = [],
					  resultCsvData =[];
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
								let csvrow = [item.name,item.email,item.user_id];

								this._sendInvitation(item).then(
									() => {
										invitationSend++;
										resultCsvData.push(csvrow.concat([RESPONSE_SUCCESS_CODE]));
										cb();
									}).catch((err) => {
										resultCsvData.push(csvrow.concat([RESPONSE_ERROR_CODE, BeameLogger.formatError(err).replace(',',';')]));
										totalInvalid++;
										cb();
									}
								);
							};

							const finalCallback = (responseCsv) => {

								const csv = require('express-csv');

								res.setHeader('Content-disposition', `attachment; filename=${CommonUtils.timeStampShort()}_upload_result.csv`);
								res.set('Content-Type', 'application/octet-stream');
								res.csv(responseCsv);

							};

							async.each(csvData, handler, finalCallback.bind(null,resultCsvData));

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
				let data4hash = {email: data.email || 'email', user_id: data.user_id || 'user_id'};
				data.hash     = CommonUtils.generateDigest(data4hash);

				let method = bootstrapper.registrationMethod;

				switch (method) {
					case Constants.RegistrationMethod.Email:
					case Constants.RegistrationMethod.SMS:
						beameAuthServices.sendCustomerInvitation(method, data, null, true).then(pincode => {
							data.pin = pincode;
							resolve();
						}).catch(reject);
						return;
					default:
						reject(`${method} registration method not supports offline registrations`);
						return;
				}
			}
		);
	}

	get router() {
		return this._router;
	}
}


module.exports = AdminRouter;