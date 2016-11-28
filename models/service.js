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
			},
			isActive:         {
				type:         DataTypes.BOOLEAN,
				allowNull:    false,
				defaultValue: true
			},
			isOnline:         {
				type:         DataTypes.BOOLEAN,
				allowNull:    false,
				defaultValue: true
			}
		},
		{
			tableName:       'Services',
			freezeTableName: true
		});

};