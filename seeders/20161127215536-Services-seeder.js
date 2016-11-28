'use strict';
const ServiceCodes = require('../constants').ServiceCodes;

module.exports = {
	up: function (queryInterface) {
		return queryInterface.bulkInsert('Services', [
			{
				name:      'Insta server admin app',
				code:      ServiceCodes.Admin,
				isActive:  true,
				isOnline:  true,
				createdAt: new Date(),
				updatedAt: new Date()
			},
			{
				name:      'Files sharing app',
				code:      ServiceCodes.SampleFileShare,
				url:       'http://127.0.0.1:65511',
				isActive:  true,
				isOnline:  true,
				createdAt: new Date(),
				updatedAt: new Date()
			},
			{
				name:      'Simple chat',
				code:      ServiceCodes.SampleChat,
				url:       'http://127.0.0.1:65510',
				isActive:  true,
				isOnline:  true,
				createdAt: new Date(),
				updatedAt: new Date()
			},
			{
				name:      'Mobile Photos',
				code:      ServiceCodes.MobilePhoto,
				url:       'http://127.0.0.1:65512',
				isActive:  true,
				isOnline:  true,
				createdAt: new Date(),
				updatedAt: new Date()
			},
			{
				name:      'Mobile Stream',
				code:      ServiceCodes.MobileStream,
				url:       'http://127.0.0.1:65513',
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