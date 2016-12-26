var CefManager = kendo.Class.extend({
    cefObj : window.beameCefBrowser,
    matchingFqdn: '',
    gwFqdn: '',

    init: function () {
        var that = this;
        //that.matchingFqdn = that.cefObj.matchingFqdn();
        //that.gwFqdn = that.cefObj.gwFqdn();
    },

    getMatchingFqdn: function() {

        return this.matchingFqdn;
    },

    getGwFqdn: function() {
        return this.gwFqdn;
    },

    showMessage:function(msg) {
	    this.cefObj && this.cefObj.showClientMessage(msg);
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