/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const path    = require('path');
const express = require('express');


const beameSDK     = require('beame-sdk');
const store        = new (beameSDK.BeameStore)();
const crypto       = require('crypto');
const CommonUtils  = beameSDK.CommonUtils;
const module_name  = "BeameAuthRouter";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const Bootstrapper = require('../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();
const Constants    = require('../../constants');
const cookieNames  = Constants.CookieNames;
const public_dir   = path.join(__dirname, '..', '..', process.env.BEAME_INSTA_DOC_ROOT);
const base_path    = path.join(public_dir, 'pages', 'beame_auth');


const sns = new (require("../servers/beame_auth/sns"))();


function onRequestError(res, error, code) {
	logger.error(`authorization error ${BeameLogger.formatError(error)}`);
	res.status(code || 500).send(error);
}

class BeameAuthRouter {
	constructor(authServices) {

		this._beameAdminServices = authServices;

		this._router = express.Router();

		this._router.use((req,res,next) => {
			if(/approve\/[a-z]/.test(req.url)){
				req.url = req.url.replace('/customer-approve/','/');
			}


			next();
		});


		this._initRoutes();
	}


	_initRoutes() {

		this._router.get('/customer-approve', (req, res) => {

			this._isRequestValid(req).then( data => {

				let url = Bootstrapper.getLogoutUrl();

				res.cookie(cookieNames.Logout, url);
				res.cookie(cookieNames.Service, CommonUtils.stringify(bootstrapper.appData));
				res.cookie(cookieNames.RegData, CommonUtils.stringify(data));

				res.sendFile(path.join(base_path, 'client_approval.html'));
			}).catch(error => {
				logger.error(BeameLogger.formatError(error));
				res.redirect(Bootstrapper.getLogoutUrl())
			});
		});

		this._router.get('/cred-info', (req, res) => {
			this._beameAdminServices.getRequestAuthToken(req, true).then(token => {
				let authFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer);
				store.verifyAncestry(authFqdn, token.signedBy, authFqdn, 99, (err, status) =>{
					if(status){
						store.find(token.signedBy, true, true).then(cred=>{
							res.json({
								ocspUrl:cred.certData.issuer.issuerOcspUrl,
								notAfter:Date.parse(cred.certData.notAfter)/1000,
								notBefore:Date.parse(cred.certData.notBefore)/1000,
								success: true
							});
						}).catch(e=>{
							res.json({success: false, msg: e});
						});
					}
					else{
						res.json({success: false, msg: 'not allowed'});
					}
				}, true, true);

			}).catch(e => {
				res.status(401).send();
				logger.error(e);
			});
		});

		this._router.get('/cert-renew', (req, res) => {
			this._beameAdminServices.getRequestAuthToken(req, true).then(token => {
				let authFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer);
				store.verifyAncestry(authFqdn, token.signedBy, authFqdn, 99, (err, status) =>{
					if(status){
						const AuthToken = beameSDK.AuthToken;
						store.find(authFqdn, true, true).then(parentCred=>{
							AuthToken.createAsync(token.signedBy,
								parentCred, 60 * 60 * 2).then(authToken => {
								res.json({
									regToken:authToken,
									success: true
								});
							}).catch(e=>{
								res.json({success: false, msg: e || 'GK: failed to create token'});
							});

						}).catch(e=>{
							res.json({success: false, msg: e || 'GK: parent cred'});
						});
					}
					else{
						res.json({success: false, msg: 'GK: not allowed'});
					}
				}, true);

			}).catch(e => {
				res.json({success: false, msg: 'GK: auth token'});
				logger.error(e);
			});
		});

		this._router.get('/', (req, res) => {

			this._isRequestValid(req).then(data => {
				this._beameAdminServices.saveSession(data);

				let url = Bootstrapper.getLogoutUrl();

				res.cookie(cookieNames.Logout, url);
				res.cookie(cookieNames.Service, CommonUtils.stringify(bootstrapper.appData));
				res.cookie(cookieNames.RegData, CommonUtils.stringify(data));

				res.sendFile(path.join(base_path, 'signup.html'));
			}).catch(error => {
				logger.error(BeameLogger.formatError(error));
				res.redirect(Bootstrapper.getLogoutUrl())
			});
		});

		//region not in use
		this._router.post('/client/dataout', function (req, res) {
			let body_array = [];
			req.on('data', (chunk) => {
				body_array.push(chunk);
			});
			req.on('end', () => {
				let rawData = body_array.join('');
				logger.debug('sns message received bytes: ', rawData.byteLength);
				let parsedData = CommonUtils.parse(rawData);
				if(parsedData.signedData && parsedData.signature && parsedData.signedBy){
					store.find(parsedData.signedBy, true).then(cred => {
						if (!cred) {
							onRequestError(res, 'Invalid credential', 401);
						}
						else{
							let decrypted = (cred.decrypt(parsedData));
							if(decrypted)
							{
								res.json(decrypted);
							}
							else {
								onRequestError(res, 'Pic decrypt failed', 401);
							}
						}

					}).catch(e => {
						onRequestError(res,`Credential not found`, 401);
					});
				}
			});
		});

		this._router.post('/client/datain', function (req, res) {
			let body_array = [];
			req.on('data', (chunk) => {
				body_array.push(chunk);
			});
			req.on('end', () => {
				let rawData = body_array.join('');
				logger.debug('sns message received bytes: ', rawData.byteLength);
				let parsedData = CommonUtils.parse(rawData);
				if(parsedData.signedData && parsedData.signature && parsedData.signedBy){
					store.find(parsedData.signedBy, true).then(cred => {
						if (!cred) {
							onRequestError(res, 'Invalid credential', 401);
						}
						else{
							if(cred.checkSignature(parsedData)){
								let selfCred = Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer);
								let dataPack = selfCred.encrypt(selfCred, parsedData.signedData, selfCred);
								res.json(dataPack);
							}
							else {
								onRequestError(res, 'Signature verification failed', 401);
							}
						}

					}).catch(e => {
						onRequestError(res,`Credential not found`, 401);
					});
				}
			});
		});
		//endregion

		this._router.post('/sns', function (req, res) {
			let body_array = [];
			req.on('data', (chunk) => {
				body_array.push(chunk);
			});
			req.on('end', () => {
				let msg = body_array.join('');
				logger.debug('sns message received', msg);
				sns.parseSnsMessage(CommonUtils.parse(msg)).then(() => {
					res.sendStatus(200);
				});
			});
		});

		//still not implemented
		this._router.route('/node/auth/register')
			.post((req, res) => {

					this._beameAdminServices.getRequestAuthToken(req).then(authToken => {
						let metadata = req.body;
						this._beameAdminServices.authorizeEntity(metadata, authToken, req.get("X-BeameUserAgent")).then(payload => {
							res.json(payload);
						}).catch(onRequestError.bind(null, res));

					}).catch(error => {
						onRequestError(res, error, 401);
					});
				}
			);

		this._router.get('/certs/:fqdn', function (req, res) {
			const BeameStore = new beameSDK.BeameStore();
			BeameStore.find(req.params.fqdn, false).then(cred => {
				res.set('Content-Type', 'application/x-pem-file');
				res.send(cred.getKey("X509"));
			}).catch(e => {
				logger.error(e);
				res.status(404);
				// Not sending this as it might be security issue: res.json(e);
				res.set('Content-Type', 'text/plain');
				res.send('Not found\n');
			});
		});
	}

	/**
	 * @param req
	 * @returns {Promise.<RegistrationData>}
	 * @private
	 */
	_isRequestValid(req) {
		let encryptedMessage = req.query && req.query["data"];

		return encryptedMessage ? this._beameAdminServices.validateRegistrationToken(encryptedMessage) : Promise.reject(`auth token required`);
	}

	get router() {
		return this._router;
	}

}

module.exports = BeameAuthRouter;