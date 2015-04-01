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

// workaround to emulate browser properties
var window = new Object;
window.devicePixelRatio = 1;

Image = Canvas.Image;

// workaround to emulate browser frame method
window.requestAnimationFrame = (
	function()
	{
		return function(callback)
		{
			callback();
		};
	}
)();

// workaround to emulate dom functions
var document = new Object;
document.createElement = function()
{
	return new Canvas();
}

// include necessary libraries
logger.trace('Including KothicJS...');
eval(fs.readFileSync(configuration.scriptdir+'/kothic.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/renderer/path.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/renderer/line.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/renderer/polygon.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/renderer/shields.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/renderer/path.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/renderer/texticons.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/renderer/path.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/renderer/text.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/style/mapcss.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/style/style.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/utils/collisions.js')+'');
eval(fs.readFileSync(configuration.scriptdir+'/utils/geom.js')+'');
logger.trace('KothicJS loaded.');


// include rendering styles
for (var i=0; i<configuration.styles.length; i++)
{
	eval(fs.readFileSync(configuration.styledir+'/'+configuration.styles[i]+'.js')+'');
	MapCSS.preloadSpriteImage(configuration.styles[i], configuration.styledir+"/"+configuration.styles[i]+".png");
}


Tile = function(zoom, x, y, style)
{
	this.z = parseInt(zoom) || 0;
	this.x = parseInt(x) || 0;
	this.y = parseInt(y) || 0;
	this.data = null;
	this.style = style || "vector";
};

