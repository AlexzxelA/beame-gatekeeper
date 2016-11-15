const path = require('path');

const express    = require('express');
const bodyParser = require('body-parser');

const Bootstrapper = require('../../bootstrapper');
const Constants    = require('../../../constants');
const beameSDK     = require('beame-sdk');
const BeameStore   = new beameSDK.BeameStore();
const AuthToken    = beameSDK.AuthToken;

const public_dir = path.join(__dirname, '..', '..', '..', 'public');
const base_path  = path.join(public_dir, 'pages', 'gw');

const utils         = require('../../utils');
const cust_auth_app = require('../../routers/customer_auth');

const unauthenticatedApp = express();

unauthenticatedApp.use(express.static(base_path, {index: 'welcome.html'}));
unauthenticatedApp.get('/signin', (req, res) => {
	res.sendFile(path.join(base_path, 'signin.html'));
});
utils.setExpressAppCommonRoutes(unauthenticatedApp);

unauthenticatedApp.use(bodyParser.json());
unauthenticatedApp.use(bodyParser.urlencoded({extended: false}));

unauthenticatedApp.post('/customer-auth-done', (req, res) => {
	console.log('/customer-auth-done', req.body.encryptedUserData);

	const beameAuthServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer);
	console.log('beameAuthServerFqdn', beameAuthServerFqdn);
	const gwServerFqdn = Bootstrapper.getCredFqdn(Constants.CredentialType.GatewayServer);
	let gwServerCredentials;

	function assertGoodSignedBy(customerAuthServersFqdns) {
		return new Promise((resolve, reject) => {
			if(customerAuthServersFqdns.indexOf(req.body.encryptedUserData.signedBy) != -1) {
				resolve();
			} else {
				reject(`Signed by unauthorized fqdn: ${req.body.encryptedUserData.signedBy}. Should be one of ${customerAuthServersFqdns.join(',')}`);
			}
		});
	};

	function getGwServerCredentials() {
		return new Promise((resolve, reject) => {
			BeameStore.find(gwServerFqdn, false).then(gwServerCredentials_ => {
				resolve(gwServerCredentials_);
				gwServerCredentials = gwServerCredentials_;
			}).catch(() => {
				reject(`Failed getting decrypting credential ${gwServerFqdn}`);
			});
		});
	};

	function parseJson(json) {
		return new Promise((resolve, reject) => {
			try {
				resolve(JSON.parse(json));
			} catch(e) {
				reject(`Failed to parse JSON: ${e}`);
			}
		});
	}

	function decrypt(decryptingCred) {
		return new Promise((resolve, reject) => {
			let payload = decryptingCred.decrypt(req.body.encryptedUserData);
			if (!payload) {
				reject('unauthenticatedApp/customer-auth-done/decrypt() failed');
			}
			console.log('TRACE: Decrypted payload', payload);
			resolve(payload);
		});
	};

	function getEncryptToCred(decryptedData) {
		return new Promise((resolve, reject) => {
			BeameStore.find(beameAuthServerFqdn, false).then(encryptToCred => {
				resolve([decryptedData, encryptToCred]);
			}).catch(() => {
				reject(`Failed getting encrypt-to credential ${beameAuthServerFqdn}`);
			});
		});
	}

	function replyWithUrl([decryptedData, encryptToCred]) {
		// console.log('replyWithUrl decryptedData', decryptedData);
		const tokenWithUserData = AuthToken.create(JSON.stringify(decryptedData), gwServerCredentials, 600);
		const encryptedData = encryptToCred.encrypt(beameAuthServerFqdn, JSON.stringify(tokenWithUserData), gwServerFqdn);
		const proxyEnablingToken = AuthToken.create(JSON.stringify('Does not matter'), gwServerCredentials, 60);
		const url = `https://${gwServerFqdn}/customer-auth-done-2?data=${encodeURIComponent(tokenWithUserData)}&proxy_enable=${encodeURIComponent(proxyEnablingToken)}`;
		console.log('replyWithUrl() URL', url);
		res.send(url);
	}

	// TODO: get signing token, validate signature, decrypt user data, encrypt user data for auth server, send URL to GW server for proxying to beame authorization server

	Bootstrapper.listCustomerAuthServers()
		.then(assertGoodSignedBy)
		.then(getGwServerCredentials)
		.then(decrypt)
		.then(parseJson)
		.then(AuthToken.validate)
		.then(getEncryptToCred)
		.then(replyWithUrl)
		.catch((e) => {
			console.error('/customer-auth-done error', e);
		});
});

unauthenticatedApp.use(cust_auth_app);

module.exports = unauthenticatedApp;
