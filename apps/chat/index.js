'use strict';

const beameSDK    = require('beame-sdk');
const module_name = "ChatApp";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const port = 65510;
const host = 'localhost';

// Hack attack!

class Server {

	start() {
		var express = require('express');
		var app = express();
		var http = require('http').Server(app);
		var io = require('socket.io')(http);

		app.use('/', express.static(__dirname + '/public'));

		var numUsers = 0;

		io.on('connection', function (socket) {
			var addedUser = false;

			// when the client emits 'new message', this listens and executes
			socket.on('new message', function (data) {
				// we tell the client to execute 'new message'
				socket.broadcast.emit('new message', {
					username: socket.username,
					message: data
				});
			});

			// when the client emits 'add user', this listens and executes
			socket.on('add user', function (username) {
				if (addedUser){ return;}

				// we store the username in the socket session for this client
				socket.username = username;
				++numUsers;
				addedUser = true;
				socket.emit('login', {
					numUsers: numUsers
				});
				// echo globally (all clients) that a person has connected
				socket.broadcast.emit('user joined', {
					username: socket.username,
					numUsers: numUsers
				});
			});

			// when the client emits 'typing', we broadcast it to others
			socket.on('typing', function () {
				socket.broadcast.emit('typing', {
					username: socket.username
				});
			});

			// when the client emits 'stop typing', we broadcast it to others
			socket.on('stop typing', function () {
				socket.broadcast.emit('stop typing', {
					username: socket.username
				});
			});

			// when the user disconnects.. perform this
			socket.on('disconnect', function () {
				if (addedUser) {
					--numUsers;

					// echo globally that this client has left
					socket.broadcast.emit('user left', {
						username: socket.username,
						numUsers: numUsers
					});
				}
			});
		});

		http.listen(port, host, function(){
			logger.info(`Listening on ${host}:${port}`);
		});

		this._app = app;
		this._http = http;
	}
}

module.exports = Server;
