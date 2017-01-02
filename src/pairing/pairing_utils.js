/**
 * Created by Alexz on 31/12/2016.
 */

const beameSDK         = require('beame-sdk');
const CommonUtils      = beameSDK.CommonUtils;
const beameUtils       = beameSDK.BeameUtils;
const authToken        = beameSDK.AuthToken;
const BeameLogger      = beameSDK.Logger;
const store            = new beameSDK.BeameStore();
const crypto           = require('crypto');
const logger           = new BeameLogger(module_name);
const Bootstrapper     = require('../bootstrapper');
const bootstrapper     = Bootstrapper.getInstance();
var module_name         = '*PairingUtils*';

class PairingUtils{
	constructor(fqdn, inSocket, name){
		this._fqdn              = fqdn;
		this._socket            = inSocket;
		this._userImage         = null;
		module_name              += name;
	}

	_setUserImage(data){
		return new Promise((resolve, reject)=>{
			store.find(this._fqdn, false).then( selfCred => {
				this._userImage = selfCred.sign(data);
				resolve();
			}).catch(function (e) {
				this._userImage = 'none';
				reject();
			});
		});

	}


	setCommonHandlers(){

		this._socket.on('userImageVerify',  (data) => {
			logger.info('Requested image verification:', data);
			let self = this;
			store.find(this._fqdn, false).then( selfCred => {
				if(selfCred.checkSignature(JSON.parse(data))){
					self._socket.emit('userImageStatus','pass')
				}
				else{
					logger.info('Image signature invalid');
					self._socket.emit('userImageStatus','fail');
				}
			}).catch(function (e) {
				logger.info('Failed in image verification',e.message);
				self._socket.emit('userImageStatus','fail');
			});

		});

		this._socket.on('userImageOK',(data)=>{
			let self = this;
			this._setUserImage(data).then(()=>{
				logger.info('user image verified:',self._userImage.signature);
				self._socket.emit('userImageSign', {'data': {'imageSign': self._userImage.signature,
					'imageSignedBy':self._userImage.signedBy},
					'type': 'userImageSign'});
			}).catch(function (e){
				logger.info('Failed in image signing:',e.message);
				self._socket.emit('userImageStatus','fail');
			});
		});
	}

}

module.exports = PairingUtils;