Tile.prototype =
{
	// Tile numbers of given zoom level to EPSG:4326 bbox of a tile
	getBbox: function()
	{
		var a = this.getCoords(this.z, this.x, this.y);
		var b = this.getCoords(this.z, this.x+1, this.y+1);
		return new Array(a[0], b[1], b[0], a[1]);
	},

	// Converts (z,x,y) to coordinates of corner of a tile
	getCoords: function(z, x, y)
	{
		var normalizedTile = new Array(x/Math.pow(2.0, z), 1.0-(y/Math.pow(2.0, z)));
		var projectedBounds = this.from4326To900913(new Array(-180.0, -85.0511287798, 180.0, 85.0511287798));
		var maxp = new Array(projectedBounds[2]-projectedBounds[0], projectedBounds[3]-projectedBounds[1]);
		var projectedCoords = new Array((normalizedTile[0]*maxp[0])+projectedBounds[0], (normalizedTile[1]*maxp[1])+projectedBounds[1]);
		return this.from900913To4326(projectedCoords);
	},

	debug: function(text)
	{
		logger.debug('z'+this.z+'x'+this.x+'y'+this.y+' '+text);
	},

	info: function(text)
	{
		logger.info('z'+this.z+'x'+this.x+'y'+this.y+' '+text);
	},

	error: function(text)
	{
		logger.error('z'+this.z+'x'+this.x+'y'+this.y+' '+text);
	},

	trace: function(text)
	{
		logger.trace('z'+this.z+'x'+this.x+'y'+this.y+' '+text);
	},

	warn: function(text)
	{
		logger.warn('z'+this.z+'x'+this.x+'y'+this.y+' '+text);
	},

	// stores a vector tile in the vector tile directory
	saveVectorData: function(callback)
	{
		var filepath = configuration.vtiledir+'/'+this.z+'/'+this.x+'/';
		var file = this.y+'.json';

		this.debug('Creating path '+filepath+'...');
		var self = this;
		mkdirp(filepath, function(err)
		{
			if (err)
			{
				self.error('Cannot create path: '+filepath+'. Returning.');
				return process.nextTick(function()
				{
					callback(err);
				});
			}

			self.debug('Created path. Saving vector tile at path: '+filepath+file);
			fs.writeFile(filepath+file, JSON.stringify(self.data), {mode: 0777}, function(err)
			{
				if (err)
				{
					self.error('Cannot save vector tile at path: '+filepath+file);
					return process.nextTick(function()
					{
						callback(err);
					});
				}

				self.debug('Saved vector tile at path: '+filepath+file);
				return process.nextTick(function()
				{
					callback(false);
				});
			});
		});
	},

	// returns the content of a vector tile as a string
	readVectorData: function(callback)
	{
		var path = configuration.vtiledir+'/'+this.z+'/'+this.x+'/'+this.y+'.json';
		this.debug('Opening vector tile at path: '+path);
		var self = this;
		fs.readFile(path, function(err, data)
		{
			if (!err && data)
			{
				self.debug('Loaded data from vector tile: '+path);
				return process.nextTick(function()
				{
					// catch JSON parsing errors
					try
					{
						self.data = JSON.parse(data);
						data = null;
						callback(err, self.data);
					}
					catch (err)
					{
						data = null;
						self.data = null;
						callback(err, null);
					}
				});
			}
			else
			{
				self.debug('Cannot read vector tile: '+path);
				return process.nextTick(function()
				{
					callback(err);
				});
			}
		});
	},

	// adds a callback function to the data to make it usable for browser rendering
	getDataString: function()
	{
		return "onKothicDataResponse("+JSON.stringify(this.data)+","+this.z+","+this.x+","+this.y+");";
	},

	// renders a certain tile and calls the callback with the ready-rendered canvas when finished
	render: function(callback)
	{
		this.debug('Rendering data...');

		// start bitmap rendering
		var canvas = new Canvas(configuration.tileSize, configuration.tileSize);
		canvas.style = new Object();
		MapCSS.invalidateCache();
		var self = this;
		Kothic.render(canvas, this.data, this.z+configuration.zoomOffset,
		{
			styles: [this.style],
			onRenderComplete: function()
			{
				self.debug('Finished rendering bitmap tile.');
				return process.nextTick(function()
				{
					callback(false, canvas);
				});
			}
		});
	},

	// removes all rendering styles of a bitmap tile from the cache
	removeBitmap: function(selectedStyle)
	{
		var selectedStyle = selectedStyle || 0;

		if (selectedStyle > configuration.styles.length)
			return;

		var filepath = configuration.tiledir+'/'+configuration.styles[selectedStyle]+'/'+this.z+'/'+this.x+'/'+this.y+'.png';
		if (fs.existsSync(filepath))
		{
			fs.unlinkSync(filepath);
			this.removeBitmap(this.z, this.x, this.y, selectedStyle+1);
		}
	},

	// returns true if the tile was marked as expired, otherwise false is returned
	isExpired: function(callback)
	{
		this.getModifyTime(function(err, mtime)
		{
			return process.nextTick(function()
			{
				callback((!err && mtime.getFullYear() == "1970") ? true : false);
			});
		});
	},

	// marks a tile and all it's subtiles and parent tiles as expired or deletes them if necessary
	expire: function()
	{
		if (this.z <= configuration.maxCached)
			this.markExpired();
		// remove if zoom level higher than maxcached
		else
		{
			var filepath = configuration.vtiledir+'/'+this.z+'/'+this.x+'/'+this.y+'.json';
			var self = this;
			if (fs.existsSync(filepath))
			{
				fs.unlinkSync(filepath);
				self.removeBitmap();
			}
		}
	},

	// marks a tile as expired
	markExpired: function()
	{
		var filepath = configuration.vtiledir+'/'+this.z+'/'+this.x+'/'+this.y+'.json';

		if (fs.existsSync(filepath))
			touch.sync(filepath, {time: new Date(10)});
	},

	// return the timestamp of last modification of a tile
	getModifyTime: function(callback)
	{
		var filepath = configuration.vtiledir+'/'+this.z+'/'+this.x+'/'+this.y+'.json';

		fs.exists(filepath, function(exists)
		{
			if (!exists)
			{
				return process.nextTick(function()
				{
					callback(!exists);
				});
			}

			fs.stat(filepath, function(err, stats)
			{
				if (err || typeof stats == undefined)
					return process.nextTick(function()
					{
						callback(err);
					});

				return process.nextTick(function()
				{
					callback(err, stats.mtime);
				});
			});
		});
	},

	// returns a list of all tiles in lower zoomlevels that contain a certain tile
	getParents: function()
	{
		var zoom = this.z;
		var x = this.x;
		var y = this.y;

		var tiles = new Array();

		while (zoom >= configuration.minExpiring)
		{
			zoom--;
			x = parseInt(x/2);
			y = parseInt(y/2);
			tiles.push(new Tile(zoom, x, y));
		}

		return tiles;
	},

	// returns the subtiles of a certain tile
	subTiles: function()
	{
		var zoom = this.z+1;
		var x = this.x*2;
		var y = this.y*2;

		return new Array(
			new Tile(zoom, x, y),
			new Tile(zoom, x+1, y),
			new Tile(zoom, x, y+1),
			new Tile(zoom, x+1, y+1)
		);
	},

	// returns a list of all subtiles of a certain tile
	getChildren: function()
	{
		var zoom = this.z+1;
		var x = this.x;
		var y = this.y;

		var tiles = new Array();
		var tilesize = 1;

		for (var z=zoom; z<=configuration.maxCached; z++)
		{
			x = x*2;
			y = y*2;
			tilesize = tilesize*2;

			for (var i=x; i<(x+tilesize); i++)
			{
				for (var j=y; j<(y+tilesize); j++)
					tiles.push(new Tile(z, i, j));

				j -= tilesize;
			}

			i -= tilesize;
		}

		return tiles;
	},

	// requests objects for a certain tile and returns the data as an object
	getVectorData: function(callback)
	{
		var bbox = this.getBbox();
		var bbox_p = this.from4326To900913(bbox);

		if (configuration.password == "")
			var connection = "postgres://"+configuration.username+"@localhost/"+configuration.database;
		else
			var connection = "postgres://"+configuration.username+":"+configuration.password+"@localhost/"+configuration.database;
		var client = new pg.Client(connection);

		this.debug('Connecting to database '+connection+'...');
		var self = this;
		client.connect(function(err)
		{
			if (err)
			{
				self.error('Connection to database '+connection+' failed. Returning.');
				return process.nextTick(function()
				{
					callback(err, null);
				});
			}
			else
				self.debug('Connected to database.');

			// request data
			self.trace('Requesting data...');
			client.query(self.getDatabaseQuery(bbox_p), function(err, results)
			{
				var content = new Object();
				content.features = new Array();

				self.trace('All database queries finished, generating JSON data object.');
				content.features = self.getJSONFeatures(results);

				// catch tiles without data
				if (!content.features)
				{
					content.features = new Array();
					self.debug('Vector tile contains no data.');
				}

				content.granularity = configuration.intscalefactor;
				content.bbox = bbox;
				client.end();
				self.invertYAxe(content);
				self.data = content;
				self.debug('Generated vector data.');
				return process.nextTick(function()
				{
					callback(false, content);
				});
			});
		});
	},

	// rerenders all style versions of a tile
	rerenderBitmap: function(selectedStyle)
	{
		var selectedStyle = selectedStyle || 0;

		if (selectedStyle >= configuration.styles.length)
			return;

		this.style = configuration.styles[selectedStyle];

		this.trace('MapCSS style loaded.');
		var filepath = configuration.tiledir+'/'+this.style+'/'+this.z+'/'+this.x;
		var self = this;
		this.render(function(err, image)
		{
			if (err)
			{
				self.warn('Bitmap tile could not be rendered. Returning.');
				self.rerenderBitmap(selectedStyle+1);
				self = null;
				image = null;
				return;
			}

			self.debug('Bitmap tile successfully rendered.');
			self.debug('Creating path '+filepath+'...');
			mkdirp(filepath, function(err)
			{
				if (err)
				{
					self.error('Cannot create path '+filepath+'. Returning.');
					self.rerenderBitmap(selectedStyle+1);
					self = null;
					image = null;
					return;
				}

				self.debug('Saving bitmap tile at path: '+filepath+'/'+self.y+'.png');
				var out = fs.createWriteStream(filepath+'/'+self.y+'.png', {mode: 0777});
				var stream = image.createPNGStream();

				// write PNG data stream
				stream.on('data', function(data)
				{
					out.write(data);
				});

				// PNG data stream ended
				stream.on('end', function()
				{
					out.end();
					self.debug('Bitmap tile was saved.');
					self.rerenderBitmap(selectedStyle+1);
					self = null;
					image = null;
					stream = null;
					out = null;
					return;
				});
			});
		});
	},

	// Converts l pixels on tiles into length on zoom z
	pixelSizeAtZoom: function(l)
	{
		l = l || 1;
		return l*20037508.342789244 / 256*2 / Math.pow(2, this.z);
	},

	// returns a database sql query string
	getDatabaseQuery: function(bbox)
	{
		var zoom = this.z+configuration.zoomOffset;
		var cond = configuration.filterconditions[zoom] || "";
		var buffer = this.pixelSizeAtZoom(configuration.pxtolerance);
		var tolerance = this.pixelSizeAtZoom(configuration.tileBoundTolerance);

			return "\
						SELECT\
							ST_AsGeoJSON(ST_TransScale(ST_ForceRHR(ST_Intersection("+configuration.geomcolumn+", ST_SetSRID('BOX3D("+bbox[0]+" "+bbox[1]+","+bbox[2]+" "+bbox[3]+")'::box3d, 900913))), "+(-bbox[0])+", "+(-bbox[1])+", "+configuration.intscalefactor/(bbox[2]-bbox[0])+", "+configuration.intscalefactor/(bbox[3]-bbox[1])+"), 0) AS "+configuration.geomcolumn+",\
							hstore2json(CAST(hstore(tags) AS hstore)) AS tags,\
							ST_AsGeoJSON(ST_TransScale(ST_ForceRHR(ST_PointOnSurface("+configuration.geomcolumn+")), "+(-bbox[0])+", "+(-bbox[1])+", "+configuration.intscalefactor/(bbox[2]-bbox[0])+", "+configuration.intscalefactor/(bbox[3]-bbox[1])+"), 0) AS reprpoint\
						FROM\
							(\
								SELECT (ST_Dump(ST_Multi(ST_SimplifyPreserveTopology(ST_Buffer("+configuration.geomcolumn+" ,-"+buffer+"), "+buffer+")))).geom AS "+configuration.geomcolumn+", tags\
								FROM\
									(\
										SELECT ST_Union("+configuration.geomcolumn+") AS "+configuration.geomcolumn+", tags\
										FROM\
											(\
												SELECT ST_Buffer("+configuration.geomcolumn+", "+buffer+") AS "+configuration.geomcolumn+", CAST(tags AS text) AS tags\
												FROM "+configuration.prefix+"_polygon\
												WHERE "+configuration.geomcolumn+" && ST_SetSRID('BOX3D("+bbox[0]+" "+bbox[1]+","+bbox[2]+" "+bbox[3]+")'::box3d, 900913) AND way_area > "+(Math.pow(buffer, 2)/configuration.pxtolerance)+" "+cond+"\
											) p\
										GROUP BY CAST(tags AS text)\
									) p\
								WHERE ST_Area("+configuration.geomcolumn+") > "+Math.pow(buffer, 2)+"\
								ORDER BY ST_Area("+configuration.geomcolumn+")\
							) p\
						UNION\
						SELECT\
							ST_AsGeoJSON(ST_TransScale(ST_Intersection("+configuration.geomcolumn+", ST_SetSRID('BOX3D("+bbox[0]+" "+bbox[1]+","+bbox[2]+" "+bbox[3]+")'::box3d, 900913)), "+(-bbox[0])+", "+(-bbox[1])+", "+(configuration.intscalefactor/(bbox[2]-bbox[0]))+", "+(configuration.intscalefactor/(bbox[3]-bbox[1]))+"), 0) AS "+configuration.geomcolumn+",\
							hstore2json(CAST(hstore(tags) AS hstore)) as tags,\
							Null AS reprpoint\
						FROM\
							(\
								SELECT (ST_Dump(ST_Multi(ST_SimplifyPreserveTopology(ST_LineMerge("+configuration.geomcolumn+"), "+this.pixelSizeAtZoom(configuration.pxtolerance)+")))).geom AS "+configuration.geomcolumn+", tags\
								FROM\
									(\
										SELECT ST_Union("+configuration.geomcolumn+") AS "+configuration.geomcolumn+", CAST(tags AS text)\
										FROM "+configuration.prefix+"_line\
										WHERE "+configuration.geomcolumn+" && ST_SetSRID('BOX3D("+bbox[0]+" "+bbox[1]+","+bbox[2]+" "+bbox[3]+")'::box3d, 900913) "+cond+"\
										GROUP BY CAST(tags AS text)\
									) p\
							) p\
						UNION\
						SELECT ST_AsGeoJSON(ST_TransScale("+configuration.geomcolumn+", "+(-bbox[0])+", "+(-bbox[1])+", "+(configuration.intscalefactor/(bbox[2]-bbox[0]))+", "+(configuration.intscalefactor/(bbox[3]-bbox[1]))+"), 0) AS "+configuration.geomcolumn+",\
						hstore2json(tags) AS tags,\
						Null AS reprpoint\
						FROM "+configuration.prefix+"_point\
						WHERE\
						"+configuration.geomcolumn+" && ST_SetSRID('BOX3D("+(bbox[0]-tolerance)+" "+(bbox[1]-tolerance)+","+(bbox[2]+tolerance)+" "+(bbox[3]+tolerance)+")'::box3d, 900913) "+cond+"\
						LIMIT 10000";
	},

	// equivalent of tanh in PHP
	tanh: function(i)
	{
		return (Math.exp(i) - Math.exp(-i)) / (Math.exp(i) + Math.exp(-i));
	},

	// equivalent of rad2deg in PHP
	rad2deg: function(angle)
	{
		return angle/(Math.PI/180.0);
	},

	// equivalent of deg2rad in PHP
	deg2rad: function(angle)
	{
		return angle*(Math.PI/180.0);
	},

	// Wrapper around transform call for convenience. Transforms line from EPSG:900913 to EPSG:4326
	// line - a list of [lat0,lon0,lat1,lon1,...] or [(lat0,lon0),(lat1,lon1),...]
	from900913To4326: function(line)
	{
		var serial = false;
		if (!Array.isArray(line[0]))
		{
			serial = true;
			var l1 = new Array();
			for (var i=0; i<line.length; i=i+2)
				l1.push(new Array(line[i], line[i+1]));
			line = l1;
		}
		var ans = new Array();
		for (var i=0; i<line.length; i++)
		{
			var xtile = line[i][0]/111319.49079327358;
			var ytile = this.rad2deg(Math.asin(this.tanh(line[i][1]/20037508.342789244*Math.PI)));
			if (serial)
			{
				ans.push(xtile);
				ans.push(ytile);
			}
			else
				ans.push(new Array(xtile, ytile));
		}
		return ans;
	},

	// Wrapper around transform call for convenience. Transforms line from EPSG:4326 to EPSG:900913
	// line - a list of [lat0,lon0,lat1,lon1,...] or [(lat0,lon0),(lat1,lon1),...]
	from4326To900913: function(line)
	{
		var serial = false;
		if (!Array.isArray(line[0]))
		{
			serial = true;
			var l1 = new Array();
			for (var i=0; i<line.length; i=i+2)
				l1.push(new Array(line[i], line[i+1]));
			var line = l1;
		}

		var ans = new Array();
		for (var i=0; i<line.length; i++)
		{
			var latRad = this.deg2rad(line[i][1]);
		  	var xtile = line[i][0]*111319.49079327358;
		  	var ytile = Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI * 20037508.342789244;

			if (serial)
			{
				ans.push(xtile);
				ans.push(ytile);
			}
			else
				ans.push(new Array(xtile, ytile));
		}

		return ans;
	},

	// helper function to invert the y axe of the data
	invertYAxe: function(data)
	{
		var type, coordinates, tileSize = data.granularity, i, j, k, l, feature;

		for (i = 0; i < data.features.length; i++)
		{
			feature = data.features[i];
			coordinates = feature.coordinates;
			type = data.features[i].type;
			if (type === 'Point')
				coordinates[1] = tileSize - coordinates[1];
			else if (type === 'MultiPoint' || type === 'LineString')
				for (j = 0; j < coordinates.length; j++) 
				    coordinates[j][1] = tileSize - coordinates[j][1];
			else if (type === 'MultiLineString' || type === 'Polygon')
				for (k = 0; k < coordinates.length; k++)
				    for (j = 0; j < coordinates[k].length; j++)
				        coordinates[k][j][1] = tileSize - coordinates[k][j][1];
			else if (type === 'MultiPolygon')
				for (l = 0; l < coordinates.length; l++)
				    for (k = 0; k < coordinates[l].length; k++)
				        for (j = 0; j < coordinates[l][k].length; j++)
				            coordinates[l][k][j][1] = tileSize - coordinates[l][k][j][1];
			else
				throw "Unexpected GeoJSON type: " + type;

			if (feature.hasOwnProperty('reprpoint'))
				feature.reprpoint[1] = tileSize - feature.reprpoint[1];
		}
	},

	// converts raw JSON features from database response to objects
	getJSONFeatures: function(data)
	{
		if (typeof data == undefined || data == null)
			return [];

		var features = new Array();
		for (var i=0; i<data.rows.length; i++)
		{
			// catch JSON parsing errors
			try
			{
				var geojson = JSON.parse(data.rows[i][configuration.geomcolumn]);
			}
			catch (err)
			{
				break;
			}

			if (geojson.type == "GeometryCollection")
				continue;

			try
			{
				if (geojson.reprpoint)
					geojson.reprpoint = JSON.parse(data.rows[i].reprpoint.coordinates);
				geojson.properties = JSON.parse(data.rows[i].tags);
			}
			catch (err)
			{
				continue;
			}

			features.push(geojson);
		}
		return features;
	},

	// returns the cached bitmap image of a tile
	readBitmapData: function(callback)
	{
		fs.readFile(configuration.tiledir+'/'+this.style+'/'+this.z+'/'+this.x+'/'+this.y+'.png', function(err, data)
		{
			return process.nextTick(function()
			{
				callback(err, data);
			});
		});
	},

	// stores a bitmap tile in the bitmap tile directory
	saveBitmapData: function(image, callback)
	{
		var self = this;
		var filepath = configuration.tiledir+'/'+this.style+'/'+this.z+'/'+this.x;
		this.debug('Rendering successful.');
		this.debug('Saving bitmap tile at path: '+filepath);
		mkdirp(filepath, function(err)
		{
			self.trace('Creating path '+filepath+'...');
			if (err)
			{
				self.error('Cannot create path: '+filepath);
				return process.nextTick(function()
				{
					callback(err);
				});
			}

			// store empty tile if no image could be rendered
			if (image == null)
			{
				self.debug('Bitmap tile empty.');

				fs.readFile('emptytile.png', function(err, data)
				{
					if (err)
					{
						self.warn('Could not read empty bitmap tile.');
						return process.nextTick(function()
						{
							callback(true);
						});
					}

					fs.writeFile(filepath+'/'+self.y+'.png', data, {mode: 0777}, function(err)
					{
						if (!err)
							self.debug('Empty bitmap tile was stored.');
						else
							self.debug('Could not save empty bitmap file.');

						return process.nextTick(function()
						{
							callback(true);
						});
					});
				});
			}
			else
			{
				self.trace('Saving bitmap data...');
				var out = fs.createWriteStream(filepath+'/'+self.y+'.png', {mode: 0777});
				var stream = image.createPNGStream();

				// write PNG data stream
				stream.on('data', function(data)
				{
					out.write(data);
				});

				// PNG data stream ended
				stream.on('end', function()
				{
					out.end();
					image = null;
					stream = null;
					self.debug('Bitmap tile was stored.');
					return process.nextTick(function()
					{
						callback(false);
					});
				});
			}
		});
	},

	// indicates if a bitmap in this style is already cached
	bitmapIsCached: function(callback)
	{
		fs.exists(configuration.tiledir+'/'+this.style+'/'+this.z+'/'+this.x+'/'+this.y+'.png', function(exists)
		{
			return process.nextTick(function()
			{
				callback(exists);
			});
		});
	},

	// destroys the object
	destroy: function()
	{
		self = null;
	}
};

module.exports = Tile;
