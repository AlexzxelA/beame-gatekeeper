/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

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
	const bodyParser = require('body-parser');
	let app          = express();

	if (staticDir) {
		app.use(express.static(staticDir));
	}
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({extended: false}));
	app.use('/', router);
	app.use("*", function (req, res) {
		res.status(404).send('404');
	});

	setExpressAppCommonRoutes(app);

	return app;
}

function setExpressAppCommonRoutes(app) {
	app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
	app.use('/img', express.static(path.join(__dirname, '..', 'public', 'img')));
}


module.exports ={
	setExpressApp,
	setExpressAppCommonRoutes
};
