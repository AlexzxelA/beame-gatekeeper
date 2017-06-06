/**
 * Created by zenit1 on 16/10/2016.
 */
"use strict";

const path    = require('path');
const express = require('express');
const router  = express.Router();

const beameSDK          = require('beame-sdk');
const store             = new (beameSDK.BeameStore)();
const crypto            = require('crypto');
const CommonUtils       = beameSDK.CommonUtils;
const module_name       = "BeameAuthRouter";
const BeameLogger       = beameSDK.Logger;
const logger            = new BeameLogger(module_name);
const Bootstrapper      = require('../bootstrapper');
const bootstrapper      = Bootstrapper.getInstance();
const Constants         = require('../../constants');
const cookieNames       = Constants.CookieNames;
const public_dir        = path.join(__dirname, '..', '..', process.env.BEAME_INSTA_DOC_ROOT);
const base_path         = path.join(public_dir, 'pages', 'login_manager');
const BeameAuthServices = require('../authServices');
const utils             = require('../utils');
const gwServerFqdn      = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);

function assertValidCertMiddleware(req, res, next) {

	try {
		//noinspection JSUnresolvedFunction,JSUnresolvedVariable
		let cert    = req.connection.getPeerCertificate(),
		    subject = cert ? cert.subject : null,
		    fqdn    = subject ? subject.CN : null;

		if (!cert) {
			res.status(403).end('Cert required');
			return;
		}

		store.find(fqdn, true).then(cred => {

			BeameAuthServices.loginUser(cred.fqdn).then(user => {
				req.beame_user = user;
				next();
			}).catch(error => {
				res.status(403).end(`${BeameLogger.formatError(error)}`);
			});


		}).catch(e => {
			res.status(403).end(BeameLogger.formatError(e));
		});


	}
	catch (e) {
		logger.error(e);
		res.status(403).end('400');
	}

}

router.use(assertValidCertMiddleware);


router.get('/', (req, res) => {
	res.cookie(cookieNames.Service, CommonUtils.stringify(bootstrapper.appData));
	let user = req.beame_user;
	res.cookie(cookieNames.UserInfo, CommonUtils.stringify({name: user.name}));
	res.cookie(cookieNames.Logout, JSON.stringify({url: `https://${gwServerFqdn}${Constants.ClientLogoutPath}`}));
	res.sendFile(path.join(base_path, 'index.html'));
});

router.get('/apps/get/:app_id*?', (req, res) => {

	const serviceManager = (require('../serviceManager')).getInstance();

	let app_id = req.params.app_id,
	    user   = req.beame_user;

	if (!app_id) {
		//get list
		if (!user) {
			res.json([]);
			return;
		}

		serviceManager.listApplications(user).then(list => {
			list = utils.hashToArray(CommonUtils.filterHash(list, (k, v) => v.mobile === false));
			res.json(list);
		}).catch(() => {
			res.json([]);
		});
	}
	else {
		//chose app

		const makeProxyEnablingToken = () => {
			return utils.createAuthTokenByFqdn(
				gwServerFqdn,
				JSON.stringify({app_id: app_id, isAdmin: !!user.isAdmin}),
				bootstrapper.proxySessionTtl
			);
		};

		const respond = (token) => {
			return new Promise(() => {
				const url = `https://${gwServerFqdn}/beame-gw/choose-app?proxy_enable=${encodeURIComponent(token)}`;
				logger.debug(`respond() URL is ${url}`);

				let app = serviceManager.getAppById(app_id);
				if(app.code && app.code.includes('_saml_')){
					utils.produceSAMLresponse(user, {app_code: app.code}, null, function (response) {
						res.json(response);
					});
					//TODO add saml logic
				}
				else {
					res.json({
						type:    'redirect',
						payload: {
							success:  true,
							app_id:   app_id,
							url:      url,
							external: app.external,
							mobile:   app.mobile
						}
					});
				}
			});
		};

		makeProxyEnablingToken()
			.then(respond)
			.catch(e => {
				res.status(500).send(BeameLogger.formatError(e));
			})

	}


});

module.exports = {
	router
};
