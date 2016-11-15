'use strict';
module.exports = {
	up:   function (queryInterface, Sequelize) {
		return queryInterface.createTable('Sessions', {
			id:             {
				allowNull:     false,
				autoIncrement: true,
				primaryKey:    true,
				type:          Sequelize.INTEGER
			},
			name:           {
				type: Sequelize.STRING
			},
			email:          {
				type:      Sequelize.STRING,
				unique:    true,
				allowNull: true
			},
			externalUserId: {
				type:      Sequelize.STRING,
				unique:    true,
				allowNull: true
			},
			pin:            {
				type: Sequelize.STRING
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
	down: function (queryInterface, Sequelize) {
		return queryInterface.dropTable('Sessions');
	}
};