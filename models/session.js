'use strict';
module.exports = function (sequelize, DataTypes) {
	var Sessions = sequelize.define('Sessions', {
		id:   {
			type:          DataTypes.INTEGER,
			primaryKey:    true,
			autoIncrement: true
		},
		name:           {
			type: DataTypes.STRING
		},
		email:          {
			type:      DataTypes.STRING,
			unique:    true,
			allowNull: true
		},
		externalUserId: {
			type:      DataTypes.STRING,
			unique:    true,
			allowNull: true
		},
		pin:            DataTypes.STRING
	}, {
		classMethods: {
			associate: function (models) {
				// associations can be defined here
			}
		}
	});
	return Sessions;
};