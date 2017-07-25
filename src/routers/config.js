/**
 * Created by zenit1 on 17/07/2017.
 */
"use strict";

const path    = require('path');
const express = require('express');

const public_dir = path.join(__dirname, '..', '..', process.env.BEAME_INSTA_DOC_ROOT);
const base_path  = path.join(public_dir, 'pages', 'config');

const beameSDK    = require('beame-sdk');
const module_name = "BeameAdminServices";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const BeameAdminServices = require('../servers/admin/admin_services');

class ConfigRouter {
	constructor(adminServices) {
		this._beameAdminServices = adminServices;

		this._router = express.Router();

		this._initRoutes();

		logger.info('Config router created');
	}

	_initRoutes() {

		this._router.get('/', (req, res) => {
			res.sendFile(path.join(base_path, 'index.html'));
		});

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

		this._router.post('/db-provider/save', (req, res) => {
			this._beameAdminServices.saveDbConfig(req.body).then(() => {
				res.json({success: true});
			}).catch(error => {
				res.json({success: false, error: BeameLogger.formatError(error)});
			});
		});

		this._router.post('/proxy/save', (req, res) => {
			this._beameAdminServices.saveProxyConfig(req.body.data).then(() => {
				res.json({success: true});
			}).catch(error => {
				res.json({success: false, error: BeameLogger.formatError(error)});
			});
		});

		//region provision config
		this._router.get('/provision/config/list', (req, res) => {

			BeameAdminServices.getProvisionSettings().then(data => {
				res.json(data);
			}).catch(() => {
				res.json({});
			});
		});

		this._router.post('/provision/config/update', (req, res) => {
			let models = req.body.models;
			this._beameAdminServices.saveProvisionSettings(models).then(d => {
				res.json(d);
			}).catch(e => {
				logger.error(e);
				res.json({});
			})
		});
		//endregion

		// region roles
		this._router.get('/role/list', (req, res) => {
			this._beameAdminServices.getRoles().then(
				array => {
					res.status(200).json(array);
				}
			).catch(error => {
				logger.error(error);
				res.json([]);
			});
		});

		this._router.post('/role/create', (req, res) => {
			let role = req.body;
			this._beameAdminServices.saveRole(role).then(
				array => {
					res.status(200).json(array);
				}
			).catch(error => {
				res.status(400).send(error);
			});
		});

		this._router.post('/role/update', (req, res) => {
			let role = req.body;
			this._beameAdminServices.updateRole(role).then(
				array => {
					res.status(200).json(array);
				}
			).catch(error => {
				res.status(400).send(error);
			});
		});

		this._router.post('/role/destroy', (req, res) => {
			let data = req.body,
			    id   = parseInt(data.id);

			this._beameAdminServices.deleteRole(id).then(() => {
				res.status(200).json({});
			}).catch(error => {
				res.status(400).send(error);
			});

		});
		//endregion
	}

	get router() {
		return this._router;
	}
}

module.exports = ConfigRouter;