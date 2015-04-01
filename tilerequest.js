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
var toobusy = require('toobusy');
var byline = require('byline');
var touch = require("touch");
var Canvas = require('canvas');
var events = require('events');
var log4js = require('log4js');
var fs = require('graceful-fs');

VectorTilerequest = require('./vectortilerequest.js');
BitmapTilerequest = require('./bitmaptilerequest.js');


Tilerequest = function(request, response)
{
	this.request = request;
	this.response = response;

	this.pathname = url.parse(this.request.url).pathname;
	this.params = this.pathname.split("/");

	this.tile = new Tile(this.params[2], this.params[3], this.params[4].replace(".png", "").replace(".js", ""), this.params[1]);
	this.queue = queue;
	this.command = this.params[5];
	// if no caching header was sent, use date before unix timestamp 0 to force a full request
	this.requestModified = (this.request.headers["if-modified-since"] != null) ? new Date(this.request.headers["if-modified-since"]) : new Date("Wed, 31 Dec 1969 23:59:00 GMT");

	logger.info('Request for '+this.pathname+' received.');

	if (this.params.length < 5 || this.params.length > 6)
	{
		logger.info('Request for '+this.pathname+' received.');
		logger.info('URL format of '+this.pathname+' not valid. Aborting.');
		this.response.writeHead(400, {'Content-Type': 'text/plain'});
		this.response.end();
		return;
	}

	// check validity of parameters
	if (this.tile.z < configuration.minZoom || this.tile.z > configuration.maxZoom)
	{
		this.tile.info('Requested zoom level not valid. Aborting.');
		this.response.writeHead(403, {'Content-Type': 'text/plain'});
		this.response.end();
		return;
	}
	if (this.tile.style == "" || (configuration.styles.indexOf(this.tile.style) == -1 && this.tile.style != "vector"))
	{
		this.tile.info('Requested rendering style '+this.tile.style+' not valid. Aborting.');
		this.response.writeHead(403, {'Content-Type': 'text/plain'});
		this.response.end();
		return;
	}
	if (this.command != "dirty" && typeof this.command != "undefined")
	{
		this.tile.info('Requested command '+this.command+' not valid. Aborting.');
		this.response.writeHead(403, {'Content-Type': 'text/plain'});
		this.response.end();
		return;
	}

	// handle requests for vector tiles
	if (this.tile.style == "vector")
		this.requestHandler = new VectorTilerequest(this);
	// handle requests for bitmap tiles
	else
		this.requestHandler = new BitmapTilerequest(this);
};

Tilerequest.prototype =
{
	// generic method for handling a tile request
	getTile: function()
	{
		this.requestHandler.getTile();
	},

	// sends a 500 error response
	abort: function(msg)
	{
		this.tile.warn(msg);
		this.response.writeHead(500, {'Content-Type': 'text/plain'});
		this.response.end();
		return;
	}
};

module.exports = Tilerequest;
