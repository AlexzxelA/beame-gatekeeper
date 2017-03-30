/**
 * Created by Alexz on 26/03/2017.
 */
let relayManagerRef = null;
const beameSDK   = require('beame-sdk');

class relayManager{
	constructor() {
		this._localSigninRelayFqdn = null;
		if(!relayManagerRef)relayManagerRef = this;
	}

	getLocalRelayFqdn() {
		return new Promise((resolve, reject) => {
			if(this._localSigninRelayFqdn)
				resolve(this._localSigninRelayFqdn);
			else
				this.getBestRelay().then(relay=> {
					this._localSigninRelayFqdn = relay;
					resolve(relay);
				}).catch(e=>{reject(e);})
		});
	}

	getBestRelay() {
		return new Promise((resolve, reject) => {

				const beameUtils = beameSDK.BeameUtils;
				beameUtils.selectBestProxy(null, 10, 1000, (error, payload) => {
					if (!error) {
						resolve(payload.endpoint);
					}
					else {
						reject(error);
					}
				});
			}
		);
	}

	getRelayFqdn(target, lclFqdn){

		const ProvisionApi = beameSDK.ProvApi;
		const authToken    = beameSDK.AuthToken;
		const store        = new (beameSDK.BeameStore)();

		return new Promise((resolve, reject) => {
			try {
				let fqdn     = lclFqdn,
					cred     = fqdn && store.getCredential(fqdn),
					token    = cred && authToken.create(fqdn, cred, 10),
					provisionApi = new ProvisionApi();

				//provisionApi.makeGetRequest(`https://${matching}${apiConfig.Actions.Matching.GetRelay.endpoint}`, null, (error, payload) => {
				provisionApi.makeGetRequest(target, null, (error, payload) => {
					if (error) {
						reject(error);
					}
					else {
						if(payload.beame_login_config)
							resolve(payload.beame_login_config.relay);
						else
							resolve(payload.relay);
					}
				}, token, 5);
			} catch (e) {
				reject(e);
			}
		});
	}

	static getInstance(){
		return relayManagerRef;
	}

}
module.exports = relayManager;