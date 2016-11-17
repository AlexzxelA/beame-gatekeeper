"use strict";

// Iz govna i palok
// TODO: Go over all todo and XXX and fix

const https       = require('https');
const querystring = require('querystring');
const url         = require('url');
const cookie      = require('cookie');

const httpProxy = require('http-proxy');

const beameSDK    = require('beame-sdk');
const module_name = "GatewayServer";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const ProxyClient = beameSDK.ProxyClient;
const BeameStore  = new beameSDK.BeameStore();
const Constants   = require('../../../constants');

const apps = require('./apps');

const unauthenticatedApp = require('./unauthenticatedApp');

const proxy = httpProxy.createProxyServer({
	xfwd:         true,
	// Verify SSL cert
	secure:       true,
	// Set request hostname to hostname from destination URL
	changeOrigin: true,
	// Do proxy web sockets
	ws:           true
});

const COOKIE_NAME = 'X-Beame-GW-Service-Token';

// TODO: Audit trail?

// TODO: Check that websockets work (apparently wss:// fails when using socket.io)
//       Look if this can help: https://github.com/senchalabs/connect

// https://github.com/nodejitsu/node-http-proxy/blob/d8fb34471594f8899013718e77d99c2acbf2c6c9/examples/http/custom-proxy-error.js
proxy.on('error', (err, req, res) => {
	logger.error('--- Proxy error - start ---');
	logger.error(err);
	logger.error('--- Proxy error - end ---');
	res.writeHead(502, {'Content-Type': 'text/plain'});
	res.end(`Hi.\nThis is beame-insta-server gateway proxy.\n\nProxying failed. Error follows:\n\n===8<===\n${err.stack}\n===8<===\n`);
});

// 301 responses are cached by browser so we can no longer proxy,
// browsers hitting gateway will automatically be redirected to
// another site. Rewriting 301 to 302 responses.
proxy.on('proxyRes', (proxyRes, req, res) => {
	if(proxyRes.statusCode == 301) {
		proxyRes.statusCode = 302;
		proxyRes.statusMessage = 'Found';
	}
});

// Extracts URL token either from URL or from Cookie
function extractAuthToken(req) {
	// XXX: temp
	// return {'name': 'svc1'};
	// return 'INVALID';
	if (!req.headers.cookie) {
		return null;
	}
	const cookies = cookie.parse(req.headers.cookie);
	if (!cookies.proxy_enabling_token) {
		return null;
	}
	// XXX: Validate proxy_enabling_token
	try {
		const ret = JSON.parse(JSON.parse(cookies.proxy_enabling_token).signedData.data);
		return JSON.parse(ret);
	} catch (e) {
		logger.error(`Fail to parse proxy_enabling_token ${cookies.proxy_enabling_token}`);
		return 'INVALID';
	}
}

function addBeameHeaders(req) {
	const via = `${req.httpVersion} ${req.headers.host} (beame-insta-server-gateway)`;

	if (req.headers.via) {
		req.headers.via = `${req.headers.via} ${via}`;
	} else {
		req.headers.via = via;
	}
}

function sendError(req, res, code, err, extra_headers = {}) {
	logger.error(`Sending error: ${err}`);
	res.writeHead(code, Object.assign({}, {'Content-Type': 'text/plain'}, extra_headers));
	res.end(`Hi.\nThis is beame-insta-server gateway proxy. An error occured.\n\nRequested URL: ${req.url}\n\nError: ${err}\n`);
}


function proxyRequestToAuthServer(req, res) {
	addBeameHeaders(req);
	proxy.web(req, res, {target: `http://127.0.0.1:${process.env.BEAME_INSTA_SERVER_AUTH_PORT || 65001}`});
}

