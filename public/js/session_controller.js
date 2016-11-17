/**
 * Created by zenit1 on 17/11/2016.
 */
"use strict";

function startGatewaySession(authToken) {

	var socket = io.connect('/', {path: '/beame-gw/socket.io'});

	socket.on('data', data => {
		data = JSON.parse(data);
		console.log('DATA %j', data);
		var session_token, apps;
		if (data.type == 'authenticated') {
			console.log('data/authenticated');
			session_token = data.payload.session_token;
			apps          = data.payload.apps;

			socket.emit('data', {
				type:    'choose',
				payload: {
					session_token: session_token,
					id:            1
				}
			});
			socket.emit('data', {
				type:    'choose',
				payload: {
					session_token: session_token,
					id:            4
				}
			});

			setTimeout(() => {
				socket.emit('data', {
					type:    'logout',
					payload: {
						session_token: session_token
					}
				});
			}, 1000);
		}
	});
}