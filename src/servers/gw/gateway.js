"use strict";

// Iz govna i palok
// TODO: Go over all todo and XXX and fix

const http        = require('http');
const https       = require('https');
const querystring = require('querystring');
const url         = require('url');
const cookie      = require('cookie');

const httpProxy          = require('http-proxy');
const beameSDK           = require('beame-sdk');
const CommonUtils        = beameSDK.CommonUtils;
const module_name        = "GatewayServer";
const BeameLogger        = beameSDK.Logger;
const logger             = new BeameLogger(module_name);
const ProxyClient        = beameSDK.ProxyClient;
const BeameStore         = new beameSDK.BeameStore();
const Constants          = require('../../../constants');
const cookieNames        = Constants.CookieNames;
const samlManagerRef     = require('../../samlSessionManager');
const unauthenticatedApp = require('./unauthenticatedApp');
const authenticatedApp   = require('./authenticatedApp');
const configApp          = require('./configApp');
const COOKIE_NAME        = 'X-Beame-GW-Service-Token';
const Bootstrapper         = require('../../bootstrapper');
const bootstrapper         = Bootstrapper.getInstance();

let adminApp         = null;
let expectsAuthToken = false;
let serviceManager   = null;


const agentProxy = (agentModule) => {

	const agentOptions = {
		      maxSockets:       100,
		      keepAlive:        true,
		      maxFreeSockets:   10,
		      keepAliveMsecs:   500,
		      timeout:          60000,
		      keepAliveTimeout: 30000 // free socket keepalive for 30 seconds
	      },
	      agent        = agentModule == 'https' ? new https.Agent(agentOptions) : new http.Agent(agentOptions);

	return httpProxy.createProxyServer({
		xfwd:         true,
		// Verify SSL cert
		secure:       true,
		// Set request hostname to hostname from destination URL
		changeOrigin: true,
		// Do proxy web sockets
		ws:           true,
		agent:        agent,
		autoRewrite:  true,
	})
};

const http_proxy  = agentProxy('http');
const https_proxy = agentProxy('https');

function onProxyRes(proxyRes) {
	if (proxyRes.statusCode == 301) {
		proxyRes.statusCode    = 302;
		proxyRes.statusMessage = 'Found';
	}
	// TODO: Also change 308 to 307
	// XXX - can not be like this in production - start
	if (proxyRes.statusCode == 404) {
		// http://stackoverflow.com/questions/34684139/how-to-add-headers-to-node-http-proxy-response
		proxyRes.statusCode                               = 302;
		proxyRes.statusMessage                            = 'Found';
		proxyRes.headers['x-beame-debug-redirect-reason'] = 'error 404 from upstream';
		//proxyRes.headers['location']                      = Bootstrapper.getLogoutUrl();
	}
	// XXX - can not be like this in production - end

	let key               = 'www-authenticate';
	proxyRes.headers[key] = proxyRes.headers[key] && proxyRes.headers[key].split(',');
}

// 301 responses are cached by browser so we can no longer proxy,
// browsers hitting gateway will automatically be redirected to
// another site. Rewriting 301 to 302 responses.
http_proxy.on('proxyRes', onProxyRes);
https_proxy.on('proxyRes', onProxyRes);


function onProxyError(err, req, res) {
	logger.error(err);
	if (res) {
		res.writeHead && res.writeHead(502, {'Content-Type': 'text/plain'});
		res.end && res.end(`Hi.\nThis is beame-gatekeeper gateway proxy.\n\nProxying failed. Error follows:\n\n===8<===\n${err.stack}\n===8<===\n`);
	}

	logger.error('--- Proxy error - start ---');
	logger.error(`Method: ${req.method}`);
	logger.error(`URL: ${req.url}`);
	logger.error(`Headers: ${CommonUtils.stringify(req.headers, true)}`);
	logger.error(err);
	logger.error(err.stack);
	logger.error('--- Proxy error - end ---');
}

http_proxy.on('error', onProxyError);
https_proxy.on('error', onProxyError);

// Extracts URL token either from URL or from Cookie
function extractAuthToken(req) {
	if (!req.headers.cookie) {
		return null;
	}
	const cookies   = cookie.parse(req.headers.cookie);
	let proxyCookie = cookies[cookieNames.Proxy];
	if (!proxyCookie) {
		return null;
	}
	// XXX: Validate proxy_enabling_token
	try {
		const ret = JSON.parse(JSON.parse(proxyCookie).signedData.data);
		return JSON.parse(ret);
	} catch (e) {
		logger.error(`Fail to parse proxy_enabling_token ${proxyCookie}`);
		return 'INVALID';
	}
}

function sendError(req, res, code, err, extra_headers = {}) {
	logger.error(`Sending error: ${err}`);
	res.writeHead(code, Object.assign({}, {'Content-Type': 'text/plain'}, extra_headers));
	res.end(`Hi.\nThis is beame-gatekeeper gateway proxy. An error occured.\n\nRequested URL: ${req.url}\n\nError: ${err}\n`);

}

