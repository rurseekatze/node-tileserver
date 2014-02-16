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
			var tile = line.toString().split("/");

			expireTile(tile[0], tile[1], tile[2]);

			// mark child tiles
			var tileset = childTiles(tile[0], tile[1], tile[2]);
			for (var tilesetIndex=0; tilesetIndex<tileset.length; tilesetIndex++)
				expireTile(tileset[tilesetIndex][0], tileset[tilesetIndex][1], tileset[tilesetIndex][2]);

			// mark parent tiles
			var parentTileset = parentTiles(tile[0], tile[1], tile[2]);
			for (var parentIndex=0; parentIndex<parentTileset.length; parentIndex++)
				expireTile(parentTileset[parentIndex][0], parentTileset[parentIndex][1], parentTileset[parentIndex][2]);
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


// removes all rendering styles of a bitmap tile from the cache
function removeBitmapTile(zoom, x, y, selectedStyle)
{
	var selectedStyle = selectedStyle || 0;

	if (selectedStyle > configuration.styles.length)
		return;

	var filepath = configuration.tiledir+'/'+configuration.styles[selectedStyle]+'/'+zoom+'/'+x+'/'+y+'.png';
	if (fs.existsSync(filepath))
	{
		fs.unlinkSync(filepath);
		removeBitmapTile(zoom, x, y, selectedStyle);
	}
}


// marks a tile and all it's subtiles and parent tiles as expired or deletes them if necessary
function expireTile(zoom, x, y)
{
	if (parseInt(zoom) <= configuration.maxCached)
		markTileExpired(zoom, x, y);
	// remove all tiles higher than maxcached
	else
	{
		var filepath = configuration.vtiledir+'/'+zoom+'/'+x+'/'+y+'.json';
		if (fs.existsSync(filepath))
		{
			fs.unlinkSync(filepath);
			removeBitmapTile(zoom, x, y);
		}
	}
}


// marks a tile as expired
function markTileExpired(zoom, x, y)
{
	//var filepath = configuration.vtiledir+'/'+zoom+'/'+x+'/'+y+'.json';
	var filepath = '/home/www/sites/194.245.35.149/site/orm/tiles/'+zoom+'/'+x+'/'+y+'.json';

	if (fs.existsSync(filepath))
		touch.sync(filepath, {time: new Date(10)});
}


// returns a list of all subtiles of a certain tile
function childTiles(zoom, x, y)
{
	zoom = parseInt(zoom);
	x = parseInt(x);
	y = parseInt(y);

	var tiles = new Array();
	var tilesize = 1;

	for (var z=zoom+1; z<=configuration.maxCached; z++)
	{
		x = x*2;
		y = y*2;
		tilesize = tilesize*2;

		for (var i=x; i<(x+tilesize); i++)
		{
			for (var j=y; j<(y+tilesize); j++)
				tiles.push(new Array(z, i, j));

			j -= tilesize;
		}

		i -= tilesize;
	}

	return tiles;
}


// returns a list of all tiles in lower zoomlevels that contain a certain tile
function parentTiles(zoom, x, y)
{
	zoom = parseInt(zoom);
	x = parseInt(x);
	y = parseInt(y);

	var tiles = new Array();

	while (zoom >= configuration.minExpiring)
	{
		zoom--;
		x = parseInt(x/2);
		y = parseInt(y/2);
		tiles.push(new Array(zoom, x, y));
	}

	return tiles;
}


// returns the subtiles of a certain tile
function subTiles(zoom, x, y)
{
	zoom = parseInt(zoom);
	x = parseInt(x);
	y = parseInt(y);

	x = x*2;
	y = y*2;
	zoom++;

	return new Array(
		new Array(zoom, x, y),
		new Array(zoom, x+1, y),
		new Array(zoom, x, y+1),
		new Array(zoom, x+1, y+1)
	);
}
