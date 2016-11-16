'use strict';

const port = 65510;
const host = 'localhost';

class Server {

	start() {
		console.log('Starting chat server');

		var app = require('express')();
		var http = require('http').Server(app);
		var io = require('socket.io')(http);

		app.get('/', function(req, res){
			res.sendFile(__dirname + '/index.html');
		});

		io.on('connection', function(socket){
			console.log('a user connected');
			socket.on('disconnect', function(){
				console.log('user disconnected');
			});
			socket.on('chat message', function(msg){
				console.log('message: ' + msg);
				io.emit('chat message', msg);
			});
		});

		http.listen(port, host, function(){
			console.log(`listening on ${host}:${port}`);
		});

		this._app = app;
		this._http = http;
	}
}

module.exports = Server;
