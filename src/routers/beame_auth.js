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
const CommonUtils  = beameSDK.CommonUtils;


const public_dir = path.join(__dirname, '..', '..', 'public');
const base_path  = path.join(public_dir, 'pages', 'beame_auth');

const sns          = new (require("../servers/beame_auth/sns"))();


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

		this._router.post('/sns', function (req, res) {
			let body_array = [];
			req.on('data', (chunk) => {
				body_array.push(chunk);
			});
			req.on('end', () => {
				let msg = body_array.join('');
				logger.debug('sns message received', msg);
				sns.parseSnsMessage(CommonUtils.parse(msg)).then(()=> {
					res.sendStatus(200);
				});
			});
		});

		this._router.get('/certs/:fqdn', function (req, res) {
			const BeameStore = new beameSDK.BeameStore();
			BeameStore.find(req.params.fqdn, false).then(cred => {
				res.set('Content-Type', 'application/x-pem-file');
				res.send(cred.getKey("X509"));
			}).catch(e => {
				res.status(404);
				// Not sending this as it might be security issue: res.json(e);
				res.set('Content-Type', 'text/plain');
				res.send('Not found\n');
			});
		});
	}

	get router() {
		return this._router;
	}

}

module.exports = BeameAuthRouter;