const path        = require('path');

const express     = require('express');
const bodyParser  = require('body-parser');

const utils       = require('../../utils');
const cust_auth_app  = require('../../routers/customer_auth');

const unauthenticatedApp = express();

// TODO: refactor - start

unauthenticatedApp.use(express.static(path.join(__dirname, '..', '..', '..', 'public', 'pages', 'gw'), {index: 'welcome.html'}));
utils.setExpressAppCommonRoutes(unauthenticatedApp);

// Customer authorization app - start
unauthenticatedApp.use(bodyParser.json());
unauthenticatedApp.use(bodyParser.urlencoded({extended: false}));
unauthenticatedApp.use(cust_auth_app);
// Customer authorization app - end

// TODO: refactor - end

module.exports = unauthenticatedApp;
