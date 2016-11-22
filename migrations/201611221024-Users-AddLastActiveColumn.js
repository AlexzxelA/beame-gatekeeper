/**
 * Created by zenit1 on 17/11/2016.
 */

'use strict';

module.exports = {
	up: function (queryInterface, Sequelize) {
		return [
			queryInterface.addColumn(
				'Users',
				'lastActiveDate',
				{
					type: Sequelize.DATE,
					allowNull: true
				}
			)
		];
	},

	down: function (queryInterface, Sequelize) {
		return [
			queryInterface.removeColumn('Users', 'lastActiveDate')
		];
	}
};