/**
 * Created by zenit1 on 05/12/2016.
 */

'use strict';

module.exports = {
	up: function (queryInterface, Sequelize) {
		return [
			queryInterface.addColumn(
				'GkLogins',
				'serviceId',
				{
					type: Sequelize.UUIDV4,
					allowNull: true
				}
			)
		];
	},

	down: function (queryInterface, Sequelize) {
		return [
			queryInterface.removeColumn('Users', 'isActive')
		];
	}
};
