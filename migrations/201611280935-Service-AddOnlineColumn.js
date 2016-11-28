/**
 * Created by zenit1 on 28/11/2016.
 */

'use strict';

module.exports = {
	up: function (queryInterface, Sequelize) {
		return [
			queryInterface.addColumn(
				'Services',
				'isOnline',
				{
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue:true
				}
			)
		];
	},

	down: function (queryInterface) {
		return [
			queryInterface.removeColumn('Services', 'isOnline')
		];
	}
};