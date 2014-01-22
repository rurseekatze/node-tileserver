# node-tileserver

 Node tileserver is a lightweight tileserver using [NodeJS](http://nodejs.org/). It can serve bitmap and vector tiles and is intended as an fast and easy-to-install tileserver for rendering OpenStreetMap data. It works perfectly with an osm2pgsql database and Leaflet and KothicJS on the client side.

 See the [OpenStreetMap Wiki](http://wiki.openstreetmap.org/wiki/Node-tileserver) or the [Github repository](https://github.com/rurseekatze/node-tileserver) for more information.

## Features

* Serves tiles bitmap tiles usable in Leaflet or OpenLayers
* Serves vector tiles rendered on clientside by KothicJS
* Uses KothicJS both as bitmap renderer on serverside and canvas renderer on clientside 
* Filesystem caching mechanisms
* Support for tiles in multiple rendering styles
* Designed to use a osm2pgsql hstore database containing OpenStreetMap data
* Refresh tiles manually by GET requests
* Rerender expired tiles with a background daemon
* High performance that profits from the non-blocking I/O design of NodeJS
* Easy to install on several operating systems, distributions and environments due to less dependencies

## Authors

 * Alexander Matheisen ([rurseekatze](http://github.com/rurseekatze))

## Installation

 First install all the dependencies. Depending on your operating system and environment, you may use another command like apt-get.

    $ yum update
    $ yum install gzip zlib zlib-devel postgresql-server postgresql-libs postgresql postgresql-common postgresql-devel postgis unzip librsvg2 gnome-python2-rsvg pygobject2 pygobject2-devel librsvg2 librsvg2-devel cairo cairo-devel cairomm-devel libjpeg-turbo-devel pango pango-devel pangomm pangomm-devel giflib-devel npm nodejs git python

 For system-specific installation of Cairo view the [node-canvas Wiki](https://github.com/LearnBoost/node-canvas/wiki/_pages).

 Then move to your favorite directory and clone this repository:

    $ git clone https://github.com/rurseekatze/node-tileserver.git
    $ cd node-tileserver

 After that you can install all necessary NodeJS modules with npm:

    $ npm install canvas@1.0.4
    $ npm install rbush
    $ npm install mkdirp
    $ npm install pg
    $ npm install byline
    $ npm install graceful-fs
    $ npm install http-proxy
    $ npm install log4js
    $ npm install toobusy
    $ npm install touch

 Now you need osm2pgsql:

    $ git clone https://github.com/openstreetmap/osm2pgsql.git
    $ cd osm2pgsql
    $ ./autogen.sh
    $ ./configure
    $ sed -i 's/-g -O2/-O2 -march=native -fomit-frame-pointer/' Makefile
    $ make
    $ cd ..

 Set up the PostgreSQL database with all necessary extensions such as hstore:

    $ su postgres
    $ createuser railmap
    $ createdb -E UTF8 -O railmap railmap
    $ createlang plpgsql railmap
    $ psql -d railmap -f /usr/share/pgsql/contrib/postgis-64.sql
    $ psql -d railmap -f /usr/share/pgsql/contrib/postgis-1.5/spatial_ref_sys.sql
    $ psql -d railmap -f /usr/share/pgsql/contrib/hstore.sql
    $ psql -d railmap -f osm2pgsql/900913.sql

 If you are using PostgreSQL version < 9.3 you also need to add a function (from https://gist.github.com/kenaniah/1315484):

    $ echo "CREATE OR REPLACE FUNCTION public.hstore2json (
      hs public.hstore
    )
    RETURNS text AS
    $body$
    DECLARE
      rv text;
      r record;
    BEGIN
      rv:='';
      for r in (select key, val from each(hs) as h(key, val)) loop
        if rv<>'' then
          rv:=rv||',';
        end if;
        rv:=rv || '"'  || r.key || '":';

        --Perform escaping
        r.val := REPLACE(r.val, E'\\', E'\\\\');
        r.val := REPLACE(r.val, '"', E'\\"');
        r.val := REPLACE(r.val, E'\n', E'\\n');
        r.val := REPLACE(r.val, E'\r', E'\\r');

        rv:=rv || CASE WHEN r.val IS NULL THEN 'null' ELSE '"'  || r.val || '"' END;
      end loop;
      return '{'||rv||'}';
    END;
    $body$
    LANGUAGE 'plpgsql'
    IMMUTABLE
    CALLED ON NULL INPUT
    SECURITY INVOKER
    COST 100;" | psql -d railmap

    $ echo "ALTER FUNCTION hstore2json(hs public.hstore) OWNER TO apache;"  | psql -d railmap

 For higher performance you should create some indexes:

    $ echo "CREATE INDEX railmap_point_tags ON railmap_point USING GIN (tags);" | psql -d railmap
    $ echo "CREATE INDEX railmap_line_tags ON railmap_line USING GIN (tags);" | psql -d railmap
    $ echo "CREATE INDEX railmap_polygon_tags ON railmap_polygon USING GIN (tags);" | psql -d railmap

 Now you can load some data into your database:

    $ osm2pgsql --create --database railmap --username railmap --prefix railmap --slim --style railmap.style --hstore --cache 512 railways.osm

 Have a look at an [example toolchain](https://github.com/rurseekatze/OpenRailwayMap/blob/master/import/import.sh) for an example of using osm2pgsql with filtered data.

 If you want to use vector tiles for client-side rendering, you have to install KothicJS and do some modifications. If you just want to use bitmap tiles, you can skip the next steps.

 Clone the KothicJS repository:

    $ git clone https://github.com/kothic/kothic-js.git
    $ cd kothic-js

 Apply some patches, otherwise some features will not work properly:
    $ patch src/kothic.js < ../patches/kothic.diff
    $ patch dist/kothic-leaflet.js < ../patches/kothic-leaflet.diff

 You need MapCSS converter to compile your MapCSS styles to javascript:

    $ wget https://raw2.github.com/kothic/kothic-js-mapcss/master/scripts/mapcss_converter.py
    $ mkdir mapcss_parser
    $ cd mapcss_parser
    $ wget https://raw2.github.com/Miroff/mapcss-parser/master/mapcss_parser/parse.py
    $ wget https://raw2.github.com/Miroff/mapcss-parser/master/mapcss_parser/lex.py
    $ wget https://raw2.github.com/Miroff/mapcss-parser/master/mapcss_parser/ast.py
    $ wget https://raw2.github.com/Miroff/mapcss-parser/master/mapcss_parser/__init__.py
    $ cd ..

 Go to your styles directory and compile all your MapCSS styles in one run (you have to do this after every change of your stylesheets):

    $ for stylefile in *.mapcss ; do python mapcss_converter.py --mapcss "$stylefile" --icons-path . ; done

 You need a proxy that routes incoming requests. It is recommended to use a NodeJS proxy like [this](https://github.com/rurseekatze/OpenRailwayMap/blob/master/proxy.js), especially if you are running another webserver like Apache parallel to NodeJS. Remember to change the domains in the script and the configuration of your parallel running webservers. The NodeJS proxy listens on port 80 while parallel webservers should listen on 8080.

 Now you are almost ready to run the tileserver. You just need to check the configuration.

## Configuration

You can set various options to configure your tileserver:

 * `tileSize` Size of tiles in pixels. Usually it is not necessary to change this value, but you can increase or decrease it for higher rendering performance or faster map generation. _Default: `256`_

 * `prefix` The prefix used for osm2pgsql tables. Depends on the parameters you are using in osm2pgsql. _Default: `railmap`_

 * `db` The name of the used database. Depends on the parameters you are using in osm2pgsql. _Default: `railmap`_

 * `vtiledir` Relative or absolute path to the vector tile directory. _Default: `../tiles`_

 * `expiredtilesdir` Relative or absolute path to the list of expired tiles. _Default: `../../olm/import`_

 * `scriptdir` Relative or absolute path to the directory of the required scripts. _Default: `../js/`_

 * `zoomOffset` Zoom offset. _Default: `0`_

 * `minZoom` Lowest allowed zoomlevel for tiles. Change this value if you do not want to serve lowzoom tiles. _Default: `0`_

 * `maxZoom` Highest allowed zoomlevel for tiles. Change this value if you do not want to serve highzoom tiles. _Default: `20`_

 * `styles` List of available rendering styles. Please add the filenames of rendering styles in the styles directory to this list. Note that `vector` is already in use for serving vector tiles. _Default: `standard, maxspeed, signals`_

 * `intscalefactor` Scale factor. You do not need to change this value. _Default: `10000`_

 * `geomcolumn` Name of the geometry column used in the database. You will not need to change this value. _Default: `way`_

 * `pxtolerance` Pixel tolerance used for simplifying vector data. You do not need to change this value. _Default: `1.8`_

 * `maxPrerender` Highest zoomlevel in which tiles are prerendered in initial rendering run. Tiles in higher zoomlevels will be rendered just on request. Change this value to increase or decrease the load for your system. As higher the value, as more tiles have to be rendered. If your selected value is too low, tile requests will be slow, so you should find a value that balances system load and request times. _Default: `8`_

 * `maxCached` Highest zoomlevel in which tiles are cached. Tiles in higher zoomlevels will be rendered just on request and removed from the filesystem cache instead of rerendering if they are expired. Change this value to increase or decrease the load for your system. As higher the value, as more tiles have to be rerendered. If your selected value is too low, tile requests will be slow, so you should find a value that balances system load and request times. _Default: `15`_

 * `maxsockets` Maximum number of concurring http connections. The optimal value depends on your environment (hardware, operating system, system settings, ...), so you should try some values to get the optimal performance. _Default: `100`_

 * `tileserverPort` Port on which the tileserver is listening. Change this value if you have conflicts with other applications. _Default: `9000`_

## Run the server

 Start the tileserver and the proxy in a screen session:

    $ screen -R tileserver
    $ node tileserver.js
    $ [Ctrl][A][D]
    $ screen -R proxy
    $ node proxy.js
    $ [Ctrl][A][D]

 Jump back to the session to see log output or to restart the processes:

    $ screen -r tileserver
    $ screen -r proxy

 Start the initial rendering:

    $ curl "http://localhost:9000/init"

## Usage

### Bitmap tiles

 The URL to load the bitmap tiles with Leaflet or Openlayers:

    http://tiles.YOURDOMAIN.org/STYLENAME/z/x/y.png

 __Leaflet example:__

    ...
    map = L.map('mapFrame');
    railmap = new L.TileLayer('http://{s}.tiles.YOURDOMAIN.org/standard/{z}/{x}/{y}.png',
    {
        minZoom: 2,
        maxZoom: 19,
        tileSize: 256
    }).addTo(map);
    ...

 If you have more than one rendering style, you can change between them by changing the source url:

    ...
    railmap._url = 'http://{s}.tiles.YOURDOMAIN.org/'+style+'/{z}/{x}/{y}.png';
    railmap.redraw();
    ...

### Vector tiles

 URL to access vector tiles for using in Leaflet and KothicJS:

    http://tiles.YOURDOMAIN.org/vector/z/x/y.json

 __Leaflet example:__

 Include all javascript files from kothic-js/src and kothic-js/dist and your compiled MapCSS styles into your website.

    ...
    map = L.map('mapFrame');
    railmap = new L.TileLayer.Kothic('http://{s}.tiles.YOURDOMAIN.org/vector/{z}/{x}/{y}.json',
    {
        minZoom: 2,
        maxZoom: 19
    });

    MapCSS.onImagesLoad = function()
    {
        map.addLayer(railmap);

        map.on('zoomend', function(e)
        {
            railmap.redraw();
        });

        setStyle("standard");
    };

    var styles = ["standard", "signals", "maxspeeds"]
    for (var i=0; i<styles.length; i++)
        MapCSS.preloadSpriteImage(styles[i], "styles/"+styles[i]+".png");

 If you have more than one rendering style, you can change between them:

    ...
    for (var i=0; i<MapCSS.availableStyles.length; i++)
        if (MapCSS.availableStyles[i] != style)
            railmap.disableStyle(MapCSS.availableStyles[i]);

    railmap.enableStyle(style);
    railmap.redraw();
    ...

## Update database and tiles

 Use osm2pgsql to update your database. To rerender all expired tiles, you need a file that contains a list of expired tiles. Such a command could look like this:

    $ osm2pgsql --database railmap --username railmap --append --prefix railmap --slim --style railmap.style --hstore --cache 512 --expire-tiles 0-15 --expire-output expired_tiles changes.osc

 Note that the value of the parameter `--expire-tiles` should have the format `minZoom-(maxCached minus 2)`. 

 Also have a look at an [example toolchain](https://github.com/rurseekatze/OpenRailwayMap/blob/master/import/update.sh) on how to update a database containing filtered data.

 Run

    $ curl "http://localhost:9000/loadlist"

 to load the list of expired tiles and to mark all these tiles as expired. They will be rerendered on their next request or deleted from cache if they are highzoom tiles.

 By requesting

    $ curl "http://localhost:9000/status"

 you can get the current number of tiles in the queue.

## References

* [OpenRailwayMap] (http://www.openrailwaymap.org/) - a map of the global railway network based on OpenStreetMap. Provides a client-rendered canvas and a standard bitmap tile version of the map.

## Contribute

 Want to contribute to node-tileserver? Patches for new features, bug fixes, documentation, examples and others are welcome. Take also a look at the [issues](https://github.com/rurseekatze/node-tileserver/issues).

 You can honor this project also by a donation with [Flattr](https://flattr.com/submit/auto?user_id=rurseekatze&url=https://github.com/rurseekatze/node-tileserver&title=node-tileserver&description=A%20lightweight%20tileserver%20using%20NodeJS.%20It%20can%20serve%20bitmap%20and%20vector%20tiles%20and%20is%20intended%20as%20an%20fast%20and%20easy-to-install%20tileserver%20for%20rendering%20OpenStreetMap%20data.&tags=js,javascript,nodejs,tileserver,openstreetmap,osm,map,rendering,renderer&category=software) or [Paypal](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=58H4UKT35KLLA). This project is operated by the developers in their spare time and has no commercial goals. By making a donation you can show that you appreciate the voluntary work of the developers and can motivate them to continue the project in the future.

## License

Copyright (C) 2014 Alexander Matheisen

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see http://www.gnu.org/licenses/.
