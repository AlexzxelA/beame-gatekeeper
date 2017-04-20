'use strict';
module.exports = {
	up: function(queryInterface, Sequelize) {

		return queryInterface.createTable('Hooks', {
			id:             {
				allowNull:     false,
				autoIncrement: true,
				primaryKey:    true,
				type:          Sequelize.INTEGER
			},
			hook:           {
				type: Sequelize.STRING,
				allowNull: false
			},
            path:          {
				type:      Sequelize.STRING,
				allowNull: false
			},
			isActive: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue:true
			},
			createdAt:      {
				allowNull: false,
				type:      Sequelize.DATE
			},
			updatedAt:      {
				allowNull: false,
				type:      Sequelize.DATE
			}
		});
	},
	down: function(queryInterface, Sequelize) {
		return queryInterface.dropTable('Hooks');
	}
};