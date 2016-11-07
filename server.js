"use strict";

const https       = require('https');

const httpProxy   = require('http-proxy');

const beame       = require('beame-sdk');
const ProxyClient = beame.ProxyClient;

const proxy = httpProxy.createProxyServer({});

const getServicesList = new Promise((resolve, reject) => {
	resolve({
		admin: {name: 'Admin Panel', url: 'http://127.0.0.1:65002/'},
		svc1: {name: 'Admin Panel', url: 'http://127.0.0.1:65500/'}
	});
});

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
	return 'svc1';
	return null;
}

function proxyRequestToAuthServer(req, res) {
	proxy.web(req, res, { target: `http://127.0.0.1:${process.env.BEAME_INSTA_SERVER_AUTH_PORT || 65001}` });
}

// TODO: Make sure X-Forwarded-For is set
function handleRequest(req, res) {
	const authToken = extractAuthToken(req);
	// Don't want to parse all requests. It's a waste because most of them will be just proxied.
	if(req.url.startsWith('/beame/switch-app')) {
		console.log('SWITCHING APP');
	}
	if (!authToken) {
		// Must get some authorization
		proxyRequestToAuthServer(req, res);
		return;
	}
	// If have have the token, we're proxying to an application
	// TODO: make sure this .then() does not leak - getServicesList is singleton
	getServicesList.then(services => {
		if(!services[authToken]) {
			console.error(`--- Proxy error: unknown service ${authToken} in token`);
			res.writeHead(502, {'Content-Type': 'text/plain'});
			res.end(`Hi.\nThis is beame-insta-server gateway proxy.\n\nProxying failed. Error: unknown service "${authToken}" in token\n`);
			return;
		}
		proxy.web(req, res, {target: services[authToken].url});
		// TODO: set cookie to carry token
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
function runServer(cert) {
	console.log(`Starting server at https://${cert.fqdn}`);
	return startRequestsHandler(cert)
		.then(startTunnel);
}

module.exports = {
	runServer
};
