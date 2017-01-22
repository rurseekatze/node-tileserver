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
var pg = require('pg');
var Pool = require('pg-pool');
var toobusy = require('toobusy-js');
var byline = require('byline');
var touch = require("touch");
var Canvas = require('canvas');
var events = require('events');
var log4js = require('log4js');
var fs = require('graceful-fs');


Tilequeue = function()
{
	this.queue = [];
	this.eventEmitter = new events.EventEmitter();
	this.cpus = os.cpus().length;
	this.maxSemaphor = parseInt(90 / this.cpus);
	this.semaphor = this.maxSemaphor;

	var self = this;
	this.eventEmitter.on('tileFinished', function()
	{
		if (self.queue.length > 0)
		{
			self.renderTile();
		}
	});
};

Tilequeue.prototype =
{
	// add a tile to the queue
	add: function(tile)
	{
		if (!this.elementExists(tile) && (tile.z <= configuration.maxCached))
		{
			this.queue.push(tile);
			// restart rendering when queue gets filled again
			if (this.semaphor > this.maxSemaphor/50)
				this.eventEmitter.emit('tileFinished');
			logger.info('Added tile to queue');
			logger.info('Queue length: ' + this.queue.length);
		}
	},

	// returns true if element is already in the list queue, otherwise false is returned
	elementExists: function(tile)
	{
		for (var queueIndex=0; queueIndex<queue.length; queueIndex++)
			if ((this.queue[queueIndex].z == tile.z) && (this.queue[queueIndex].x == tile.x) && (this.queue[queueIndex].y == tile.y))
				return true;

		return false;
	},

	// render a tile
	renderTile: function()
	{
		logger.info('Rendering tile from the queue');
		this.semaphor--;
		var tile = this.queue.shift();

		if (!tile)
		{
			self.semaphor++;
			this.eventEmitter.emit('tileFinished');
			return;
		}

		tile.debug('Getting vector data...');
		var self = this;
		tile.getVectorData(function(data)
		{
			self.semaphor++;
			tile.debug('Vector data loaded, saving vector tile...');
			tile.saveVectorData(function(err)
			{
				if (err)
				{
					tile.warn('Vector tile could not be saved. Returning.' + err);
				}
				else
				{
					tile.debug('Vector tile saved, rendering bitmap tile...');
					tile.rerenderBitmap();
					// remove tile from queue and render next tile if every style was rendered
					tile.debug('Finished. Getting the next tile from the queue...');
				}
				tile.destroy();
				tile = null;
				self.eventEmitter.emit('tileFinished');
			});
		}, function(err)
		{
			tile.info('Vector tile could not be created. Aborting.' + err);
			tile.destroy();
			tile = null;
			self.semaphor++;
			self.eventEmitter.emit('tileFinished');
		});
	}
};

module.exports = Tilequeue;
