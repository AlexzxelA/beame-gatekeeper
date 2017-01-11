'use strict';
module.exports = function (sequelize, DataTypes) {
	return sequelize.define('Registration',
		{
			id:            {
				type:          DataTypes.INTEGER,
				primaryKey:    true,
				autoIncrement: true
			},
			name:          {
				type: DataTypes.STRING
			},
			email:         {
				type:     DataTypes.STRING,
				allowNull : true
			},
			externalUserId:         {
				type:     DataTypes.STRING,
				allowNull : true
			},
			pin:         {
				type:     DataTypes.STRING,
				allowNull : true
			},
			hash:          {
				type:   DataTypes.TEXT,
				unique: true
			},
			hashValidTill: {
				type: DataTypes.TIME
			},
			completed:     {
				type:         DataTypes.BOOLEAN,
				allowNull:    false,
				defaultValue: false
			},
			fqdn:          {
				type:   DataTypes.STRING,
				unique: true
			}
		},
		{
			tableName:       'Registrations',
			freezeTableName: true
		}
	);
};