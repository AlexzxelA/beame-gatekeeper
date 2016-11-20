/**
 * Created by zenit1 on 18/11/2016.
 */
"use strict";

var auth_mode = 'Session',
    stopAllRunningSessions = false,
    reg_data = null,
    socketio_options = {path: '/beame-gw-insta-socket', 'force new connection': true, transports: ['polling']};
