/**
 * Created by zenit1 on 17/11/2016.
 */

'use strict';

module.exports = {
	up: function (queryInterface) {
		return [
			queryInterface.addIndex(
				'Users',
				['isAdmin'],
				{
					name:   'indIsAdmin',
					unique: false
				}
			)
		];
	},

	down: function (queryInterface) {
		return [
			queryInterface.removeIndex('Users', 'indIsAdmin')
		];
	}
};