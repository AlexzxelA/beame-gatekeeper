/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const path    = require('path');
const express = require('express');
const router  = express.Router();

const public_dir = path.join(__dirname, '..', '..', 'public');

const base_path = path.join(public_dir, 'pages', 'beame_auth');

router.get('/', (req, res) => {
	res.sendFile(path.join(base_path, 'signup.html'));
});


module.exports = router;