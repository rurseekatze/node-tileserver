/*
Copyright (c) 2011-2013, Darafei Praliaskouski, Vladimir Agafonkin, Maksim Gurtovenko
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are
permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice, this list of
      conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright notice, this list
      of conditions and the following disclaimer in the documentation and/or other materials
      provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/


Kothic.texticons = {

	render: function (ctx, feature, collides, ws, hs, renderText, renderIcon) {
		var style = feature.style, img, point, w, h;

		if (renderIcon || (renderText && feature.type !== 'LineString')) {
			var reprPoint = Kothic.geom.getReprPoint(feature);
			if (!reprPoint) {
				return;
			}
			point = Kothic.geom.transformPoint(reprPoint, ws, hs);
		}

		if (renderIcon) {
			img = MapCSS.getImage(style['icon-image']);
			if (!img) { return; }

			w = img.width;
			h = img.height;

			if (style['icon-width'] || style['icon-height']){
				if (style['icon-width']) {
					w = style['icon-width'];
					h = img.height * w / img.width;
				}
				if (style['icon-height']) {
					h = style['icon-height'];
					if (!style['icon-width']) {
						w = img.width * h / img.height;
					}
				}
			}
			if ((style['allow-overlap'] !== 'true') &&
					collides.checkPointWH(point, w, h, feature.kothicId)) {
				return;
			}
		}

		var text = String(style.text).trim();
		if (renderText && text) {
			Kothic.style.setStyles(ctx, {
				lineWidth: style['text-halo-radius'] * 2,
				font: Kothic.style.getFontString(style['font-family'], style['font-size'], style)
			});

			var halo = (style.hasOwnProperty('text-halo-radius'));

			Kothic.style.setStyles(ctx, {
				fillStyle: style['text-color'] || '#000000',
				strokeStyle: style['text-halo-color'] || '#ffffff',
				globalAlpha: style['text-opacity'] || style.opacity || 1,
				textAlign: 'center',
				textBaseline: 'middle'
			});

			if (style['text-transform'] === 'uppercase')
				text = text.toUpperCase();
			else if (style['text-transform'] === 'lowercase')
				text = text.toLowerCase();
			else if (style['text-transform'] === 'capitalize')
				text = text.replace(/(^|\s)\S/g, function(ch) { return ch.toUpperCase(); });

			if (feature.type === 'Polygon' || feature.type === 'Point') {
				for (var i = 0; i < 5; i++) {
					var rtext;	// the split label text

					switch (i) {
					case 0:
						// if the text contains braces split there
						rtext = text.replace(/ \(/g, '\n(').split('\n');
						break;
					case 1:
						// if not, try splitting at slashes
						rtext = text.replace(/\//g, '/\n').split('\n');
						break;
					case 2:
						// try unmodified string
						rtext = [ text ];
						break;
					case 3:
						rtext = text.replace(/-/g, '-\n').split('\n');
						break;
					case 4:
						rtext = text.split(' ');
						break;
					}
					var s, rlines = rtext.length;
					// only allow a single string when explicitely wanted
					if (rlines === 1 && i !== 2)
						continue;

					var collisionWidth = 0,		// width of the longest substring
						letterWidth = 0;	// mean width of a letter of the longest substring

					for (s of rtext) {
						var textWidth = ctx.measureText(s).width;
						if (collisionWidth < textWidth) {
							collisionWidth = textWidth;
							letterWidth = textWidth / s.length;
						}
					}

					var lheight = 1.3 * ctx.measureText('M').width,
							collisionHeight = letterWidth * 0.3 + lheight * rlines,
							offsetX = style['text-offset-x'] || 0,
							// TODO direction of y-offset is reverse in JOSM
							offsetY = style['text-offset'] || style['text-offset-y'] || 0;

					if ((style['text-allow-overlap'] !== 'true') &&
							collides.checkPointWH([point[0] + offsetX, point[1] + offsetY], collisionWidth, collisionHeight, feature.kothicId)) {
						continue;
					}

					// now paint the texts
					// iterate over all lines, the expression after offsetY is there to keep
					// the center of the drawn text in the center of the collision rectangle
					var l = 0;
					if (halo) {
						for (s of rtext)
							ctx.strokeText(s, point[0] + offsetX, point[1] + offsetY + (l++ - (rlines - 1) / 2) * lheight);
					}
					l = 0;
					for (s of rtext)
						ctx.fillText(s, point[0] + offsetX, point[1] + offsetY + (l++ - (rlines - 1) / 2) * lheight);

					var padding = style['kothicjs-min-distance'] || 20;
					collides.addPointWH([point[0] + offsetX, point[1] + offsetY], collisionWidth, collisionHeight, padding, feature.kothicId);

					break;
				}
			} else if (feature.type === 'LineString') {

				var points = Kothic.geom.transformPoints(feature.coordinates, ws, hs);
				Kothic.textOnPath(ctx, points, text, halo, collides);
			}
		}

		if (renderIcon) {
			ctx.drawImage(img,
					Math.floor(point[0] - w / 2),
					Math.floor(point[1] - h / 2), w, h);

			var padding2 = parseFloat(style['kothicjs-min-distance']) || 0;
			collides.addPointWH(point, w, h, padding2, feature.kothicId);
		}
	}
};
