/*
node-tileserver Copyright (C) 2014 Alexander Matheisen
This program comes with ABSOLUTELY NO WARRANTY.
This is free software, and you are welcome to redistribute it under certain conditions.
See https://github.com/rurseekatze/node-tileserver for details.
*/


// include necessary modules
os = require('os');
rbush = require('rbush');
assert = require('assert');
http = require("http");
url = require("url");
mkdirp = require('mkdirp');
pg = require('pg');
toobusy = require('toobusy-js');
byline = require('byline');
touch = require("touch");
Canvas = require('canvas');
events = require('events');
log4js = require('log4js');
fs = require('graceful-fs');

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
logger = log4js.getLogger();
logger.setLevel('TRACE');

// load classes
Tile = require('./tile.js');

// number of cpus
cpus = os.cpus().length;

var eventEmitter = new events.EventEmitter();


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
eventEmitter.on('tileFinished', function()
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
				logger.info('Rendering zoom level '+z);
				tilecount = Math.pow(2, z);
				x = 0;
				y = 0;
			}
			else
			{
				logger.info('All tiles rendered. Finished.');
				process.exit(code=0);
			}
		}

		var tile = new Tile(z, x, y);
		tile.getVectorData(function(err, data)
		{
			tile.debug('Creating tile...');
			if (err)
			{
				eventEmitter.emit('tileFinished');
				return;
			}

			tile.saveVectorData(function(err)
			{
				if (err)
				{
					eventEmitter.emit('tileFinished');
					return;
				}

				tile.rerenderBitmap();
				eventEmitter.emit('tileFinished');
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
});

logger.info('Rendering zoom level '+z);
eventEmitter.emit('tileFinished');
