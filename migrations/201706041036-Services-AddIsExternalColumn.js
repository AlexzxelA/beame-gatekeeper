/**
 * Created by zenit1 on 05/12/2016.
 */

'use strict';

module.exports = {
	up: function (queryInterface, Sequelize) {
		return [
			queryInterface.addColumn(
				'Services',
				'isExternal',
				{
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue:false
				}
			)
		];
	},

	down: function (queryInterface) {
		return [
			queryInterface.removeColumn('Services', 'isExternal')
		];
	}
};
