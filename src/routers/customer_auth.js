/**
 * Created by zenit1 on 14/11/2016.
 */
"use strict";

const path    = require('path');
const request = require('request');
const express      = require('express');
const router       = express.Router();

const public_dir =  path.join(__dirname, '..', '..',  'public');

const base_path = path.join(public_dir, 'pages', 'customer_auth');

router.get('/register',  (req, res) => {
	res.sendFile(path.join(base_path,'register.html'));
});


router.route('/register/save')
	.post((req, res) => {

		let data       = {
			email: req.body['email'],
			name:  req.body['name'],
			user_id: req.body['user_id']
		};

		console.log(data);

	});


module.exports = router;