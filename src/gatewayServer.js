"use strict";

const https       = require('https');
const querystring = require('querystring');
const url         = require('url');

const httpProxy   = require('http-proxy');

const beameSDK       = require('beame-sdk');
const ProxyClient = beameSDK.ProxyClient;
const BeameStore  = new beameSDK.BeameStore();

const socket_io   = require('socket.io');


const proxy = httpProxy.createProxyServer({
	// TODO: X-Forwarded-For, X-Forwarded-Proto and friends
	xfwd: true,
	// Verify SSL cert
	secure: true
});

const COOKIE_NAME = 'X-Beame-GW-Service-Token';

// TODO: Audit trail?
// TODO: Move socket.io to non-standard location as other applications might use it

function getServicesList() {
	return  Promise.resolve({
		admin: {name: 'Admin Panel', url: 'http://127.0.0.1:65002/'},
		svc1: {name: 'Admin Panel', url: 'http://127.0.0.1:65500/'}
	});
};

// TODO: Check that websockets work
// TODO: Look if this can help: https://github.com/senchalabs/connect

// https://github.com/nodejitsu/node-http-proxy/blob/d8fb34471594f8899013718e77d99c2acbf2c6c9/examples/http/custom-proxy-error.js
proxy.on('error', (err, req, res) => {
	console.error('--- Proxy error - start ---');
	console.error(err);
	console.error('--- Proxy error - end ---');
	res.writeHead(502, {'Content-Type': 'text/plain'});
	res.end(`Hi.\nThis is beame-insta-server gateway proxy.\n\nProxying failed. Error follows:\n\n===8<===\n${err.stack}\n===8<===\n`);
});

// Extracts URL token either from URL or from Cookie
function extractAuthToken(req) {
	// XXX: temp
	return {'name': 'svc1'};
	return 'INVALID';
	return null;
}

function addBeameHeaders(req) {
	const via = `${req.httpVersion} ${req.headers.host} (beame-insta-server-gateway)`;

	if(req.headers.via) {
		req.headers.via = `${req.headers.via} ${via}`;
	} else {
		req.headers.via = via;
	}
}

function sendError(req, res, code, err, extra_headers = {}) {
	console.error(`Sending error: ${err}`);
	res.writeHead(code, Object.assign({}, {'Content-Type': 'text/plain'}, extra_headers));
	res.end(`Hi.\nThis is beame-insta-server gateway proxy. An error occured.\n\nRequested URL: ${req.url}\n\nError: ${err}\n`);
}


function proxyRequestToAuthServer(req, res) {
	addBeameHeaders(req);
	proxy.web(req, res, { target: `http://127.0.0.1:${process.env.BEAME_INSTA_SERVER_AUTH_PORT || 65001}` });
}

function handleRequest(req, res) {

	console.log(req.url);

	// ---------- Beame services - no cookie token involved ----------
	// These will move to Socket.IO

	let qs = null;
	// Don't want to parse all requests. It's a waste because most of them will be just proxied.
	if(req.url.startsWith('/beame/')) {
		qs = querystring.parse(url.parse(req.url).query);
	}

	// Probably /beame/save-token endpoint for storing token in cookie
	if(req.url.startsWith('/beame/switch-app')) {
		// 1. Set application authorization token cookie
		// 2. Redirect to the application
		console.log('SWITCHING APP', qs);
		if(!qs || !qs.app_auth_token) {
			sendError(req, res, 400, 'app_auth_token query string parameter is required');
			return;
		}
	}

	// ---------- Proxied services - use cookie token ----------

	const authToken = extractAuthToken(req);

	if (authToken == 'INVALID') {
		sendError(req, res, 401 /* Unauthorized */, 'Invalid token', {'Set-Cookie': `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`});
		return;
	}

	if (!authToken) {
		// Must get some authorization
		// proxyRequestToAuthServer(req, res);
		if(req.url == '/') {
			// Show "sign in / sign up" page
		}
		return;
	}

	// If have have the token, we're proxying to an application
	// TODO: make sure this .then() does not leak - getServicesList is singleton
	// TODO: get only specific service, might be changed to talk to external DB
	getServicesList().then(services => {
		if(!services[authToken]) {
			sendError(req, res, 502, `Unknown service "${JSON.stringify(authToken)}" in token`);
			return;
		}
		addBeameHeaders(req);
		proxy.web(req, res, {target: services[authToken].url});
		// TODO: set cookie to carry token
	});
}

function handleSocketIoConnect(client) {
	// Browser controller will connect here
	client.on('data', data => {
		console.log('DATA', data);

	});
}

// Starts HTTPS server
function startRequestsHandler(cert) {
	console.log('startRequestsHandler');
	return new Promise((resolve, reject) => {
		var serverCerts = {
			key:  cert.getKey("PRIVATE_KEY"),
			cert: cert.getKey("P7B"),
			ca:   cert.getKey("CA")
		};
		const server = https.createServer(serverCerts, handleRequest);
		const io = socket_io(server);
		io.on('connection', handleSocketIoConnect);
		server.listen(process.env.BEAME_INSTA_SERVER_GW_PORT || 0, () => {
			const port = server.address().port;
			console.log(`beame-insta-server listening port ${port}`);
			resolve([cert, port]);
		});
	});
}

// Starts Beame tunnel that points to our HTTPS server
function startTunnel([cert, requestsHandlerPort]) {
	console.log('startTunnel');
	return new Promise((resolve, reject) => {

		var serverCerts = {
			key:  cert.getKey("PRIVATE_KEY"),
			cert: cert.getKey("P7B"),
			ca:   cert.getKey("CA")
		};
		new ProxyClient("HTTPS", cert.fqdn,
						cert.getMetadataKey('EDGE_FQDN'), 'localhost',
						requestsHandlerPort, {},
						null, serverCerts);

	});
}

// Starts HTTPS server and Beame tunnel for it
function runServer(fqdn) {
	console.log(`Starting server at https://${fqdn}`);
	return BeameStore.find(fqdn, false)
		.then(startRequestsHandler)
		.then(startTunnel);
}

module.exports = {
	runServer
};
