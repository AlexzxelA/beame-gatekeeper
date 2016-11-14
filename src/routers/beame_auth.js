/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const path    = require('path');
const express = require('express');


const beameSDK    = require('beame-sdk');
const module_name = "BeameAuthRouter";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);


const public_dir = path.join(__dirname, '..', '..', 'public');
const base_path  = path.join(public_dir, 'pages', 'beame_auth');

function onRequestError(res, error, code) {
	logger.error(`authorization error ${BeameLogger.formatError(error)}`);
	res.status(code || 500).send(error);
}

class BeameAuthRouter {
	constructor(authServices) {
		this._authServices = authServices;

		this._router = express.Router();

		this._router.get('/', (req, res) => {
			res.sendFile(path.join(base_path, 'signup.html'));
		});

		this._router.route('/node/auth/register')
			.post((req, res) => {

					this._authServices.getRequestAuthToken(req).then(authToken => {
						let metadata = req.body;
						this._authServices.authorizeEntity(metadata, authToken, req.get("X-BeameUserAgent")).then(payload => {
							res.json(payload);
						}).catch(onRequestError.bind(null, res));

					}).catch(error => {
						onRequestError(res, error, 401);
					});
				}
			);
	}

	get router() {
		return this._router;
	}

}

module.exports = BeameAuthRouter;