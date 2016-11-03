"use strict";

const http        = require('http');

const httpProxy   = require('http-proxy');

const beame       = require('beame-sdk');
const ProxyClient = beame.ProxyClient;
// const express = require('express');

function startRequestsHandler(cert) {
	console.log('startRequestsHandler');
	return new Promise((resolve, reject) => {
		http.createServer(function(req, res) {
		});
	});
}

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

function runServer(cert) {
	console.log(`Starting server at https://${cert.fqdn}`);
	return startRequestsHandler(cert)
		.then(startTunnel);
};

module.exports = {
	runServer
};
