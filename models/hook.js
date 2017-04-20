'use strict';
module.exports = function (sequelize, DataTypes) {
	return sequelize.define('Hook', {
			id:   {
				type:          DataTypes.INTEGER,
				primaryKey:    true,
				autoIncrement: true
			},
			hook:           {
				type: DataTypes.STRING,
				allowNull: false
			},
			path:          {
				type:      DataTypes.STRING,
				allowNull: false
			},
			isActive: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue:true
			}
		},
		{
			tableName:       'Hooks',
			freezeTableName: true
		});

};