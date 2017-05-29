'use strict';
const Services = require('../constants').SetupServices;

module.exports = {
	up: function (queryInterface) {
		return queryInterface.bulkInsert('Services', [
			{
				name:      'Admin Invitations',
				code:      Services.AdminInvitation.code,
				isActive:  true,
				isOnline:  true,
				createdAt: new Date(),
				updatedAt: new Date()
			}
		], {});

	},

	down: function (queryInterface) {

		 return queryInterface.bulkDelete('Services', null, {});

	}
};