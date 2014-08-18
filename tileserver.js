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
var toobusy = require('toobusy');
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
			"level": "WARN",
			"appender":
			{
				"type": "console"
			}
		}
	]
});

logger = log4js.getLogger();
logger.setLevel('INFO');

// load classes
Tile = require('./tile.js');
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
			var pathname = url.parse(request.url).pathname;
			logger.info('Request for '+pathname+' received.');

			var params = pathname.split("/");
			if (params.length < 5 || params.length > 6)
			{
				logger.info('Request for '+pathname+' received.');
				logger.info('URL format of '+pathname+' not valid. Aborting.');
				response.writeHead(400, {'Content-Type': 'text/plain'});
				response.end();
				return;
			}

			var tile = new Tile(params[2], params[3], params[4].replace(".png", "").replace(".js", ""), params[1]);
			var command = params[5];

			// check validity of parameters
			if (tile.z < configuration.minZoom || tile.z > configuration.maxZoom)
			{
				tile.info('Requested zoom level not valid. Aborting.');
				response.writeHead(403, {'Content-Type': 'text/plain'});
				response.end();
				tile.destroy();
				tile = null;
				return;
			}
			if (tile.style == "" || (configuration.styles.indexOf(tile.style) == -1 && tile.style != "vector"))
			{
				tile.info('Requested rendering style '+tile.style+' not valid. Aborting.');
				response.writeHead(403, {'Content-Type': 'text/plain'});
				response.end();
				tile.destroy();
				tile = null;
				return;
			}
			if (command != "dirty" && typeof command != "undefined")
			{
				tile.info('Requested command '+command+' not valid. Aborting.');
				response.writeHead(403, {'Content-Type': 'text/plain'});
				response.end();
				tile.destroy();
				tile = null;
				return;
			}

			// handle requests for vector tiles
			if (tile.style == "vector")
			{
				tile.debug('Vector tile requested.');
				tile.readVectorData(function(err, data)
				{
					if (err || command == "dirty" || command == "compress")
					{
						if (err)
							tile.debug('Vectortile not cached, needs to be created...');
						if (command == "dirty")
							tile.debug('Vectortile dirty, needs to be refreshed...');

						tile.getVectorData(function(err, data)
						{
							if (err)
							{
								tile.warn('Vectortile could not be created. Aborting.');
								response.writeHead(500, {'Content-Type': 'application/javascript'});
								response.end();
								tile.destroy();
								tile = null;
								return;
							}
							tile.debug('Vector tile created successfully, saving vector tile...');

							var jsondata = JSON.stringify(data);
							tile.saveVectorData(function(err)
							{
								if (err)
									tile.warn('Vector tile could not be saved.');

								tile.debug('Returning vector tile...');
								response.writeHead(200, {'Content-Type': 'application/javascript'});
								response.end(tile.getDataString());
								tile.debug('Finished request.');
								tile.destroy();
								tile = null;
								return;
							});
						});
					}
					else
					{
						// check if tile is expired and add it to the queue if necessary
						tile.isExpired(function(expired)
						{
							if (expired)
								queue.add(tile);
						});

						tile.debug('Returning vector tile...');
						response.writeHead(200, {'Content-Type': 'application/javascript'});
						response.end(tile.getDataString());
						tile.debug('Finished request.');
						tile.destroy();
						tile = null;
						return;
					}
				});
			}
			// handle requests for bitmap tiles
			else
			{
				tile.debug('Bitmap tile requested.');
				tile.bitmapIsCached(function(exists)
				{
					// if tile is already rendered, return the cached image
					if (exists && typeof command == "undefined")
					{
						tile.debug('Bitmap tile already rendered, returning cached data...');
						tile.readBitmapData(function(err, data)
						{
							if (err)
							{
								tile.warn('Cannot read cached bitmap tile. Returning status 500.');
								response.writeHead(500, {'Content-Type': 'text/plain'});
								response.end();
								tile.destroy();
								tile = null;
								return;
							}

							tile.trace('Returning bitmap tile...');
							response.writeHead(200, {'Content-Type': 'image/png'});
							response.end(data);
							tile.debug('Bitmap tile returned.');
							tile.debug('Finished request.');

							// check if tile is expired and add it to the queue if necessary
							tile.isExpired(function(expired)
							{
								if (expired)
									queue.add(tile);

								tile.destroy();
								tile = null;
								return;
							});
						});
					}
					// otherwise render the tile
					else
					{
						tile.debug('Bitmap tile not cached...');

						tile.trace('MapCSS style successfully loaded.');
						tile.readVectorData(function(err, data)
						{
							if (err || command == "dirty")
							{
								if (err)
									tile.debug('Vectortile not cached, needs to be created...');
								if (command == "dirty")
									tile.debug('Vectortile dirty, needs to be refreshed...');

								tile.getVectorData(function(err, data)
								{
									if (err)
									{
										tile.warn('Vectortile could not be created. Aborting.');
										response.writeHead(500, {'Content-Type': 'text/plain'});
										response.end();
										tile.destroy();
										tile = null;
										return;
									}
									tile.debug('Vector tile created successfully, saving vector tile...');
									tile.saveVectorData(function(err)
									{
										if (err)
											tile.warn('Vector tile could not be saved.');

										tile.debug('Rendering bitmap tile with style '+tile.style);
										tile.render(function(err, image)
										{
											if (err)
												tile.debug('Vectortile was empty.');
											tile.saveBitmapData(image, function(err)
											{
												if (err)
												{
													response.writeHead(500, {'Content-Type': 'text/plain'});
													response.end();
													tile.debug('Empty bitmap tile was responded to the request.');
													tile.debug('Finished request.');
													tile.destroy();
													tile = null;
													return;
												}

												tile.trace('Responding bitmap data...');
												var stream = image.createPNGStream();
												response.writeHead(200, {'Content-Type': 'image/png'});

												// write PNG data stream
												stream.on('data', function(data)
												{
													response.write(data);
												});

												// PNG data stream ended
												stream.on('end', function()
												{
													response.end();
													tile.debug('Bitmap tile was responded to the request.');
													tile.debug('Finished request.');
													tile.destroy();
													tile = null;
													return;
												});
											});
										});
									});
								});
							}
							else
							{
								// check if tile is expired and add it to the queue if necessary
								tile.isExpired(function(expired)
								{
									if (expired)
										queue.add(tile);

									tile.debug('Rendering bitmap tile with style '+tile.style);
									tile.render(function(err, image)
									{
										if (err)
											tile.debug('Vectortile was empty.');
										tile.saveBitmapData(image, function(err)
										{
											if (err)
											{
												response.writeHead(500, {'Content-Type': 'text/plain'});
												response.end();
												tile.debug('Empty bitmap tile was responded to the request.');
												tile.debug('Finished request.');
												tile.destroy();
												tile = null;
												return;
											}

											tile.trace('Responding bitmap data...');
											var stream = image.createPNGStream();
											response.writeHead(200, {'Content-Type': 'image/png'});

											// write PNG data stream
											stream.on('data', function(data)
											{
												response.write(data);
											});

											// PNG data stream ended
											stream.on('end', function()
											{
												response.end();
												tile.debug('Bitmap tile was responded to the request.');
												tile.debug('Finished request.');
												tile.destroy();
												tile = null;
												return;
											});
										});
									});
								});
							}
						});
					}
				});
			}
		}
	}

	http.createServer(onRequest).listen(configuration.tileserverPort);
	logger.info('Worker has started.');
}
