const path = require('path');

const express    = require('express');
const bodyParser = require('body-parser');

const Bootstrapper = require('../../bootstrapper');
const bootstrapper = Bootstrapper.getInstance();
const Constants    = require('../../../constants');



const public_dir = path.join(__dirname, '..', '..', '..', process.env.BEAME_INSTA_DOC_ROOT);
const base_path  = path.join(public_dir, 'pages', 'config');

const utils         = require('../../utils');

const configApp = express();

configApp.use(express.static(base_path, {index: 'index.html'}));

utils.setExpressAppCommonRoutes(configApp);

configApp.use(bodyParser.json());
configApp.use(bodyParser.urlencoded({extended: false}));

module.exports = configApp;
