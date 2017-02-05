/**
 * Created by zenit1 on 13/11/2016.
 */

"use strict";

const path    = require('path');
const express = require('express');

const Constants  = require('../../constants');
const public_dir = path.join(__dirname, '..', '..', Constants.WebRootFolder);
const base_path  = path.join(public_dir, 'pages', 'admin');

const beameSDK    = require('beame-sdk');
const CommonUtils = beameSDK.CommonUtils;
const module_name = "BeameAdminServices";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const Bootstrapper = require('../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();

class AdminRouter {
	constructor(adminServices) {
		this._beameAuthServices = adminServices;

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
			this._beameAuthServices.getSettings().then(data => {
				res.json(data);
			}).catch(() => {
				res.json({});
			});
		});

		this._router.post('/settings/save', (req, res) => {
			this._beameAuthServices.saveAppConfig(req.body).then(() => {
				res.json({success: true});
			}).catch(error => {
				res.json({success: false, error: BeameLogger.formatError(error)});
			});
		});
		//endregion

		//region grids actions
		//region user
		this._router.get('/user/list', (req, res) => {
			this._beameAuthServices.getUsers().then(
				array => {
					res.json(array);
				}
			).catch(array => {
				res.json(array);
			});
		});

		this._router.post('/user/update', (req, res) => {
			let user = req.body;
			this._beameAuthServices.updateUser(user).then(
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
			this._beameAuthServices.getRegistrations().then(
				array => {
					res.json(array);
				}
			).catch(error => {
				logger.error(error);
				res.json([]);
			});
		});

		this._router.post('/registration/destroy', (req, res) => {
			let data = req.body,
			    id   = parseInt(data.id);

			this._beameAuthServices.deleteRegistration(id).then(() => {
				res.status(200).json({});
			}).catch(error => {
				res.status(400).send(error);
			});

		});
		//endregion

		//region services
		this._router.get('/service/list', (req, res) => {
			this._beameAuthServices.getServices().then(
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
			this._beameAuthServices.saveService(service).then(
				array => {
					res.status(200).json(array);
				}
			).catch(error => {
				res.status(400).send(error);
			});
		});

		this._router.post('/service/update', (req, res) => {
			let service = req.body;
			this._beameAuthServices.updateService(service).then(
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

			this._beameAuthServices.deleteService(id).then(() => {
				res.status(200).json({});
			}).catch(error => {
				res.status(400).send(error);
			});

		});
		//endregion

		//region invitations
		this._router.post('/invitation/send', (req, res) => {

			let data = req.body;

			logger.info(`Save invitation  with ${CommonUtils.data}`);

			//for use in email or sms scenario
			let data4hash = {email:data.email || 'email',user_id:data.user_id || 'user_id'};
			data.hash = CommonUtils.generateDigest(data4hash);

			//TODO to POST
			const beameAuthServices = require('../authServices').getInstance();

			let method = null;

			function selectRegistrationMethod() {

				return new Promise((resolve, reject) => {
						method = bootstrapper.registrationMethod;

						switch (method) {
							case Constants.RegistrationMethod.Email:
							case Constants.RegistrationMethod.SMS:
								beameAuthServices.sendCustomerInvitation(method,data).then(pincode => {
									data.pin = pincode;
									resolve();
								}).catch(reject);
								return;
							default:
								reject(`Unknown registration method`);
								return;
						}
					}
				);
			}

			function resolve(){
				return res.json({
					"responseCode": 0,
					"responseDesc": `Invitation sent to ${method == Constants.RegistrationMethod.Email ? 'email' : 'phone'}`
				});
			}

			function sendError(e) {
				console.error('/invitation/send error', e);
				return res.json({
					"responseCode": 1,
					"responseDesc": e
				});
			}

			selectRegistrationMethod()
				.then(resolve)
				.catch(sendError);

		});

		this._router.post("/upload/data", function(req, res) {
			const csv = require("csv");
			var formidable = require('formidable');


			var form = new formidable.IncomingForm();

			form.parse(req, function(err, fields, files) {
				res.writeHead(200, {'content-type': 'text/plain'});
				res.write('received upload:\n\n');
				//res.end(util.inspect({fields: fields, files: files}));
			});
		});
		//endregion

		//endregion
	}

	get router() {
		return this._router;
	}
}


module.exports = AdminRouter;