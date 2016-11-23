const path = require('path');
const querystring = require('querystring');
const url         = require('url');

const express    = require('express');
const bodyParser = require('body-parser');

const Bootstrapper = require('../../bootstrapper');
const bootstrapper = new Bootstrapper();
const Constants    = require('../../../constants');
const beameSDK     = require('beame-sdk');
const BeameStore   = new beameSDK.BeameStore();
const AuthToken    = beameSDK.AuthToken;

const public_dir = path.join(__dirname, '..', '..', '..', Constants.WebRootFolder);
const base_path  = path.join(public_dir, 'pages', 'config');

const utils         = require('../../utils');
const cust_auth_app = require('../../routers/customer_auth');

const configApp = express();

configApp.use(express.static(base_path, {index: 'index.html'}));

utils.setExpressAppCommonRoutes(configApp);

configApp.use(bodyParser.json());
configApp.use(bodyParser.urlencoded({extended: false}));

module.exports = configApp;
