/**
 * Created by Alexz on 03/01/2017.
 */
"use strict";

// Iz govna i palok
// TODO: Go over all todo and XXX and fix

const http        = require('http');
const https       = require('https');
const querystring = require('querystring');
const url         = require('url');
const cookie      = require('cookie');
const request     = require('request');

const httpProxy          = require('http-proxy');

const logger = console;

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
	logger.error(`Method: ${req.method}`);
	logger.error(`URL: ${req.url}`);
	logger.error(`Headers: ${JSON.stringify(req.headers)}`);
	logger.error(err);
	logger.error(err.stack);
	logger.error('--- Proxy error - end ---');
	res.writeHead(502, {'Content-Type': 'text/plain'});
	res.end(`Hi.\nThis is beame-insta-server gateway proxy.\n\nProxying failed. Error follows:\n\n===8<===\n${err.stack}\n===8<===\n`);
});

// 301 responses are cached by browser so we can no longer proxy,
// browsers hitting gateway will automatically be redirected to
// another site. Rewriting 301 to 302 responses.
proxy.on('proxyRes', (proxyRes, req, res) => {
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
		// proxyRes.headers['location']                      = 'LOGOUT';
	}
	// XXX - can not be like this in production - end
});

const srv = http.createServer(function(req, res) {
	console.log('REQ', req.headers);
	proxy.web(req, res, { target: 'https://vv9g2eq5n45p65vq.m6wzrqug10ubqhtw.v1.d.beameio.net/x' });
	// proxy.web(req, res, { target: 'https://www.yahoo.com/test' });
});

srv.listen(50000);

for(let i=0; i<100; i++) {

		request('https://vv9g2eq5n45p65vq.m6wzrqug10ubqhtw.v1.d.beameio.net/x', function (error, response, body) {
if(error)
	console.log(error);
			else
			console.log(response.statusCode,'..', i);
			// if (!error && response.statusCode == 200) {
			// 	console.log('OK');
			// } else {
			// 	console.log('OK');
			// }
			});


}