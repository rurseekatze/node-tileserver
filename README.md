# node-tileserver

 node-tileserver is a lightweight tileserver using [NodeJS](http://nodejs.org/). It can serve bitmap and vector tiles and is designed as a fast and easy-to-install tileserver for rendering OpenStreetMap data. It works perfectly with an osm2pgsql database and Leaflet and KothicJS on the client side.

 See the [OpenStreetMap Wiki](http://wiki.openstreetmap.org/wiki/Node-tileserver) or the [Github repository](https://github.com/rurseekatze/node-tileserver) for more information.

## Features

 * Serves tiles bitmap tiles usable in Leaflet or OpenLayers
 * Serves vector tiles rendered on clientside by KothicJS
 * Uses KothicJS both as bitmap renderer on serverside and canvas renderer on clientside
 * Filesystem caching mechanisms
 * Map styling with MapCSS
 * Support for tiles in multiple rendering styles
 * Designed to use a osm2pgsql hstore database containing OpenStreetMap data
 * Refresh tiles manually by GET requests
 * Rerender expired tiles automatically in the background
 * High performance that profits from the non-blocking I/O design of NodeJS
 * Easy to install on several operating systems, distributions and environments due to less dependencies
 * Renders bitmap tiles in "retina" quality ([Supersampling](https://en.wikipedia.org/wiki/Supersampling))

## Authors

 * Alexander Matheisen [@rurseekatze](http://github.com/rurseekatze)
 * Rolf Eike Beer [@DerDakon](http://github.com/DerDakon)

## Installation

 First install all the dependencies. Depending on your operating system and environment, you may use another command like apt-get.

    $ yum update
    $ yum install gzip zlib zlib-devel postgresql-server postgresql-libs postgresql postgresql-common postgresql-devel postgis unzip librsvg2 gnome-python2-rsvg pygobject2 pygobject2-devel librsvg2 librsvg2-devel cairo cairo-devel cairomm-devel libjpeg-turbo-devel pango pango-devel pangomm pangomm-devel giflib-devel npm nodejs git python

 For system-specific installation of Cairo view the [node-canvas Wiki](https://github.com/LearnBoost/node-canvas/wiki/_pages).

 Then move to your favorite directory and clone this repository:

    $ git clone https://github.com/rurseekatze/node-tileserver.git
    $ cd node-tileserver

 Not that this is the current developing stage, which may contain bugs and can lead to crashes.
 Therefore it is recommended to download a [stable version](https://github.com/rurseekatze/node-tileserver/releases).

 After that you can install all necessary NodeJS modules with npm:

    $ npm install

 Install osm2pgsql (Ubuntu and Debian users may use their `osm2pgsql` package provided by their distribution instead):

    $ git clone https://github.com/openstreetmap/osm2pgsql.git
    $ cd osm2pgsql
    $ cmake
    $ make
    $ sudo make install
    $ cd ..
    $ rm -fr osm2pgsql

 Set up the PostgreSQL database with PostGIS and hstore extensions:

    $ sudo -u postgres createuser railmap
    $ sudo -u postgres createdb -E UTF8 -O railmap railmap

    $ sudo -u postgres psql -d railmap -c "CREATE EXTENSION postgis;"
    $ sudo -u postgres psql -d railmap -c "CREATE EXTENSION hstore;"

    $ sudo service postgresql-9.5 initdb
    $ sudo service postgresql-9.5 start
    $ sudo chkconfig postgresql-9.5 on

 For authentication to the database, we are using `md5` method. Edit your `pg_hba.conf` to use `md5` authentication for local unix sockets and local TCP/IP connections from your host.

 The database password is managed in a `pgpass` file. Create a `pgpass` file (or edit the existing one) in the home directory of the user that will be used for running the processes of API, tileserver and import/update scripts:

    $ vim ~/.pgpass

 Add a line with this format:

    hostname:port:database:username:password

 in this example (replace `YOURPASSWORD` by the password you entered in the `createuser` command):

    localhost:5432:railmap:railmap:YOURPASSWORD

 Then set the correct file permissions:

    $ chmod 600 ~/.pgpass

 Now you can load some data into your database. All tags which are used by the MapCSS style sheet have to be in a hstore column called "tags".

    $ osm2pgsql --create --database railmap --username railmap --prefix railmap --slim --style railmap.style --hstore-all --hstore-add-index railways.osm

 Have a look at an [example toolchain](https://github.com/rurseekatze/OpenRailwayMap/blob/master/import/import.sh) for an example of using osm2pgsql with filtered data.

 Now you can begin to write your own rendering styles. node-tileserver processes rendering styles written in MapCSS. Have a look at the following websites for an introduction, examples and specifications:

 * [JOSM MapCSS Implementation](https://josm.openstreetmap.de/wiki/Help/Styles/MapCSSImplementation)
 * [JOSM MapCSS Tutorial](https://josm.openstreetmap.de/wiki/Help/Styles/MapCSSTutorial)
 * [MapCSS Website](http://www.mapcss.org/)
 * [MapCSS in OSM Wiki](http://wiki.openstreetmap.org/wiki/MapCSS)

You need MapCSS converter to compile your MapCSS styles to JavaScript. Go to your styles directory and compile all your MapCSS styles in one run (you have to do this after every change of your stylesheets):

    $ for stylefile in *.mapcss ; do python mapcss_converter.py --mapcss "$stylefile" --icons-path . ; done

 Note that you have to recompile the stylesheets every time you change the MapCSS files to apply the changes. It is also necessary to restart the tileserver to reload the stylesheets.

 If you plan to run another webserver like Apache parallel to the tileserver, you need a proxy that routes incoming requests. Apache can be used to forward incoming requests to the port of the tileserver.

 The configuration is placed at `/etc/apache2/sites-available/` on Ubuntu/Debian. Other distros use `/etc/apache/vhosts.d/` or just another directory. Log files will be saved to `/var/log/apache2/` You should change this path if you are using other systems, e.g. to `/var/log/httpd/` on CentOS/RHEL.

 Vhost configuration of the API (`tiles.example.com.conf`) looks like this:

    <VirtualHost *:80>
    ServerName tiles.example.com
    ServerAlias  a.tiles.example.com b.tiles.example.com c.tiles.example.com
    ProxyPreserveHost On
    ProxyPass / http://localhost:9000/
    ProxyPassReverse / http://localhost:9000/
    ErrorLog /var/log/apache2/tiles.example.com.error.log
    LogLevel warn
    CustomLog /var/log/apache2/tiles.example.com.access.log combined
    </VirtualHost>

 Make sure that your server does not accept requests on port 9000 and 9002 from outside (to circumvent the proxy and its logging).

 Now you are almost ready to run the tileserver. You just need to check the configuration.

## Configuration

You can set various options to configure your tileserver:

 * `tileSize` Size of tiles in pixels. Usually it is not necessary to change this value, but you can increase or decrease it for higher rendering performance or faster map generation. Consider that the bitmap tiles are rendered in "retina" quality, so the actual tile size is twice as high ([Supersampling](https://en.wikipedia.org/wiki/Supersampling)). _Default: `256`_

 * `prefix` The prefix used for osm2pgsql tables. Depends on the parameters you are using in osm2pgsql. _Default: `railmap`_

 * `database` The name of the used database. Depends on the parameters you are using in osm2pgsql. _Default: `railmap`_

 * `username` The username to be used for database requests. Depends on the parameters you are using in osm2pgsql. _Default: `railmap`_

 * `vtiledir` Relative or absolute path to the vector tile directory. _Default: `/var/www/orm/OpenRailwayMap/tiles`_

 * `tiledir` Relative or absolute path to the bitmap tile directory. _Default: `/var/www/orm/OpenRailwayMap/bitmap-tiles`_

 * `expiredtilesdir` Relative or absolute path to the list of expired tiles. _Default: `/var/www/orm/OpenRailwayMap/import`_

 * `styledir` Relative or absolute path to the directory containing (compiled) MapCSS styles. _Default: `../styles`_

 * `zoomOffset` Zoom offset. _Default: `0`_

 * `minZoom` Lowest allowed zoomlevel for tiles. Change this value if you do not want to serve lowzoom tiles. _Default: `0`_

 * `maxZoom` Highest allowed zoomlevel for tiles. Change this value if you do not want to serve highzoom tiles. _Default: `20`_

 * `styles` List of available rendering styles. Please add the filenames of rendering styles in the styles directory to this list. Note that `vector` is already in use for serving vector tiles. _Default: `standard, maxspeed, signals`_

 * `intscalefactor` Scale factor. You do not need to change this value. _Default: `10000`_

 * `geomcolumn` Name of the geometry column used in the database. You will not need to change this value. _Default: `way`_

 * `pxtolerance` Pixel tolerance used for simplifying vector data. You do not need to change this value. _Default: `1.8`_

 * `maxPrerender` Highest zoomlevel in which tiles are prerendered in initial rendering run. Tiles in higher zoomlevels will be rendered just on request. Change this value to increase or decrease the load for your system. As higher the value, as more tiles have to be rendered. If your selected value is too low, tile requests will be slow, so you should find a value that balances system load and request times. _Default: `8`_

 * `maxCached` Highest zoomlevel in which tiles are cached. Tiles in higher zoomlevels will be rendered just on request and removed from the filesystem cache instead of rerendering if they are expired. Change this value to increase or decrease the load for your system. As higher the value, as faster the tile access. But you should also note that cached tiles will need a lot of storage. It can occur that a volume is full even if there is still storage left, because all inodes of the file system are in use. On the other hand, if your selected value is too low, tile requests will be slow, so you should find a value that balances system load, request times and storage consumption. _Default: `16`_

 * `minExpiring` Lowest zoomlevel in which tiles are only marked as expired if they are affected by an edit. Tiles in lower zoomlevels will be marked as expired only by a manual expiring (such as in an update script). Change this value to increase or decrease the load for your system. As lower the value is, as more tiles have to be rerendered. If your selected value is too high, too many not-affected tiles will be marked as expired, so you should find a value that balances system load and request times. _Default: `10`_

 * `maxsockets` Maximum number of concurring http connections. The optimal value depends on your environment (hardware, operating system, system settings, ...), so you should try some values to get the optimal performance. _Default: `100`_

 * `tileserverPort` Port on which the tileserver is listening. Change this value if you have conflicts with other applications. _Default: `9000`_

 * `tileBoundTolerance` Extend the bounding box of the requested data by this number of pixels to avoid cutted icons at tile bounds. _Default: `60`_

 * `filterconditions` For higher performance and smaller tiles it is possible to set some hardcoded SQL filter conditions

__Note:__ For some parameters it is also necessary to change the modify the options in kothic-leaflet.js!

## Run the server

 Start the tileserver and the proxy in a screen session:

    $ screen -R tileserver
    $ node tileserver.js
    $ [Ctrl][A][D]

 Jump back to the session to see log output or to restart the processes:

    $ screen -r tileserver

 Start the initial rendering:

    $ node init-rendering.js

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

 Include all javascript files from kothic/src and kothic/dist and your compiled MapCSS styles into your website.

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

 There is also the possibility to force the rerendering of a single tile. Just add `/dirty` at the end of a tile URL. Example:

    http://tiles.YOURDOMAIN.org/STYLENAME/z/x/y.png/dirty

 or

    http://tiles.YOURDOMAIN.org/vector/z/x/y.json/dirty

## Update database and tiles

 Use osm2pgsql to update your database. To rerender all expired tiles, you need a file that contains a list of expired tiles. Such a command could look like this:

    $ osm2pgsql --database railmap --username railmap --append --prefix railmap --slim --style railmap.style --hstore --cache 512 --expire-tiles 0-15 --expire-output expired_tiles changes.osc

 Note that the value of the parameter `--expire-tiles` should have the format `minZoom-(maxCached minus 2)`.

 Also have a look at an [example toolchain](https://github.com/rurseekatze/OpenRailwayMap/blob/master/import/update.sh) on how to update a database containing filtered data.

 Run

    $ node expire-tiles.js path/to/expired_tiles

 to load the list of expired tiles and to mark all these tiles as expired. They will be rerendered on their next request or deleted from cache if they are highzoom tiles.

 __Note:__ It is not efficient to go through this list for all zoom levels, so by default only tiles zoom>=maxPrerender and zoom<=maxCached are marked as expired. For other zoomlevels you can mark all affected tiles by executing

    $ cd /path/to/your/vector/tiles
    $ find <zoom> -exec touch -t 197001010000 {} \;

 You can also execute these commands to expire all tiles after a change of your stylesheet.

## MapCSS extension

 node-tileserver extends the used KothicJS renderer with a new MapCSS rule. Set

    kothicjs-ignore-layer: true;

 to ignore the `layer=*` tag.

 This can be useful for some purposes when you want to override the built-in layering of KothicJS.

 __Example:__ You want to render maxspeeds by colouring each line dependent on the `maxspeed=*` tag. If lines are overlapping, ones with higher values should be drawn on the top of lines with lower values. Without `-x-ignore-layer`, it may happen that a line with a higher value of maxspeed is hidden by a line with a lower values of maxspeed, because the lowspeed way is a bridge and has a higher value of `layer=*`.

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

__The file `mapcss_converter.py` and the files in the `mapcss_parser` and `kothic` directories are published under other licenses. See the header of each file for more information.__
