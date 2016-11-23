/**
 * Created by zenit1 on 13/11/2016.
 */

"use strict";

const path    = require('path');
const express = require('express');

const Constants  = require('../../constants');
const public_dir = path.join(__dirname, '..', '..', Constants.WebRootFolder);
const base_path  = path.join(public_dir, 'pages', 'admin');


class AdminRouter {
	constructor(adminServices) {
		this._adminServices = adminServices;

		this._router = express.Router();

		this._initRoutes();
	}

	_initRoutes() {
		//region static
		this._router.get('/', (req, res) => {

			res.sendFile(path.join(base_path, 'index.html'));
		});

		this._router.get('/templates/dash.tmpl.html', (req, res) => {

			res.sendFile(path.join(base_path, '/templates/dash.tmpl.html'));
		});

		this._router.get('/templates/users.tmpl.html', (req, res) => {

			res.sendFile(path.join(base_path, '/templates/users.tmpl.html'));
		});

		this._router.get('/templates/registrations.tmpl.html', (req, res) => {

			res.sendFile(path.join(base_path, '/templates/registrations.tmpl.html'));
		});
		//endregion

		this._router.get('/settings/get', (req, res) => {
			this._adminServices.getSettings().then(data => {
				res.json(data);
			}).catch(() => {
				res.json({});
			});
		});

		//region grids actions
		this._router.get('/user/list', (req, res) => {
			this._adminServices.getUsers().then(
				array => {
					res.json(array);
				}
			).catch(array => {
				res.json(array);
			});
		});

		this._router.post('/user/update', (req, res) => {
			let user = req.body;
			this._adminServices.updateUser(user).then(
				array => {
					res.json(array);
				}
			).catch(array => {
				res.json(array);
			});
		});

		this._router.get('/registration/list', (req, res) => {
			this._adminServices.getRegistrations().then(
				array => {
					res.json(array);
				}
			).catch(array => {
				res.json(array);
			});
		});

		this._router.post('/registration/destroy', (req, res) => {
			let data = req.body,
			    id   = parseInt(data.id);

			this._adminServices.deleteRegistration(id).then(() => {
				res.status(200).json({});
			}).catch(error => {
				res.status(400).send(error);
			});

		});
		//endregion
	}

	get router() {
		return this._router;
	}
}


module.exports = AdminRouter;