function handleRequest(req, res) {

	logger.debug('[GW] handleRequest', req.url);

	const authToken = extractAuthToken(req);

	logger.debug('gateway handleRequest URL', req.url);
	if (!authToken || req.url == Constants.LogoutPath || req.url.startsWith(Constants.AppSwitchPath)) {
		unauthenticatedApp(req, res);
		return;
	}
	logger.debug(`unauthenticatedApp did not handle ${req.url}`);

	if (authToken == 'INVALID') {
		sendError(req, res, 401 /* Unauthorized */, 'Invalid token', {'Set-Cookie': `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`});
		return;
	}

	if (authToken.url) {
		logger.debug(`Proxying to authToken.url ${authToken.url}`);
		proxy.web(req, res, {target: authToken.url});
		// proxy.web(req, res, {target: 'http://google.com'});
		return;
	}

	if (authToken.app_id) {
		logger.debug(`Proxying to app_id ${authToken.app_id}`);
		apps.appUrlById(authToken.app_id).then(url => {
			proxy.web(req, res, {target: url});
		}).catch(e => {
			logger.error(`Error handling authToken.app_id: ${e}`);
			sendError(req, res, 500, `Don't know how to proxy. Probably invalid app_id.`);
		});
		// proxy.web(req, res, {target: 'http://google.com'});
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
	return new Promise((resolve, reject) => {

		var serverCerts = cert.getHttpsServerOptions();
		new ProxyClient("HTTPS", cert.fqdn,
			cert.getMetadataKey('EDGE_FQDN'), 'localhost',
			requestsHandlerPort, {},
			null, serverCerts);

	});
}


class GatewayServer {

	constructor(fqdn, matchingServerFqdn) {
		this._fqdn = fqdn;

		this._matchingServerFqdn = matchingServerFqdn;

		this._server = null;
		this._socketServer = null;
		this._socketControllerServer = null;
	}

	/**
	 * @param cb
	 * @returns {Promise}
	 */
	start(cb) {
		logger.debug(`Starting gateway `);
		BeameStore.find(this._fqdn, false)
			.then(this._startRequestsHandler.bind(this))
			.then(startTunnel)
			.then(()=>{
				logger.debug(`Gateway server started at https://${this._fqdn}`);
				cb && cb(null,this._server);
			}).catch(error=>{
				logger.error(error);
				cb && cb(error,null);
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
		return new Promise((resolve, reject) => {

			let serverCerts = cert.getHttpsServerOptions();

			this._server = https.createServer(serverCerts, handleRequest);


			this._startBrowserControllerServer()
				.then(this._startSocketServer.bind(this))
				.then(()=>{
							this._server.listen(process.env.BEAME_INSTA_SERVER_GW_PORT || 0, () => {
								const port = this._server.address().port;
								logger.debug(`beame-insta-server listening port ${port}`);
								resolve([cert, port]);
							});
			}).catch(reject)

		});
	}

	_startBrowserControllerServer(){
		return new Promise((resolve, reject) => {
			const BrowserControllerSocketioApi = require('./browser_controller_socketio_api');

			let controllerSocketio = new BrowserControllerSocketioApi(this._fqdn);

				controllerSocketio.start(this._server).then(socketio_server=>{
					this._socketControllerServer = socketio_server;
					resolve();
				}).catch(reject);
			}
		);
	}

	_startSocketServer() {

		return new Promise((resolve, reject) => {
				const BeameAuthServices      = require('../beame_auth/authServices');
				const BeameInstaSocketServer = require('../../beameInstaSocketServer');


				/** @type {MessagingCallbacks} */
				let callbacks = {
					DeleteSession: BeameAuthServices.deleteSession
				};

				let options = {path: `${Constants.GatewayControllerPath}-insta-socket`};

				let beameInstaSocketServer = new BeameInstaSocketServer(this._server, this._fqdn, this._matchingServerFqdn, (require('BeameWhisperer').WhispererMode).SESSION, callbacks,options);

				beameInstaSocketServer.start().then(socketio_server => {
					this._socketServer = socketio_server;
					resolve();
				}).catch(error=> {
					this.stop();
					reject(error);
				})
			}
		);
	}
}

module.exports = GatewayServer;
