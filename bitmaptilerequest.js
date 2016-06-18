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
var url = require("url");
var mkdirp = require('mkdirp');
var pg = require('pg');
var toobusy = require('toobusy-js');
var byline = require('byline');
var touch = require("touch");
var Canvas = require('canvas');
var events = require('events');
var log4js = require('log4js');
var fs = require('graceful-fs');


BitmapTilerequest = function(self)
{
	this.tile = self.tile;
	this.response = self.response;
	this.command = self.command;
	this.queue = self.queue;
	this.requestModified = self.requestModified;
};

BitmapTilerequest.prototype =
{
	// save the rendered image to disk and send it to the client
	renderCallback: function(err, image)
	{
		var self = this;

		if (err)
			self.tile.debug('Vectortile was empty.');

		self.tile.saveBitmapData(image, function(err)
		{
			if (err || image == null)
			{
				self.response.writeHead(500, {'Content-Type': 'text/plain'});
				self.response.end();
				self.tile.debug('Empty bitmap tile was responded to the request.');
				self.tile.debug('Finished request.');
				return;
			}

			self.tile.getModifyTime(function(err, mtime)
			{
				var header = self.getHeader();

				if (!err)
					header['Last-Modified'] = mtime.toUTCString();

				self.tile.trace('Responding bitmap data...');
				var stream = image.createPNGStream();
				self.response.writeHead(200, header);

				// write PNG data stream
				stream.on('data', function(data)
				{
					self.response.write(data);
				});

				// PNG data stream ended
				stream.on('end', function()
				{
					self.response.end();
					self.tile.debug('Bitmap tile was responded to the request.');
					self.tile.debug('Finished request.');
					return;
				});
			});
		});
	},

	// serves a bitmap tile
	getTile: function()
	{
		var self = this;
		self.tile.debug('Bitmap tile requested.');
		self.tile.bitmapIsCached(function(exists)
		{
			// if tile is already rendered, return the cached image
			if (exists && typeof self.command == "undefined")
			{
				self.tile.debug('Bitmap tile already rendered, returning cached data...');
				self.tile.readBitmapData(function(err, data)
				{
					if (err)
					{
						self.abortRequest('Cannot read cached bitmap tile. Returning status 500.');
						return;
					}

					self.tile.trace('Returning bitmap tile...');

					// check if tile is expired and add it to the queue if necessary
					self.tile.isExpired(function(expired)
					{
						if (expired)
							self.queue.add(self.tile);

						self.tile.getModifyTime(function(err, mtime)
						{
							var header = {
								'Content-Type': 'image/png'
							};

							if (!err)
								header['Last-Modified'] = mtime.toUTCString();

							if (expired)
								header['Cache-Control'] = 'max-age=0';
							else
								header['Cache-Control'] = 'public, max-age=3600';

							if (!err && self.requestModified.getTime() == mtime.getTime() && !expired)
							{
								self.response.writeHead(304, header);
								self.response.end();
								self.tile.debug('Bitmap tile cached on client.');
								self.tile.debug('Finished request.');
								return;
							}
							else
							{
								self.response.writeHead(200, header);
								self.response.end(data);
								self.tile.debug('Bitmap tile returned.');
								self.tile.debug('Finished request.');
								return;
							}
						});
					});
				});
			}
			// otherwise render the tile
			else
			{
				self.tile.debug('Bitmap tile not cached...');

				self.tile.trace('MapCSS style successfully loaded.');
				self.tile.readVectorData(function(err, data)
				{
					if (err || self.command == "dirty")
					{
						if (err)
							self.tile.debug('Vectortile not cached, needs to be created...');
						if (self.command == "dirty")
							self.tile.debug('Vectortile dirty, needs to be refreshed...');

						self.tile.getVectorData(function(data)
						{
							self.tile.debug('Vector tile created successfully, saving vector tile...');
							self.tile.saveVectorData(function(err)
							{
								if (err)
									self.tile.warn('Vector tile could not be saved.');

								if (data.features.length === 0)
								{
									self.tile.debug('Vector tile without features, serving empty PNG tile for style ' + self.tile.style);
									self.renderCallback(true, null);
								}
								else
								{
									self.tile.debug('Rendering bitmap tile with style ' + self.tile.style);
									self.tile.render(function()
									{
										self.renderCallback
									});
								}
							});
						}, function(err)
						{
							self.abortRequest('Vectortile could not be created. Aborting.');
						});
					}
					else
					{
						// check if tile is expired and add it to the queue if necessary
						self.tile.isExpired(function(expired)
						{
							if (expired)
								self.queue.add(self.tile);

							self.tile.debug('Rendering bitmap tile with style '+self.tile.style);
							self.tile.render(function()
							{
								self.renderCallback
							});
						});
					}
				});
			}
		});
	},

	// sends a 500 error response
	abortRequest: function(msg)
	{
		this.tile.warn(msg);
		this.response.writeHead(500, {'Content-Type': 'text/plain'});
		this.response.end();
		return;
	},

	getHeader: function(msg)
	{
		return {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=3600',
			'Server': 'node-tileserver/0.3'
		};
	}
};

module.exports = BitmapTilerequest;
