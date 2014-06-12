/*
node-tileserver Copyright (C) 2014 Alexander Matheisen
This program comes with ABSOLUTELY NO WARRANTY.
This is free software, and you are welcome to redistribute it under certain conditions.
See https://github.com/rurseekatze/node-tileserver for details.
*/


Tilequeue = function()
{
	this.queue = [];
	this.eventEmitter = new events.EventEmitter();
	this.cpus = os.cpus().length;

	var self = this;
	this.eventEmitter.on('tileFinished', function()
	{
		self.renderNextTile();
	});
};

Tilequeue.prototype =
{
	// add a tile to the queue
	add: function(tile)
	{
		if (!this.elementExists(tile))
		{
			this.queue.push(tile);
			// restart rendering when queue gets filled again
			if (this.queue.length == 1)
				this.eventEmitter.emit('tileFinished');
		}
	},

	// returns true if element is already in the list queue, otherwise false is returned
	elementExists: function(tile)
	{
		for (var queueIndex=0; queueIndex<queue.length; queueIndex++)
			if ((this.queue[queueIndex].z == tile.z) && (this.queue[queueIndex].x == this.x) && (this.queue[queueIndex].y == this.y))
				return true;

		return false;
	},

	// removes a tile from the queue if rendered and renders the next tile
	renderNextTile: function()
	{
		if (this.queue.length > 0)
		{
			logger.debug('Checking system load...');
			if (os.loadavg()[0] <= this.cpus+1)
			{
				logger.debug('Rendering next tile in the queue...');
				this.renderTile();
			}
			else
			{
				logger.info('System load too high, will retry after 5 seconds...');
				this.wait(5);
			}
		}
	},

	// render a tile
	renderTile: function()
	{
		logger.info('Rendering tile from the queue.');
		var tile = this.queue.shift();
		tile.debug('Getting vector data...');
		var self = this;
		tile.getVectorData(function(err, data)
		{
			if (err)
			{
				tile.info('Vectortile could not be created. Aborting.');
				self.eventEmitter.emit('tileFinished');
				return;
			}

			tile.debug('Vector data loaded, saving vector tile...');
			tile.saveVectorData(function(err)
			{
				if (err)
				{
					tile.warn('Vector tile could not be saved. Returning.');
					self.eventEmitter.emit('tileFinished');
					return;
				}

				tile.debug('Vector tile saved, rendering bitmap tile...');
				tile.rerenderBitmap();
				// remove tile from queue and render next tile if every style was rendered
				tile.debug('Finished. Getting the next tile from the queue...');
				self.eventEmitter.emit('tileFinished');
			});
		});
	},

	// waits sec seconds before continuing to render the tiles from the queue
	wait: function(sec)
	{
		var self = this;
		setTimeout(function()
		{
			self.eventEmitter.emit('tileFinished');
		}, sec*1000);
	}
};

module.exports = Tilequeue;
