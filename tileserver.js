/*
node-tileserver Copyright (C) 2014 Alexander Matheisen
This program comes with ABSOLUTELY NO WARRANTY.
This is free software, and you are welcome to redistribute it under certain conditions.
See https://github.com/rurseekatze/node-tileserver for details.
*/


// include necessary modules
var cluster = require('cluster');
var os = require('os');
var rbush = require('rbush');
var assert = require('assert');
var http = require("http");
var url = require("url");
var toobusy = require('toobusy-js');
var byline = require('byline');
var touch = require("touch");
var Canvas = require('canvas');
var events = require('events');
var log4js = require('log4js');
var fs = require('graceful-fs');

// load configuraion file
configuration = require('./config.json');

// configure logging
log4js.configure(
{
	appenders:
	[
		{
			"type": "logLevelFilter",
			"level": "ERROR",
			"appender":
			{
				"type": "file",
				"filename": 'tileserver.log', 
				'maxLogSize': 20480,
				'backups': 0
			}
		},
		{
			"type": "logLevelFilter",
			"level": "DEBUG",
			"appender":
			{
				"type": "console"
			}
		}
	]
});

logger = log4js.getLogger();
logger.setLevel('INFO');

Tile = require('./tile.js');
Tilerequest = require('./tilerequest.js');
Tilequeue = require('./queue.js');

// number of cpus
var cpus = os.cpus().length;

// maximum count of concurrent http connections
http.globalAgent.maxSockets = configuration.maxsockets;


// fork workers
if (cluster.isMaster)
{
	for (var i=0; i<cpus; i++)
		cluster.fork();
	cluster.on("exit", function(worker, code, signal)
	{
		logger.fatal("WORKER STOPPED");
		cluster.fork();
	});
	logger.info('Master has started.');
}
// start tile server instance
else
{
	// handle exceptions
	process.on('uncaughtException', function(err)
	{
		logger.fatal('An uncaughtException occurred:');
		logger.fatal(err);
		process.exit(1);
	});

	// rendering queue for expired tiles
	queue = new Tilequeue();

	function onRequest(request, response)
	{
		if (toobusy())
		{
			logger.info('Server too busy. Aborting.');
			response.writeHead(503, {'Content-Type': 'text/plain'});
			response.end();
			return;
		}
		else
		{
			var tilerequest = new Tilerequest(request, response);
			tilerequest.getTile();
			tilerequest = null;
		}
	}

	http.createServer(onRequest).listen(configuration.tileserverPort);
	logger.info('Worker has started.');
}
