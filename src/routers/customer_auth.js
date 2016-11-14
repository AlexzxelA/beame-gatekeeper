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


function isAuthenticated(data) {
	//ADD CUSTOM LOGIC
	console.log('data authenticated %j',data);
	return true;
}

router.get('/register',  (req, res) => {
	res.sendFile(path.join(base_path,'register.html'));
});


router.route('/register/save')
	.post((req, res) => {

		let data       = {
			email: req.body['email'],
			name:  req.body['name'],
			user_id: req.body['user_id']
		},
	    isAuthenticated = isAuthenticated(data);

		if(isAuthenticated){
			const Bootstrapper = require('../bootstrapper');
			const Constants    = require('../../constants');

			return res.json({
				"url": `https://${Bootstrapper.getCredFqdn(Constants.CredentialType.BeameAuthorizationServer)}`,
				"responseCode": 0,
				"responseDesc": "Please check your email and continue the registration process"
			});
		}
		else{
			return res.json({
				"responseCode": 1,
				"responseDesc": 'Authentication failed. Please try again'
			});
		}



	});


module.exports = router;