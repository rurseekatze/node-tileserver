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
var mkdirp = require('mkdirp');
var pg = require('pg');
var toobusy = require('toobusy');
var byline = require('byline');
var touch = require("touch");
var Canvas = require('canvas');
var events = require('events');
var log4js = require('log4js');
var fs = require('graceful-fs');

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
				"filename": 'init.log', 
				'maxLogSize': 20480,
				'backups': 0
			}
		},
		{
			"type": "logLevelFilter",
			"level": "INFO",
			"appender":
			{
				"type": "console"
			}
		}
	]
});
var logger = log4js.getLogger();
logger.setLevel('TRACE');

// load configuraion file
var configuration = require('./config.json');

// load classes
eval(fs.readFileSync('tile.js')+'');

// maximum count of concurrent http connections
http.globalAgent.maxSockets = configuration.maxsockets;


// calculate amount of tiles to render
var listlength = 0;
for (var z = configuration.minZoom; z <= configuration.maxPrerender; z++)
	listlength += Math.pow(Math.pow(2, z), 2);

logger.info("Initial rendering of "+parseInt(listlength/1000)+"k tiles in the background. This process can take some time.");

// render all tiles
var z = configuration.minZoom;
var x = 0;
var y = -1;
var tilecount = Math.pow(2, z);

// removes a tile from the queue if rendered and renders the next tile
var initTileFinished = function renderNextTileInit()
{
	if (os.loadavg()[0] <= cpus+1)
	{
		if (y < tilecount-1)
			y++;
		else
		{
			if (x < tilecount-1)
			{
				x++;
				y = 0;
			}
			else if (z < configuration.maxPrerender)
			{
				z++;
				tilecount = Math.pow(2, z);
				x = 0;
				y = 0;
			}
			else
			{
				logger.info('All tiles rendered. Finished.');
				return;
			}
		}

		var tile = new Tile(z, x, y);
		tile.getVectorData(function(err, data)
		{
			tile.debug('Creating tile...');
			if (err)
			{
				this.eventEmitter.emit('tileFinished');
				return;
			}

			tile.saveVectorData(function(err)
			{
				if (err)
				{
					this.eventEmitter.emit('tileFinished');
					return;
				}

				tile.rerenderBitmap();
				this.eventEmitter.emit('tileFinished');
			});
		});
	}
	else
	{
		logger.info('System load too high, will retry after 5 seconds...');
		setTimeout(function()
		{
			eventEmitter.emit('tileFinished');
		}, 5000);
	}
}
eventEmitter.on('tileFinished', initTileFinished);

eventEmitter.emit('tileFinished');
