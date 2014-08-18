# node-tileserver Changelog

(all changes without author notice are by [@rurseekatze](https://github.com/rurseekatze)

## 0.3 (18.08.2014)

 * Various minor bugfixes that caused uncaughtExceptions and restart of processes
 * Avoid cutted icons at tile bounds by extending the requested bbox by some pixels
 * Added missing event emitter for faster rendering of tiles in the queue
 * Added MapCSS parameter to ignore layer tag
 * Added support for MapCSS concat method to KothicJS
 * Async isExpired() method
 * Fixed problems with initial rendering script [#3](https://github.com/rurseekatze/node-tileserver/issues/3)
 * More performant loading of icons
 * Improved performance of database queries
 * Correct process exit
 * Moved hardcoded tag filters to configuration
 * Included modified copy of KothicJS, removed patches
 * Closed memory leaks
 * Refactoring
 * Code cleanup
 * Better documentation

## 0.2 (16.02.2014)

 * Moved tile expiring to separate script
 * Added some config parameters for a more efficient tile expiring
 * Moved initial rendering to separate script for security and performance reasons
 * Some minor bugfixes

## 0.1 (22.01.2014)

 * Moved current development stage from OpenRailwayMap to separate repository, see OpenRailwayMap repository for the past development
 * First stable and usable version
