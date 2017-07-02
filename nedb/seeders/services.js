/**
 * Created by zenit1 on 02/07/2017.
 */
"use strict";
const Services = require('../../constants').SetupServices;
const uuid     = require('uuid');

module.exports = [
	{
		name:       'Insta server admin app',
		code:       Services.Admin.code,
		isActive:   true,
		isOnline:   true,
		isExternal: false,
		isMobile:   false,
		createdAt:  new Date(),
		updatedAt:  new Date()
	},
	{
		name:       'Admin Invitations',
		code:       Services.AdminInvitation.code,
		isActive:   true,
		isOnline:   true,
		isExternal: false,
		isMobile:   false,
		createdAt:  new Date(),
		updatedAt:  new Date()
	},
	{
		name:       'Raspberry Light',
		code:       Services.RaspberryLight.code,
		isActive:   false,
		isOnline:   false,
		isExternal: true,
		isMobile:   false,
		createdAt:  new Date(),
		updatedAt:  new Date()
	},
	{
		name:       'Files sharing app',
		code:       Services.SampleFileShare.code,
		isActive:   true,
		isOnline:   true,
		isExternal: false,
		isMobile:   false,
		createdAt:  new Date(),
		updatedAt:  new Date()
	},
	{
		name:       'Simple chat',
		code:       Services.SampleChat.code,
		isActive:   true,
		isOnline:   true,
		isExternal: false,
		isMobile:   false,
		createdAt:  new Date(),
		updatedAt:  new Date()
	},
	{
		name:       'Mobile Photos',
		code:       Services.MobilePhoto.code,
		isActive:   true,
		isOnline:   true,
		isExternal: false,
		isMobile:   true,
		createdAt:  new Date(),
		updatedAt:  new Date()
	},
	{
		name:       'Mobile Stream',
		code:       Services.MobileStream.code,
		isActive:   false,
		isOnline:   false,
		isExternal: false,
		isMobile:   true,
		createdAt:  new Date(),
		updatedAt:  new Date()
	}
];