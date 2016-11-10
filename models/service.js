'use strict';
module.exports = function (sequelize, DataTypes) {
	return sequelize.define('Service', {
			id:   {
				type:          DataTypes.INTEGER,
				primaryKey:    true,
				autoIncrement: true
			},
			url:  {
				type:   DataTypes.STRING,
				unique: true
			},
			code: {
				type:   DataTypes.STRING,
				unique: true
			},
			name: {
				type: DataTypes.STRING
			}
		},
		{
			tableName:       'Services',
			freezeTableName: true
		});

};