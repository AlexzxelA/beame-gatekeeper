/**
 * Created by zenit1 on 15/12/2016.
 */
"use strict";

const path        = require('path');
const querystring = require('querystring');
const url         = require('url');

const express    = require('express');
const bodyParser = require('body-parser');

const Bootstrapper = require('../../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();
const Constants        = require('../../../constants');
const cookieNames      = Constants.CookieNames;
const beameSDK         = require('beame-sdk');
const CommonUtils      = beameSDK.CommonUtils;


const public_dir = path.join(__dirname, '..', '..', '..', process.env.BEAME_INSTA_DOC_ROOT);
const base_path  = path.join(public_dir, 'pages', 'gw', 'authenticated');

const authenticatedApp = express();

authenticatedApp.get(Constants.GwAuthenticatedPath, (req, res) => {
	res.cookie(cookieNames.Service,CommonUtils.stringify(bootstrapper.appData));
	res.sendFile(path.join(base_path, 'logged-in-home.html'));
});

authenticatedApp.use(Constants.GwAuthenticatedPath,express.static(public_dir));

authenticatedApp.use(bodyParser.json());

authenticatedApp.use(bodyParser.urlencoded({extended: false}));

module.exports = authenticatedApp;