'use strict';
const bootstrapper = new (require('../src/bootstrapper'))();
let config = bootstrapper.sqliteConfig;

const beameSDK     = require('beame-sdk');
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger('Sequelize');

var fs        = require('fs');
var path      = require('path');
var Sequelize = require('sequelize');
var basename  = path.basename(module.filename);
var db        = {};

var sequelize = new Sequelize(config["database"], config["username"], config["password"], {
	dialect: 'sqlite',
	pool:    {
		max:  5,
		min:  0,
		idle: 10000
	},
	logging: logger.debug.bind(logger),
	// SQLite only
	storage: config["storage"]
});

fs
	.readdirSync(__dirname)
	.filter(function (file) {
		return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
	})
	.forEach(function (file) {
		var model      = sequelize['import'](path.join(__dirname, file));
		db[model.name] = model;
	});

Object.keys(db).forEach(function (modelName) {
	if (db[modelName].associate) {
		db[modelName].associate(db);
	}
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;

