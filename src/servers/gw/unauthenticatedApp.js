const path = require('path');

const express    = require('express');
const bodyParser = require('body-parser');

const public_dir = path.join(__dirname, '..', '..', '..', 'public');
const base_path  = path.join(public_dir, 'pages', 'gw');

const utils         = require('../../utils');
const cust_auth_app = require('../../routers/customer_auth');

const unauthenticatedApp = express();

// TODO: refactor - start

unauthenticatedApp.use(express.static(base_path, {index: 'welcome.html'}));
unauthenticatedApp.get('/signin', (req, res) => {
	res.sendFile(path.join(base_path, 'signin.html'));
});
utils.setExpressAppCommonRoutes(unauthenticatedApp);

// Customer authorization app - start
unauthenticatedApp.use(bodyParser.json());
unauthenticatedApp.use(bodyParser.urlencoded({extended: false}));
unauthenticatedApp.use(cust_auth_app);
// Customer authorization app - end

// TODO: refactor - end

module.exports = unauthenticatedApp;
