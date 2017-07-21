/**
 * Created by zenit1 on 17/07/2017.
 */
"use strict";

const path    = require('path');
const express = require('express');

const public_dir = path.join(__dirname, '..', '..', process.env.BEAME_INSTA_DOC_ROOT);
const base_path  = path.join(public_dir, 'pages', 'config');

const beameSDK     = require('beame-sdk');
const module_name  = "BeameAdminServices";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);

const BeameAdminServices = require('../servers/admin/admin_services');

class ConfigRouter {
	constructor(adminServices) {
		this._beameAdminServices = adminServices;

		this._router = express.Router();

		this._initRoutes();

		logger.info('Config router created');
	}

	_initRoutes(){

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
	}

	get router() {
		return this._router;
	}
}

module.exports = ConfigRouter;