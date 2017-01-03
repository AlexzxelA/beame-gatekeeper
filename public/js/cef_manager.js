var CefManager = kendo.Class.extend({
    cefObj : window.beameCefBrowser,

    init: function () {

    },

    showMessage:function(msg) {
	    this.cefObj && this.cefObj.showClientMessage(msg);
    },

	notifyUserData:function(data) {
		this.cefObj && this.cefObj.showUserdata(data.user_id);
	},

    changeState:function(state) {
       this.cefObj && this.cefObj.changeState(state);
    }
});

var cefManager;

function getCefManagerInstance() {
    if (cefManager == undefined || cefManager == null) {
        cefManager = new CefManager();
    }
    return cefManager;
}