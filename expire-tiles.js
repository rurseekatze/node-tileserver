/*
node-tileserver Copyright (C) 2014 Alexander Matheisen
This program comes with ABSOLUTELY NO WARRANTY.
This is free software, and you are welcome to redistribute it under certain conditions.
See https://github.com/rurseekatze/node-tileserver for details.
*/


// load configuraion file
var configuration = require('./config.json');

// include necessary modules
var fs = require('graceful-fs');
var cluster = require('cluster');
var os = require('os');
var assert = require('assert');
var http = require("http");
var url = require("url");
var mkdirp = require('mkdirp');
var byline = require('byline');
var touch = require("touch");


if (process.argv[2] && process.argv[2].length > 0 && fs.existsSync(process.argv[2]))
{
	expireTileList(process.argv[2], function(err)
	{
		if (err)
			console.log('Some problems occurred.');
		else
			console.log('Finished.');
	});
}
else
	console.log('Given filename invalid or file cannot be found.');


// load an osm2pgsql list of expired tiles and marks all tiles as expired
function expireTileList(filename, callback)
{
	console.log('Checking if list of expired tiles exists...');
	if (fs.existsSync(filename))
	{
		console.log('Reading list of expired tiles...');
		var stream = byline(fs.createReadStream(filename));

		stream.on('data', function(line)
		{
			var param = line.toString().split("/");
			var tile = new Tile(param[0], param[1], param[2]);

			tile.expire();

			// mark child tiles
			var tileset = tile.getChildren();
			for (var tilesetIndex=0; tilesetIndex<tileset.length; tilesetIndex++)
			{
				tileset[tilesetIndex].expire();
				tileset[tilesetIndex] = null;
			}

			// mark parent tiles
			var parentTileset = tile.getParents();
			for (var parentIndex=0; parentIndex<parentTileset.length; parentIndex++)
			{
				parentTileset[parentIndex].expire();
				parentTileset[parentIndex] = null;
			}
		});

		stream.on('end', function(line)
		{
			console.log('Expired tiles successfully marked.');
			return process.nextTick(function()
			{
				callback(false);
			});
		});

		stream.on('error', function(line)
		{
			console.log('Cannot read list of expired tiles. Aborting.');
			return process.nextTick(function()
			{
				callback(true);
			});
		});
	}
	else
	{
		console.log('Cannot find expired-tiles-file. Aborting.');
		return process.nextTick(function()
		{
			callback(true);
		});
	}
}