function is_unauth_app_url(url) {
	return (
	url.startsWith(Constants.LogoutPath) ||
	url.startsWith(Constants.LoginPath) ||
	url.startsWith(Constants.SigninPath) ||
	url.startsWith(Constants.XprsSigninPath) ||
	url.startsWith(Constants.AppSwitchPath) ||
	url.startsWith(Constants.RegisterPath) ||
	url.startsWith(Constants.DirectPath) ||
	url.startsWith(`${Constants.GatewayControllerPath}/css`) ||
	url.startsWith(`${Constants.GatewayControllerPath}/img`) ||
	url.startsWith(`${Constants.GatewayControllerPath}/js`))
}

function handleRequest(type, p1, p2, p3) {

	const req = p1;
	let res, socket, head, proxy_func;

	function proxy_web(url) {
		try {

			(url.startsWith('https') ? https_proxy : http_proxy).web(req, res, {target: url});

		}
		catch (e) {
			logger.error(e);
		}

	}

	function proxy_ws(url) {
		try {
			(url.startsWith('https') ? https_proxy : http_proxy).ws(req, socket, head, {target: url});
		}
		catch (e) {
			logger.error(e);
		}
	}

	switch (type) {
		case 'request':
			res        = p2;
			proxy_func = proxy_web;
			break;
		case 'upgrade':
			socket     = p2;
			head       = p3;
			proxy_func = proxy_ws;
			break;
		default:
			throw new Error(`Programming error. handleRequest() first parameter must be 'request' or 'upgrade', not ${type}`)
	}


	logger.debug('[GW] handleRequest' + type, req.url);

	function upgrade_not_supported() {

		(function closure(url, stack) {
			setTimeout(function () {
				if (socket.writable && socket.bytesWritten <= 0) {
					logger.error(stack);
					socket.end();
				} else {
					logger.debug(`Upgrade not supported by proxy, done by someone else for url ${url}`);
				}
			}, 1000);
		})(req.url, new Error(`Upgrade not supported by proxy at this place ${req.url} closing socket`).stack);
	}

	logger.debug('[GW] handleRequest', req.url);

	const authToken = (expectsAuthToken) ? extractAuthToken(req) : null;

	logger.debug(`gateway handleRequest URL, ${req.url}`);
	if (!authToken || is_unauth_app_url(req.url)) {
		if (type == 'upgrade') {
			logger.debug(`handleRequest: upgrade_not_supported for unathenticated app at ${req.url}`);
			return upgrade_not_supported();
		}
		unauthenticatedApp(req, res);
		expectsAuthToken = true;
		return;
	}
	logger.debug(`unauthenticatedApp did not handle ${req.url} ${CommonUtils.stringify(authToken, true)}`);

	if (authToken == 'INVALID') {
		sendError(req, res, 401 /* Unauthorized */, 'Invalid token', {'Set-Cookie': `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`});
		return;
	}

	if (req.url.startsWith(`${Constants.GwAuthenticatedPath}`)) {
		logger.debug(`handle authenticated GW request with ${req.url}`);
		authenticatedApp(req, res);
		return;
	}

	if (authToken.url) {
		logger.debug(`Proxying to authToken.url ${authToken.url}`);
		proxy_func(authToken.url);
		return;
	}

	let appCode = serviceManager.getAppCodeById(authToken.app_id);

	if (!appCode) {
		if (type == 'upgrade') {
			return upgrade_not_supported();
		}
		expectsAuthToken = false;
		handleRequest(type, p1, p2, p3);
		//sendError(req, res, 500, `Don't know how to proxy. Probably invalid app_id.`);
		return;
	}

	if (serviceManager.isAdminService(authToken.app_id) && authToken.isAdmin) {
		if (type == 'upgrade') {
			return upgrade_not_supported();
		}
		logger.debug(`Proxying to Admin server`);
		adminApp(req, res);
		return;
	}

	if (authToken.app_id) {
		logger.debug(`Proxying to app_id ${authToken.app_id}`);
		serviceManager.appUrlById(authToken.app_id).then(url => {
			const u = url.split('***');
			url     = u[0];
			if (req.url == '/' && u[1]) {
				logger.info(`home page redirect to ${u[1]}`);
				res.writeHead(302, {
					'Location': u[1]
				});
				res.end();
				return;

			}
			logger.info(`proxying req ${req.url}`);
			logger.info(`proxying to service ${url}`);
			proxy_func(url);
		}).catch(e => {
			logger.error(`Error handling authToken.app_id: ${e}`);
			sendError(req, res, 500, `Don't know how to proxy. Probably invalid app_id.`);
		});
		return;
	}

	// Internal proxying to configuration application
	if (authToken.allowConfigApp) {
		console.log('Proxying to config app');
		configApp(req, res);
		return;
	}

	sendError(req, res, 500, `Don't know how to proxy. Probably invalid proxying token.`);

}

