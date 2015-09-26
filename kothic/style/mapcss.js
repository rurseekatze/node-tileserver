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


var MapCSS = {
    styles: {},
    availableStyles: [],
    images: {},
    locales: [],
    presence_tags: [],
    value_tags: [],
    cache: {},
    debug: {hit: 0, miss: 0},

    onError: function () {
    },

    onImagesLoad: function () {
    },

    /**
     * Incalidate styles cache
     */
    invalidateCache: function () {
        this.cache = {};
    },

    e_min: function (/*...*/) {
        return Math.min.apply(null, arguments);
    },

    e_max: function (/*...*/) {
        return Math.max.apply(null, arguments);
    },

    e_any: function (/*...*/) {
        var i;

        for (i = 0; i < arguments.length; i++) {
            if (typeof(arguments[i]) !== 'undefined' && arguments[i] !== '') {
                return arguments[i];
            }
        }

        return '';
    },

    e_num: function (arg) {
        if (!isNaN(parseFloat(arg))) {
            return parseFloat(arg);
        } else {
            return '';
        }
    },

    e_str: function (arg) {
        return arg;
    },

    e_int: function (arg) {
        return parseInt(arg, 10);
    },

    e_tag: function (obj, tag) {
        if (obj.hasOwnProperty(tag) && obj[tag] !== null) {
            return obj[tag];
        } else {
            return '';
        }
    },

    e_prop: function (obj, tag) {
        if (obj.hasOwnProperty(tag) && obj[tag] !== null) {
            return obj[tag];
        } else {
            return '';
        }
    },

    e_sqrt: function (arg) {
        return Math.sqrt(arg);
    },

    e_boolean: function (arg, if_exp, else_exp) {
        if (typeof(if_exp) === 'undefined') {
            if_exp = 'true';
        }

        if (typeof(else_exp) === 'undefined') {
            else_exp = 'false';
        }

        if (arg === '0' || arg === 'false' || arg === '') {
            return else_exp;
        } else {
            return if_exp;
        }
    },

    e_metric: function (arg) {
        if (/\d\s*mm$/.test(arg)) {
            return 1000 * parseInt(arg, 10);
        } else if (/\d\s*cm$/.test(arg)) {
            return 100 * parseInt(arg, 10);
        } else if (/\d\s*dm$/.test(arg)) {
            return 10 * parseInt(arg, 10);
        } else if (/\d\s*km$/.test(arg)) {
            return 0.001 * parseInt(arg, 10);
        } else if (/\d\s*in$/.test(arg)) {
            return 0.0254 * parseInt(arg, 10);
        } else if (/\d\s*ft$/.test(arg)) {
            return 0.3048 * parseInt(arg, 10);
        } else {
            return parseInt(arg, 10);
        }
    },

    e_zmetric: function (arg) {
        return MapCSS.e_metric(arg);
    },

	e_localize: function (tags, text) {
		var locales = MapCSS.locales, i, tag;

		for (i = 0; i < locales.length; i++) {
			tag = text + ':' + locales[i];
			if (tags[tag]) {
				return tags[tag];
			}
		}

		return tags[text] ? tags[text] : "";
	},

	e_concat: function () {
		var tagString = "";

		for (var i = 0; i < arguments.length; i++)
			tagString = tagString.concat(arguments[i]);

		return tagString;
	},

	e_join: function () {
		var tagString = "";

		for (var i = 1; i < arguments.length; i++)
			tagString = tagString.concat(arguments[0]).concat(arguments[i]);

		return tagString.substr(arguments[0].length);
	},

	e_equal: function (arga, argb) {
		return (arga == argb);
	},

	e_notequal: function (arga, argb) {
		return (arga != argb);
	},

	e_greater: function (arga, argb) {
		return (arga > argb);
	},

	e_greater_equal: function (arga, argb) {
		return (arga >= argb);
	},

	e_less: function (arga, argb) {
		return (arga < argb);
	},

	e_less_equal: function (arga, argb) {
		return (arga <= argb);
	},

	e_CRC32_checksum: function (arg) {
		var CRCTable = [0x00000000,0x77073096,0xEE0E612C,0x990951BA,0x076DC419,0x706AF48F,0xE963A535,0x9E6495A3,0x0EDB8832,0x79DCB8A4,0xE0D5E91E,0x97D2D988,0x09B64C2B,0x7EB17CBD,0xE7B82D07,0x90BF1D91,
		                0x1DB71064,0x6AB020F2,0xF3B97148,0x84BE41DE,0x1ADAD47D,0x6DDDE4EB,0xF4D4B551,0x83D385C7,0x136C9856,0x646BA8C0,0xFD62F97A,0x8A65C9EC,0x14015C4F,0x63066CD9,0xFA0F3D63,0x8D080DF5,
		                0x3B6E20C8,0x4C69105E,0xD56041E4,0xA2677172,0x3C03E4D1,0x4B04D447,0xD20D85FD,0xA50AB56B,0x35B5A8FA,0x42B2986C,0xDBBBC9D6,0xACBCF940,0x32D86CE3,0x45DF5C75,0xDCD60DCF,0xABD13D59,
		                0x26D930AC,0x51DE003A,0xC8D75180,0xBFD06116,0x21B4F4B5,0x56B3C423,0xCFBA9599,0xB8BDA50F,0x2802B89E,0x5F058808,0xC60CD9B2,0xB10BE924,0x2F6F7C87,0x58684C11,0xC1611DAB,0xB6662D3D,
		                0x76DC4190,0x01DB7106,0x98D220BC,0xEFD5102A,0x71B18589,0x06B6B51F,0x9FBFE4A5,0xE8B8D433,0x7807C9A2,0x0F00F934,0x9609A88E,0xE10E9818,0x7F6A0DBB,0x086D3D2D,0x91646C97,0xE6635C01,
		                0x6B6B51F4,0x1C6C6162,0x856530D8,0xF262004E,0x6C0695ED,0x1B01A57B,0x8208F4C1,0xF50FC457,0x65B0D9C6,0x12B7E950,0x8BBEB8EA,0xFCB9887C,0x62DD1DDF,0x15DA2D49,0x8CD37CF3,0xFBD44C65,
		                0x4DB26158,0x3AB551CE,0xA3BC0074,0xD4BB30E2,0x4ADFA541,0x3DD895D7,0xA4D1C46D,0xD3D6F4FB,0x4369E96A,0x346ED9FC,0xAD678846,0xDA60B8D0,0x44042D73,0x33031DE5,0xAA0A4C5F,0xDD0D7CC9,
		                0x5005713C,0x270241AA,0xBE0B1010,0xC90C2086,0x5768B525,0x206F85B3,0xB966D409,0xCE61E49F,0x5EDEF90E,0x29D9C998,0xB0D09822,0xC7D7A8B4,0x59B33D17,0x2EB40D81,0xB7BD5C3B,0xC0BA6CAD,
		                0xEDB88320,0x9ABFB3B6,0x03B6E20C,0x74B1D29A,0xEAD54739,0x9DD277AF,0x04DB2615,0x73DC1683,0xE3630B12,0x94643B84,0x0D6D6A3E,0x7A6A5AA8,0xE40ECF0B,0x9309FF9D,0x0A00AE27,0x7D079EB1,
		                0xF00F9344,0x8708A3D2,0x1E01F268,0x6906C2FE,0xF762575D,0x806567CB,0x196C3671,0x6E6B06E7,0xFED41B76,0x89D32BE0,0x10DA7A5A,0x67DD4ACC,0xF9B9DF6F,0x8EBEEFF9,0x17B7BE43,0x60B08ED5,
		                0xD6D6A3E8,0xA1D1937E,0x38D8C2C4,0x4FDFF252,0xD1BB67F1,0xA6BC5767,0x3FB506DD,0x48B2364B,0xD80D2BDA,0xAF0A1B4C,0x36034AF6,0x41047A60,0xDF60EFC3,0xA867DF55,0x316E8EEF,0x4669BE79,
		                0xCB61B38C,0xBC66831A,0x256FD2A0,0x5268E236,0xCC0C7795,0xBB0B4703,0x220216B9,0x5505262F,0xC5BA3BBE,0xB2BD0B28,0x2BB45A92,0x5CB36A04,0xC2D7FFA7,0xB5D0CF31,0x2CD99E8B,0x5BDEAE1D,
		                0x9B64C2B0,0xEC63F226,0x756AA39C,0x026D930A,0x9C0906A9,0xEB0E363F,0x72076785,0x05005713,0x95BF4A82,0xE2B87A14,0x7BB12BAE,0x0CB61B38,0x92D28E9B,0xE5D5BE0D,0x7CDCEFB7,0x0BDBDF21,
		                0x86D3D2D4,0xF1D4E242,0x68DDB3F8,0x1FDA836E,0x81BE16CD,0xF6B9265B,0x6FB077E1,0x18B74777,0x88085AE6,0xFF0F6A70,0x66063BCA,0x11010B5C,0x8F659EFF,0xF862AE69,0x616BFFD3,0x166CCF45,
		                0xA00AE278,0xD70DD2EE,0x4E048354,0x3903B3C2,0xA7672661,0xD06016F7,0x4969474D,0x3E6E77DB,0xAED16A4A,0xD9D65ADC,0x40DF0B66,0x37D83BF0,0xA9BCAE53,0xDEBB9EC5,0x47B2CF7F,0x30B5FFE9,
		                0xBDBDF21C,0xCABAC28A,0x53B39330,0x24B4A3A6,0xBAD03605,0xCDD70693,0x54DE5729,0x23D967BF,0xB3667A2E,0xC4614AB8,0x5D681B02,0x2A6F2B94,0xB40BBE37,0xC30C8EA1,0x5A05DF1B,0x2D02EF8D];
		var len = arg.length;
		var crc = crc ^ (-1);
		var r = 0xffffffff;
		for (var i=0; i<len; i++)
			crc = ( crc >>> 8 ) ^ CRCTable[( crc ^ str.charCodeAt( i ) ) & 0xFF];

		return (crc ^ (-1)) >>> 0;
	},

	e_cond: function (cond, a, b) {
		return (cond) ? a : b;
	},

    loadStyle: function (style, restyle, sprite_images, external_images, presence_tags, value_tags) {
        var i;
        sprite_images = sprite_images || [];
        external_images = external_images || [];

        if (presence_tags) {
            for (i = 0; i < presence_tags.length; i++) {
                if (this.presence_tags.indexOf(presence_tags[i]) < 0) {
                    this.presence_tags.push(presence_tags[i]);
                }
            }
        }

        if (value_tags) {
            for (i = 0; i < value_tags.length; i++) {
                if (this.value_tags.indexOf(value_tags[i]) < 0) {
                    this.value_tags.push(value_tags[i]);
                }
            }
        }

        MapCSS.styles[style] = {
            restyle: restyle,
            images: sprite_images,
            external_images: external_images,
            textures: {},
            sprite_loaded: !sprite_images,
            external_images_loaded: !external_images.length
        };

        MapCSS.availableStyles.push(style);
    },

    /**
     * Call MapCSS.onImagesLoad callback if all sprite and external
     * images was loaded
     */
    _onImagesLoad: function (style) {
        if (MapCSS.styles[style].external_images_loaded &&
                MapCSS.styles[style].sprite_loaded) {
            MapCSS.onImagesLoad();
        }
    },

    preloadSpriteImage: function (style, url) {
        var images = MapCSS.styles[style].images,
            img = new Image();

        delete MapCSS.styles[style].images;

        img.onload = function () {
            var image;
            for (image in images) {
                if (images.hasOwnProperty(image)) {
                    images[image].sprite = img;
                    MapCSS.images[image] = images[image];
                }
            }
            MapCSS.styles[style].sprite_loaded = true;
            MapCSS._onImagesLoad(style);
        };
        img.onerror = function (e) {
            MapCSS.onError(e);
        };
        img.src = url;
    },

    preloadExternalImages: function (style, urlPrefix) {
        var external_images = MapCSS.styles[style].external_images;
        delete MapCSS.styles[style].external_images;

        urlPrefix = urlPrefix || '';
        var len = external_images.length, loaded = 0, i;

        function loadImage(url) {
            var img = new Image();
            img.onload = function () {
                loaded++;
                MapCSS.images[url] = {
                    sprite: img,
                    height: img.height,
                    width: img.width,
                    offset: 0
                };
                if (loaded === len) {
                    MapCSS.styles[style].external_images_loaded = true;
                    MapCSS._onImagesLoad(style);
                }
            };
            img.onerror = function () {
                loaded++;
                if (loaded === len) {
                    MapCSS.styles[style].external_images_loaded = true;
                    MapCSS._onImagesLoad(style);
                }
            };
            img.src = url;
        }

        for (i = 0; i < len; i++) {
            loadImage(urlPrefix + external_images[i]);
        }
    },

    getImage: function (ref) {
        var img = MapCSS.images[ref];

        if (img && img.sprite) {
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            canvas.getContext('2d').drawImage(img.sprite,
                    0, img.offset, img.width, img.height,
                    0, 0, img.width, img.height);

            img = MapCSS.images[ref] = canvas;
        }

        return img;
    },

    getTagKeys: function (tags, zoom, type, selector) {
        var keys = [], i;
        for (i = 0; i < this.presence_tags.length; i++) {
            if (tags.hasOwnProperty(this.presence_tags[i])) {
                keys.push(this.presence_tags[i]);
            }
        }

        for (i = 0; i < this.value_tags.length; i++) {
            if (tags.hasOwnProperty(this.value_tags[i])) {
                keys.push(this.value_tags[i] + ':' + tags[this.value_tags[i]]);
            }
        }

        return [zoom, type, selector, keys.join(':')].join(':');
    },

    restyle: function (styleNames, tags, zoom, type, selector) {
        var i, key = this.getTagKeys(tags, zoom, type, selector), actions = this.cache[key] || {};

        if (!this.cache.hasOwnProperty(key)) {
            this.debug.miss += 1;
            for (i = 0; i < styleNames.length; i++) {
                actions = MapCSS.styles[styleNames[i]].restyle(actions, tags, zoom, type, selector);
            }
            this.cache[key] = actions;
        } else {
            this.debug.hit += 1;
        }

        return actions;
    }
};
