/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const bodyParser      = require('body-parser');
const https           = require('https');
const express         = require('express');

/**
 *
 * @param router
 * @param staticDir
 * @returns {Router}
 */
function setExpressApp(router, staticDir) {
	let app    = express();

	if (staticDir) {
		app.use(express.static(staticDir));
	}
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({extended: false}));
	app.use('/', router);
	app.use("*", function (req, res) {
		res.status(404).send('404');
	});

	return app;
}


module.exports ={
	setExpressApp
};