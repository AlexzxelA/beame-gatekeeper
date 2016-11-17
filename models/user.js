'use strict';
module.exports = function (sequelize, DataTypes) {
	return sequelize.define('User', {
			id:             {
				type:          DataTypes.INTEGER,
				primaryKey:    true,
				autoIncrement: true
			},
			fqdn:           {
				type:      DataTypes.STRING,
				unique:    true,
				allowNull: false
			},
			name:           {
				type:      DataTypes.STRING,
				allowNull: true
			},
			email:          {
				type:      DataTypes.STRING,
				allowNull: true
			},
			externalUserId: {
				type:      DataTypes.STRING,
				allowNull: true
			}
		},
		{
			tableName:       'Users',
			freezeTableName: true
		});
};