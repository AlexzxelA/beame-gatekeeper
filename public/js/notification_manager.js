/**
 * Created by zenit1 on 26/11/2016.
 */

var NotificationManager = kendo.Class.extend({
	queue: [],

	init: function () {
		var that = this;
		that.queue = [];
	},

	subscribe: function (eventName, callback, context) {
		var that = this;
		if (!that.queue[eventName]) {
			that.queue[eventName] = [];
		}
		that.queue[eventName].push({
			callback: callback,
			context: context
		});
	},

	unsubscribe: function (eventName, callback, context) {
		var that = this;

		if (that.queue[eventName]) {
			that.queue[eventName].pop({
				callback: callback,
				context: context
			});
		}
	},

	notify: function (eventName, data) {
		var that = this;
		var context, intervalId, idx = 0;

		if (that.queue[eventName]) {
			intervalId = setInterval(function () {
				if (that.queue[eventName][idx]) {
					try {
						context = that.queue[eventName][idx].context || this;
						that.queue[eventName][idx].callback.call(context, data);
					} catch (e) {
					}

					idx += 1;
				} else {
					clearInterval(intervalId);
				}
			}, 0);

		}
	}
});

var notificationManager;

function getNotifManagerInstance() {
	if (notificationManager == undefined || notificationManager == null) {
		notificationManager = new NotificationManager();
	}
	return notificationManager;
}