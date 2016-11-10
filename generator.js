const models = require("./models/index.js");
const Sequelize   = require('sequelize');
const fs = require('fs');


const sequelize = new Sequelize(
	'beame_server',
	'admin',
	'CZ^?<E9!zFV6;g-9',
	{
		host: '127.0.0.1',
		dialect: 'sqlite'
	}
);

for(let model in models) {

	if (!(models[model] instanceof Sequelize.Model)) break;

	let attributes = models[model].attributes;

	for(let column in attributes) {
		delete attributes[column].Model;
		delete attributes[column].fieldName;
		delete attributes[column].field;
		for(let property in attributes[column]) {
			if(property.startsWith('_')) {
				delete attributes[column][property];
			}
		}

		if(typeof attributes[column]['type'] !== 'undefined') {

			if(typeof attributes[column]['type']['options'] !== 'undefined' && typeof attributes[column]['type']['options'].toString === 'function') {
				attributes[column]['type']['options'] = attributes[column]['type']['options'].toString(sequelize);
			}

			if(typeof attributes[column]['type'].toString === 'function') {
				attributes[column]['type'] = attributes[column]['type'].toString(sequelize);
			}

		}

	}

	let schema = JSON.stringify(attributes, null, 4);
	let tableName = models[model].tableName;
	let indexes = ['\n'];

	if(models[model].options.indexes && models[model].options.indexes.length) {

		models[model].options.indexes.forEach((obj) => {

			indexes.push('        .then(() => {');
			indexes.push('            return queryInterface.addIndex(');
			indexes.push(`                '${tableName}',`);
			indexes.push(`                ['${obj.fields.join("','")}']`);

			let opts = {};
			if(obj.name) {
				opts.indexName = obj.name;
			}
			if(obj.unique === true) {
				opts.indicesType = 'UNIQUE';
			}
			if(obj.method === true) {
				opts.indexType = obj.method;
			}
			if(Object.keys(opts).length) {
				indexes.push(`                , ${JSON.stringify(opts)}`)
			}

			indexes.push('            )');
			indexes.push('        })');

		});

	}

	schema = schema.split('\n').map((line) => '            ' + line).join('\n');

	let template = `'use strict';
module.exports = {
    up: function(queryInterface, Sequelize) {
      
            return queryInterface.createTable('${tableName}',${schema});
    },
    down: function(queryInterface, Sequelize) {
       return queryInterface.dropTable('${tableName}');
    }
};`;

	let d = new Date();

	let filename = [d.getFullYear(), d.getMonth()+1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]
			.map((num) => num <= 60 && (num + 100).toString().substring(1) || num)
			.join('') + `-${models[model].tableName}`;

	fs.writeFileSync(`./migrations/${filename}.js`, template);

}