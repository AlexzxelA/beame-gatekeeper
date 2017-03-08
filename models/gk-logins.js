'use strict';
module.exports = function (sequelize, DataTypes) {
	return sequelize.define('GkLogin', {
			id:   {
				type:          DataTypes.INTEGER,
				primaryKey:    true,
				autoIncrement: true
			},
			fqdn:  {
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
			}
		},
		{
			tableName:       'GkLogins',
			freezeTableName: true
		});

};