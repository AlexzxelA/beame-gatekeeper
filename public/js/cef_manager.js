var CefManager = kendo.Class.extend({
    cefObj : window.beameCefBrowser,

    init: function () {

    },

    showMessage:function(msg) {
	    this.cefObj && this.cefObj.showClientMessage(msg);
    },

	notifyUserData:function(data) {
		if(this.cefObj){
			var userIdActionResult =	this.cefObj.showUserdata(data.user_id);

			if(userIdActionResult){
				this.changeState(1);

				window.getNotifManagerInstance().notify('CLOSE_SESSION');
			}
		}
	},

    changeState:function(state) {
       this.cefObj && this.cefObj.changeState(state);
    },

    reload:function() {
       this.cefObj && this.cefObj.reload();
    }
});

var cefManager;

function getCefManagerInstance() {
    if (cefManager == undefined || cefManager == null) {
        cefManager = new CefManager();
    }
    return cefManager;
}