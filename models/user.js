'use strict';
module.exports = function (sequelize, DataTypes) {
	return sequelize.define('User',
		{
			id:               {
				type:          DataTypes.INTEGER,
				primaryKey:    true,
				autoIncrement: true
			},
			fqdn:             {
				type:      DataTypes.STRING,
				unique:    true,
				allowNull: false
			},
			name:             {
				type:      DataTypes.STRING,
				allowNull: true
			},
			nickname:             {
				type:      DataTypes.STRING,
				allowNull: true
			},
			email:            {
				type:      DataTypes.STRING,
				allowNull: true
			},
			externalUserId:   {
				type:      DataTypes.STRING,
				allowNull: true
			},
			isAdmin:         {
				type:         DataTypes.BOOLEAN,
				allowNull:    false,
				defaultValue: false
			},
			isActive:         {
				type:         DataTypes.BOOLEAN,
				allowNull:    false,
				defaultValue: true
			},
			isDeleted:         {
				type:         DataTypes.BOOLEAN,
				allowNull:    false,
				defaultValue: false
			},
			lastActiveDate: {
				type:      DataTypes.DATE,
				allowNull: true
			}
		},
		{
			tableName:       'Users',
			freezeTableName: true,
			indexes:[
				{
					name:'indIsAdmin',
					unique: false,
					fields: ['isAdmin']
				}
			]
		}
	);
};