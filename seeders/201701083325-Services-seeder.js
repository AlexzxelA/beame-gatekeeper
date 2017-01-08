'use strict';
const Services = require('../constants').SetupServices;

module.exports = {
	up: function (queryInterface) {
		return queryInterface.bulkInsert('Services', [
			{
				name:      'Raspberry Light',
				code:      Services.RaspberryLight.code,
				url:       `http://127.0.0.1:${Services.RaspberryLight.port}`,
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