// Starts HTTPS server
/**
 * @param {Credential} cert
 * @returns {Promise}
 */

// Starts Beame tunnel that points to our HTTPS server
/**
 *
 * @param {Credential} cert
 * @param {Number} requestsHandlerPort
 * @returns {Promise}
 */
function startTunnel([cert, requestsHandlerPort]) {
	logger.debug('startTunnel');
	return new Promise((resolve) => {

		let serverCerts = cert.getHttpsServerOptions();
		let proxyClient = new ProxyClient("HTTPS", cert, 'localhost',
			requestsHandlerPort, {},
			null, serverCerts);

		proxyClient.start().then(resolve).catch(e => {
			logger.error(`Start tunnel error ${BeameLogger.formatError(e)}`);
			resolve();
		});

	});
}

class GatewayServer {

	/**
	 *
	 * @param {String} fqdn
	 * @param {String} matchingServerFqdn
	 * @param {ServiceManager} _serviceManager
	 */

	constructor(fqdn, matchingServerFqdn, _serviceManager) {
		this._fqdn = fqdn;

		this._matchingServerFqdn = matchingServerFqdn;

		this._server                 = null;
		this._socketServer           = null;
		this._socketControllerServer = null;

		serviceManager = _serviceManager;

		adminApp = new (require('../admin/server'))(null, null, serviceManager).app;

		bootstrapper.appId = CommonUtils.generateDigest(fqdn,"MD5");
	}

	/**
	 * @param cb
	 * @returns {Promise}
	 */
	start(cb) {
		logger.debug(`Starting gateway `);
		BeameStore.find(this._fqdn, false)
			.then(cred => {
				if (cred.expired || cred.revoked) {
					logger.fatal(`Gateway Server certificate expired or revoked`);
				}

				return Promise.resolve(cred);
			})
			.then(this._startRequestsHandler.bind(this))
			.then(startTunnel)
			.then(() => {
				logger.debug(`Gateway server started at https://${this._fqdn}`);
				cb && cb(null, this._server);
			}).catch(error => {
			logger.error(error);
			cb && cb(error, null);
		});
	}

	stop() {
		if (this._server) {
			this._server.close();
			this._server = null;
		}
		if (this._socketServer) {
			this._socketServer.stop();
			this._socketServer = null;
		}

		if (this._socketControllerServer) {
			this._socketControllerServer.stop();
			this._socketControllerServer = null;
		}
	}

	_startRequestsHandler(cert) {
		logger.debug('startRequestsHandler');

		new samlManagerRef.samlManager(cert);
		unauthenticatedApp.initSSOdata();
		return new Promise((resolve, reject) => {

			let serverCerts = cert.getHttpsServerOptions();

			this._server = https.createServer(serverCerts);
			this._server.on('request', handleRequest.bind(null, 'request'));
			this._server.on('upgrade', handleRequest.bind(null, 'upgrade'));


			this._startBrowserControllerServer()
				.then(this._startSocketServer.bind(this))
				.then(() => {
					this._server.listen(process.env.BEAME_INSTA_SERVER_GW_PORT || 0, () => {
						const port = this._server.address().port;
						logger.debug(`beame-gatekeeper listening port ${port}`);
						resolve([cert, port]);
					});
				}).catch(reject)

		});
	}

	_startBrowserControllerServer() {
		return new Promise((resolve, reject) => {
				const BrowserControllerSocketioApi = require('./browser_controller_socketio_api');

				let controllerSocketio = new BrowserControllerSocketioApi(this._fqdn, serviceManager);

				controllerSocketio.start(this._server).then(socketio_server => {
					this._socketControllerServer = socketio_server;
					resolve();
				}).catch(reject);
			}
		);
	}

	_startSocketServer() {

		return new Promise((resolve, reject) => {
				const BeameAuthServices      = require('../../authServices');
				const BeameInstaSocketServer = require('../../beameInstaSocketServer');


				/** @type {MessagingCallbacks} */
				let callbacks = {
					DeleteSession: BeameAuthServices.deleteSession
				};

				let options = {path: `${Constants.GatewayControllerPath}-insta-socket`, destroyUpgradeTimeout: 10 * 1000};

				let beameInstaSocketServer = new BeameInstaSocketServer(this._server, this._fqdn, this._matchingServerFqdn, Constants.AuthMode.SESSION, callbacks, options);

				beameInstaSocketServer.start().then(socketio_server => {
					this._socketServer = socketio_server;
					resolve();
				}).catch(error => {
					this.stop();
					reject(error);
				});
			}
		);
	}
}

module.exports = GatewayServer;
