const path = require('path');

const express    = require('express');
const bodyParser = require('body-parser');

const Bootstrapper = require('../../bootstrapper');
const Constants    = require('../../../constants');
const beameSDK     = require('beame-sdk');
const BeameStore   = new beameSDK.BeameStore();

const public_dir = path.join(__dirname, '..', '..', '..', 'public');
const base_path  = path.join(public_dir, 'pages', 'gw');

const utils         = require('../../utils');
const cust_auth_app = require('../../routers/customer_auth');

const unauthenticatedApp = express();

// TODO: refactor - start

unauthenticatedApp.use(express.static(base_path, {index: 'welcome.html'}));
unauthenticatedApp.get('/signin', (req, res) => {
	res.sendFile(path.join(base_path, 'signin.html'));
});
utils.setExpressAppCommonRoutes(unauthenticatedApp);

unauthenticatedApp.use(bodyParser.json());
unauthenticatedApp.use(bodyParser.urlencoded({extended: false}));

unauthenticatedApp.post('/customer-auth-done', (req, res) => {
	console.log('/customer-auth-done', req.body.encryptedUserData);

	function assertGoodSignedBy(customerAuthServersFqdns) {
		return new Promise((resolve, reject) => {
			if(customerAuthServersFqdns.indexOf(req.body.encryptedUserData.signedBy) != -1) {
				resolve();
			} else {
				reject(`Signed by unauthorized fqdn: ${req.body.encryptedUserData.signedBy}. Should be one of ${customerAuthServersFqdns.join(',')}`);
			}
		});
	};

	function getDecryptingCredentials() {
		var gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
		return new Promise((resolve, reject) => {
			BeameStore.find(gwServerFqdn, false).then(decryptingCred => {
				resolve(decryptingCred);
			}).catch(() => {
				reject(`Failed getting decrypting credential ${gwServerFqdn}`);
			});
		});
	};

	function decrypt(decryptingCred) {
		return new Promise((resolve, reject) => {
			// CONTINUE HERE
		});
	};

	// TODO: get signing token, validate signature, decrypt user data, encrypt user data for auth server, send URL to GW server for proxying to beame authorization server

	Bootstrapper.listCustomerAuthServers()
		.then(assertGoodSignedBy)
		.then(getDecryptingCredentials)
		.then(decrypt)
		.catch((e) => {
			console.error('/customer-auth-done error', e);
		});
});

// Customer authorization app - start
unauthenticatedApp.use(cust_auth_app);
// Customer authorization app - end

// TODO: refactor - end

module.exports = unauthenticatedApp;
