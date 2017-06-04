'use strict';
const Services = require('../constants').SetupServices;

module.exports = {
	up: function (queryInterface) {
		return queryInterface.bulkInsert('Services', [
			{
				name:      'Insta server admin app',
				code:      Services.Admin.code,
				isActive:  true,
				isOnline:  true,
				createdAt: new Date(),
				updatedAt: new Date()
			},
			{
				name:      'Files sharing app',
				code:      Services.SampleFileShare.code,
				//url:       `http://127.0.0.1:${Services.SampleFileShare.port}`,
				isActive:  true,
				isOnline:  true,
				createdAt: new Date(),
				updatedAt: new Date()
			},
			{
				name:      'Simple chat',
				code:      Services.SampleChat.code,
				//url:       `http://127.0.0.1:${Services.SampleChat.port}`,
				isActive:  true,
				isOnline:  true,
				createdAt: new Date(),
				updatedAt: new Date()
			},
			{
				name:      'Mobile Photos',
				code:      Services.MobilePhoto.code,
				//url:       `http://127.0.0.1:${Services.MobilePhoto.port}`,
				isActive:  true,
				isOnline:  true,
				isMobile:  true,
				createdAt: new Date(),
				updatedAt: new Date()
			},
			{
				name:      'Mobile Stream',
				code:      Services.MobileStream.code,
				//url:       `http://127.0.0.1:${Services.MobileStream.port}`,
				isActive:  false,
				isOnline:  false,
				isMobile:  true,
				createdAt: new Date(),
				updatedAt: new Date()
			}
		], {});

	},

	down: function (queryInterface) {

		return queryInterface.bulkDelete('Services', null, {});

	}
};