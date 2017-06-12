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

 Follow the [installation instructions](INSTALL.md).

## References

* [OpenRailwayMap] (http://www.openrailwaymap.org/) - a map of the global railway network based on OpenStreetMap. Provides a client-rendered canvas and a standard bitmap tile version of the map.

## Contribute

 Want to contribute to node-tileserver? Patches for new features, bug fixes, documentation, examples and others are welcome. Take also a look at the [issues](https://github.com/rurseekatze/node-tileserver/issues).

 You can honor this project also by a donation with [Paypal](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=58H4UKT35KLLA). This project is operated by the developers in their spare time and has no commercial goals. By making a donation you can show that you appreciate the voluntary work of the developers and can motivate them to continue the project in the future.

## License

Copyright (C) 2014 Alexander Matheisen

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see http://www.gnu.org/licenses/.

__The file `mapcss_converter.py` and the files in the `mapcss_parser` and `kothic` directories are published under other licenses. See the header of each file for more information.__
