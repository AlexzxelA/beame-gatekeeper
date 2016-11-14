/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const bodyParser      = require('body-parser');
const https           = require('https');
const express         = require('express');
const path            = require('path');

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
	app.use("*",  (req, res) => {
		res.status(404).send('404');
	});



	return app;
}

function setExpressAppCommonRoutes(app) {
	app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
	app.use('/img', express.static(path.join(__dirname, '..', 'public', 'img')));
	app.use('/lib', express.static(path.join(__dirname, '..', 'public', 'lib')));
}


module.exports ={
	setExpressApp,
	setExpressAppCommonRoutes
};
