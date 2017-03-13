/**
 * Created by zenit1 on 15/11/2016.
 */
"use strict";

/**
 * @typedef {Object} DataServicesSettings
 * @property {Number} session_timeout
 */

const beameSDK     = require('beame-sdk');
const module_name  = "DataServices";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const Bootstrapper = require('./bootstrapper');
const bootstrapper = Bootstrapper.getInstance();
const Constants    = require('../constants');
const DbProviders  = Constants.DbProviders;

let dataServicesInstance = null;

class DataServices {

	/**
	 * @param {DataServicesSettings} options
	 */
	constructor(options) {

		this._options = options || {};

		this._dbProvider = bootstrapper.dbProvider;
		this._dbService  = null;

		if (!this._dbProvider) {
			logger.error(`Db Provider not defined`);
			return;
		}

		switch (this._dbProvider) {
			case DbProviders.Sqlite:
				this._dbService = new (require('./db/sqlite'))(this._options);
				break;

			case DbProviders.Couchbase:
				this._dbService = new (require('./db/couchbase'))(this._options);
				break;

			default:
				logger.error(`Unknown Db Provider ${this._dbProvider}`);
				return;
		}

	}

	start() {
		return this._dbService.start();
	}

	//region registration services
	getRegistrations() {
		return this._dbService.getRegistrations();
	}

	/**
	 *
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	saveRegistration(data) {
		return this._dbService.saveRegistration(data);
	}

	deleteRegistration(id) {
		return this._dbService.deleteRegistration(id);
	}

	/**
	 * @param {String} fqdn
	 * @returns {Promise.<Registration>}
	 */
	markRegistrationAsCompleted(fqdn) {
		return this._dbService.markRegistrationAsCompleted(fqdn);
	}

	/**
	 * @param {String} fqdn
	 * @param {Boolean} isActive
	 */
	updateUserActiveStatus(fqdn,isActive) {
		return this._dbService.updateUserActiveStatus(fqdn,isActive);
	}

	/**
	 * @param {String} fqdn
	 */
	markUserAsDeleted(fqdn) {
		return this._dbService.markUserAsDeleted(fqdn);
	}

	/**
	 * @param {RegistrationData} data
	 * @returns {Promise.<Registration|null>}
	 */
	isRegistrationExists(data){
		return this._dbService.isRegistrationExists(data);
	}

	/**
	 * @param id
	 * @param {Object|String} sign
	 */
	updateRegistrationHash(id, sign) {
		return this._dbService.updateRegistrationHash(id, sign);
	}

	updateRegistrationPin(id, pin) {
		return this._dbService.updateRegistrationPin(id, pin);
	}

	updateRegistrationCertFlag(id) {
		return this._dbService.updateRegistrationCertFlag(id);
	}

	updateRegistrationUserDataFlag(id){
		return this._dbService.updateRegistrationUserDataFlag(id);
	}

	/**
	 * @param {String} hash
	 * @param {String} fqdn
	 * @returns {*}
	 */
	updateRegistrationFqdn(hash, fqdn) {
		return this._dbService.updateRegistrationFqdn(hash, fqdn);
	}


	/**
	 * @param {String} hash
	 * @returns {Promise}
	 */
	findRegistrationRecordByHash(hash) {
		return this._dbService.findRegistrationRecordByHash(hash);
	}

	findRegistrationRecordByFqdn(fqdn) {
		return this._dbService.findRegistrationRecordByFqdn(fqdn);
	}

	//endregion

	//region sessions
	/**
	 * @param {RegistrationData} data
	 * @returns {Promise}
	 */
	saveSession(data) {
		return this._dbService.saveSession(data);
	}

	/**
	 * @param {String} pin
	 * @returns {Promise}
	 */
	deleteSession(pin) {
		return this._dbService.deleteSessionByPin(pin);
	}

	//endregion

	//region user
	/**
	 * @param {User} user
	 */
	saveUser(user) {
		return this._dbService.saveUser(user);
	}

	/**
	 * @param fqdn
	 * @returns {Promise.<User>}
	 */
	findUser(fqdn) {
		return this._dbService.findUser(fqdn);
	}

	/**
	 *
	 * @param predicate
	 * @returns {Promise}
	 */
	searchUsers(predicate) {
		return this._dbService.searchUsers(predicate);
	}

	/**
	 * @param fqdn
	 * @returns {*}
	 */
	updateLoginInfo(fqdn) {
		return this._dbService.updateLoginInfo(fqdn);
	}

	updateUser(user) {
		return this._dbService.updateUser(user);
	}

	updateUserProfile(user) {
		return this._dbService.updateUserProfile(user);
	}

	getUsers() {
		return this._dbService.getUsers();
	}


	//endregion

	//region services
	getServices() {
		return this._dbService.getServices();
	}

	getActiveServices() {
		return this._dbService.getActiveServices();
	}

	saveService(service) {
		return this._dbService.saveService(service);
	}

	updateService(service) {
		return this._dbService.updateService(service);
	}

	deleteService(id) {
		return this._dbService.deleteService(id);
	}

	//endregion

	//region GK Logins
	getGkLogins() {
		return this._dbService.getGkLogins();
	}

	findLogin(fqdn) {
		return this._dbService.findLogin(fqdn);
	}

	saveGkLogin(login) {
		return this._dbService.saveGkLogin(login);
	}

	updateGkLogin(login) {
		return this._dbService.updateGkLogin(login);
	}

	deleteGkLogin(id) {
		return this._dbService.deleteGkLogin(id);
	}

	//endregion

	/**
	 *
	 * @param {DataServicesSettings|null|undefined} [options]
	 * @returns {DataServices}
	 */
	static getInstance(options){
		if(!dataServicesInstance){
			dataServicesInstance = new DataServices(options);
		}

		return dataServicesInstance;
	}
}


module.exports = DataServices;