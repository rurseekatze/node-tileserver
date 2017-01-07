#!/bin/bash

# node-tileserver Copyright (C) 2014 Alexander Matheisen
# This program comes with ABSOLUTELY NO WARRANTY.
# This is free software, and you are welcome to redistribute it under certain conditions.
# See https://github.com/rurseekatze/node-tileserver for details.


# TODO store in config file
MINZOOM="0"
MAXZOOM="20"
MAXPRERENDER="8"
MAXCACHED="16"
MINEXPIRING="8"
TILESERVERPORT="9999"

echo "Started initial rendering at $(date)"

# calculate amount of tiles to render
LISTLENGTH=0
for (( Z=MINZOOM; Z<=MAXPRERENDER; Z++ ))
do
	LISTLENGTH=$(( LISTLENGTH + 2 ** (2 * Z) ))
done
echo "Initial rendering of $((LISTLENGTH / 1000)) k tiles. This process can take some time."

for (( Z=MINZOOM; Z<=MAXPRERENDER; Z++ ))
do
	LENGTH=$((2 ** Z))
	TILECOUNT=$(( LENGTH ** 2 ))
	echo "Rendering $TILECOUNT tiles at zoom level $Z..."
	for (( X=0; X<LENGTH; X++ ))
	do
		for (( Y=0; Y<LENGTH; Y++ ))
		do
			echo "$Z/$X/$Y"
			curl --retry 5 --retry-delay 5 --silent "http://localhost:$TILESERVERPORT/vector/$Z/$X/$Y.js/dirty" > /dev/null
		done
	done
done

echo "Finished initial rendering at $(date)"
