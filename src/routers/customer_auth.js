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


router.route('/save')
	.post((req, res) => {

		/** @type {RegistrationData} */
		// let data       = {
		// 	email: req.body['email'],
		// 	name:  req.body['name'],
		// 	agree: req.body['agree'] ? true : false,
		// 	src : parseInt(req.body['src']) || config.RegistrationSource.Unknown
		// };

		// authServices.saveRegistration(data, true).then(()=> {
		//
		// 	return res.json({
		// 		"responseCode": 0,
		// 		"responseDesc": "Please check your email and continue the registration process"
		// 	});
		// }).catch(error=> {
		// 	return res.json({
		// 		"responseCode": 1,
		// 		"responseDesc": BeameLogger.formatError(error) || 'Oooops. Unexpected error. Please try again'
		// 	});
		// });
	});


module.exports = router;