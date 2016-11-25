/**
 * Created by zenit1 on 17/11/2016.
 */

'use strict';

module.exports = {
	up: function (queryInterface, Sequelize) {
		return [
			queryInterface.addColumn(
				'Services',
				'isActive',
				{
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue:true
				}
			)
		];
	},

	down: function (queryInterface, Sequelize) {
		return [
			queryInterface.removeColumn('Services', 'isActive')
		];
	}
};