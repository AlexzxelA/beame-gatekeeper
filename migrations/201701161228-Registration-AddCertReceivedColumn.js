/**
 * Created by zenit1 on 2017/01/11.
 */

'use strict';

module.exports = {
	up: function (queryInterface, Sequelize) {
		return [
			queryInterface.addColumn(
				'Registrations',
				'certReceived',
				{
					type:         Sequelize.BOOLEAN,
					allowNull:    false,
					defaultValue: false
				}
			)
		];
	},

	down: function (queryInterface) {
		return [
			queryInterface.removeColumn('Registrations', 'certReceived')
		];
	}
};
