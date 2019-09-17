/**
 * JavaScript canvas Chart plugin for Telegram contest
 * @author Pavel Marhaunichy
 * @param   {Array}  data    Data array
 * @param   {object} options Options object
 * @returns {object} Instance
 */
(function () {
	'use strict';

	var defaults = {
		id: 'chart',
		name: null,
		appendTo: document.body,
		chart: {
			height: 500,
			lineWidth: 3
		},
		preview: {
			height: 80,
			lineWidth: 1
		},
		gridLines: 6,
		gridLineWidth: 1,
		class: 'lpt-chart',
		themeActive: 'light',
		theme: {
			light: {
				background: '#fff',
				gridColor: '#f2f4f5',
				gridActiveColor: '#dfe6eb',
				gridFontColor: '#96a2aa',
				gridFont: '13px sans-serif',
				labelValueFont: '15px sans-serif',
				labelLineNameFont: '11px sans-serif',
				labelDateFont: '13px sans-serif',
				labelDateFontColor: '#000',
				labelBackround: '#ffffff',
				labelShadowColor: '#f2f4f5'
			},
			dark: {
				background: '#242f3e',
				gridColor: '#293544',
				gridActiveColor: '#3b4a5a',
				gridFontColor: '#546778',
				gridFont: '13px sans-serif',
				labelValueFont: '15px sans-serif',
				labelLineNameFont: '11px sans-serif',
				labelDateFont: '13px sans-serif',
				labelDateFontColor: '#fff',
				labelBackround: '#253241',
				labelShadowColor: '##212B39'
			}
		}
	};

	var _supp = {
		cssTransform3d: null,
		cssTransform2d: null,
		init: function () {
			this.el = document.getElementsByTagName('body')[0];
			this.log10Check();
		},
		log10Check: function () {
			if(typeof Math.log10 === 'undefined'){
				Object.prototype.log10 = function(x){
					return Math.log(x) / Math.log(10);
				}
			}
		},
	}
	_supp.init();

	function extend(obj1, obj2) {
		var obj = Object.create(null);
		for (var prop in obj1) {
			if (obj2 && obj2[prop]) obj[prop] = obj2[prop];
			else obj[prop] = obj1[prop];
		}
		return obj;
	}

	function getDataRange(lines, start, end) {
		var arr = [];
		for (var i = 0; i < lines.length; i++) {
			var arr1 = lines[i].slice(start, end + 1);
			if (typeof arr1[0] === 'number') {
				arr1.unshift(lines[i][0]);
			}
			arr.push(arr1);
		}
		return arr;
	}

	function getMaxValue(data) {
		var max = 0,
			i = data[0][0] === 'x' ? 1 : 0; // to handle array with or w/o timestamps
		for (; i < data.length; i++) {
			var item = data[i];
			for (var j = 1; j < item.length; j++) { // skip "y0", "y1", etc...
				if (item[j] > max) max = item[j];
			}
		}
		return max;
	}

	function normalizeGridSteps(start, end, lines) {
		var averg = Math.ceil((end - start) / lines);

		if (averg < 1) averg = 1;

		var max = (Math.floor(start / averg) + (lines - 1)) * averg;

		if (max < end) averg++;

		var step = 1;

		while (averg >= 20) {
			averg /= 10;
			step *= 10;
		}
		do {
			max = (Math.floor(start / (averg * step)) + (lines - 1)) * averg * step;
			if (max >= end) break;
			if (max < end) averg++;
		} while (true);

		step *= averg;

		return step;
	}

	function normalizeBigNumber(number) {
		var arr = ['', 'k', 'M', 'B', 'T'],
			tier = Math.log10(number) / 3 | 0;

		if (0 === tier) return number;

		var scale = Math.pow(10, tier * 3),
			scaled = number / scale;

		return scaled.toFixed(1) + arr[tier];
	}

	function hexToRGB(hex, alpha) {
		var r = parseInt(hex.slice(1, 3), 16),
			g = parseInt(hex.slice(3, 5), 16),
			b = parseInt(hex.slice(5, 7), 16);

		return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
	}

	function nearestValue(val, arr) {
		var result,
			lastDelta,
			index;

		arr.forEach(function (item, indx) {
			var delta = Math.abs(val - item);
			if (delta >= lastDelta) {
				return true;
			}
			result = item;
			index = indx;
			lastDelta = delta;
		});

		return {
			value: result,
			index: index
		};
	}

	function pointerInRect(x, y, rectX, rectY, rectW, rectH) {
		return rectX <= x && x <= rectX + rectW && rectY <= y && y <= rectY + rectH;
	}

	function getTextWidth(ctx, font, text, offset) {
		offset = offset || 0;
		ctx.font = font;
		return ctx.measureText(text).width + offset;
	}

	/**
	 * @constructor
	 * @param {object} options Options object
	 */
	var Chart = function (data, options) {
		this.data = data;
		this.options = extend(defaults, options);
		this._init();
	}
	window.Chart = Chart;

	Chart.prototype = {
		/**
		 * @public
		 * Can be localized
		 */
		months: function () {
			return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		},

		days: function () {
			return ['Sun', 'Mon', 'Tue', 'Wen', 'Thu', 'Fri', 'Sat'];
		},

		_init: function () {
			this.dpr = window.devicePixelRatio || 1;
			this.windowWidth = window.innerWidth;

			this._createWrapper();
			var width = this.nodes.wrapper.clientWidth - parseInt(getComputedStyle(this.nodes.wrapper).paddingLeft, 10) - parseInt(getComputedStyle(this.nodes.wrapper).paddingRight, 10);
			this._createCanvas('chart', width, this.options.chart.height, this.options.id, false, false, this.nodes.chartWrapper);
			this._preparation();
			this._createCanvas('tooltip', width, this.options.chart.height, this.options.id + '-tooltip', true, {
				position: 'absolute',
				top: 0,
				left: 0
			}, this.nodes.chartWrapper);
			this._createCanvas('preview', width, this.options.preview.height, this.options.id + '-preview', false, false, this._createPreview());

			this.nodes.chart = this.chart.canvas;
			this.nodes.tooltip = this.tooltip.canvas;
			this.nodes.preview = this.preview.canvas;

			this._updateNodesOffsets();
			this._defineArea();
			// step in px between x values in preview chart
			this.stepX = this.preview.area.width / (this.data.columns[0].length === 2 ? 1 : this.data.columns[0].length - 2);

			this._setStartRange();
			this._createControls();

			this.yFactor = 1; //
			this.xFactor = 1; //
			this.yDirection = 'up';
			this.xAnimation = false;

			this._checkLines(); // -> this._drawPreview();
			this._handlers();
			//this._createOff(); // +

			this.redraw = true;
			this._loop();
		},

		_createWrapper: function () {
			var wrapper = document.createElement('div'),
				chartWrapper = document.createElement('div');
			wrapper.classList.add(this.options.class);
			chartWrapper.classList.add(this.options.class + '-wrapper');
			wrapper.appendChild(chartWrapper);
			this.options.appendTo.appendChild(wrapper);
			this.nodes = {
				wrapper: wrapper,
				chartWrapper: chartWrapper
			}
		},

		_createCanvas: function (ctx, width, height, id, alpha, styles, elementContext) {
			var canvas = document.createElement('canvas'),
				context = canvas.getContext('2d', {
					alpha: alpha
				});

			canvas.id = id;
			this[ctx] = context;
			this[ctx].name = ctx;
			this[ctx].width = width;
			this[ctx].height = height;
			this[ctx].imageSmoothingEnabled = false;

			canvas.style.display = 'block';
			canvas.style.width = width + 'px';
			canvas.style.height = height + 'px';
			canvas.width = Math.round(width * this.dpr);
			canvas.height = Math.round(height * this.dpr);
			this[ctx].scale(this.dpr, this.dpr);
			if (styles) {
				for (var style in styles) {
					canvas.style[style] = styles[style];
				}
			}

			elementContext.appendChild(canvas);
		},

		_createOff: function () {
			//var canvas = new OffscreenCanvas(),
			var canvas = document.createElement('canvas'),
				context = canvas.getContext('2d', {
					alpha: false
				});
			context.width = this.chart.width;
			context.height = this.chart.height;
			context.imageSmoothingEnabled = false;
			canvas.width = Math.round(this.chart.width * this.dpr);
			canvas.height = Math.round(this.chart.height * this.dpr);
			context.scale(this.dpr, this.dpr);
			this.off = context;
			this.off.name = 'chart';
			this.off.canvas;
			this.off.area = this.chart.area;
		},

		_createPreview: function () {
			var previewWrapper = document.createElement('div'),
				previewSlider = document.createElement('div'),
				previewSliderInner = document.createElement('div');

			previewWrapper.classList.add(this.options.class + '-preview');
			previewWrapper.style.width = this.chart.width + 'px';
			previewSlider.classList.add(this.options.class + '-preview__slider');
			previewSliderInner.classList.add(this.options.class + '-preview__slider_inner');

			previewSlider.appendChild(previewSliderInner);
			previewWrapper.appendChild(previewSlider);
			this.nodes.wrapper.appendChild(previewWrapper);

			var sliderRect = previewSlider.getBoundingClientRect(),
				left = sliderRect.left - previewWrapper.getBoundingClientRect().left,
				width = sliderRect.right - sliderRect.left;
			previewSlider.style.transform = 'translate3d(' + left + 'px, 0, 0)';
			previewSlider.style.width = Math.round(width) + 'px';
			previewSlider.style.left = '0px';

			this.nodes.previewWrapper = previewWrapper;
			this.nodes.previewSlider = previewSlider;
			this.nodes.previewSliderInner = previewSliderInner;

			return previewWrapper;
		},

		_createControls: function () {
			var _this = this,
				chartName = document.createElement('span'),
				controls = document.createElement('div');

			chartName.classList.add(this.options.class + '-name')
			controls.classList.add(this.options.class + '-controls');

			for (var prop in this.data.names) {
				if (this.data.names.hasOwnProperty(prop)) {
					var wrapper = document.createElement('div'),
						check = document.createElement('input'),
						span = document.createElement('span'),
						label = document.createElement('label');

					wrapper.classList.add(this.options.class + '-check-wrapper');
					check.checked = true;
					check.type = 'checkbox';
					check.id = this.options.id + '-' + prop;
					check.onchange = function () {
						_this._checkLines(this);
					}
					label.htmlFor = this.options.id + '-' + prop;
					label.textContent = this.data.names[prop];
					span.style.borderColor = this.data.colors[prop];
					label.appendChild(span);
					wrapper.appendChild(check);
					wrapper.appendChild(label);
					controls.appendChild(wrapper);
				}
			}
			if (this.options.name) {
				chartName.textContent = this.options.name;
				this.nodes.chartWrapper.parentNode.insertBefore(chartName, this.nodes.chartWrapper);
			}
			this.nodes.previewWrapper.parentNode.insertBefore(controls, this.nodes.previewWrapper.nextSibling);
		},

		_defineArea: function () {
			this.chart.paddingTop = 5;
			this.chart.paddingBottom = 60;
			this.chart.textPaddingBottom = 10;
			this.chart.datesPaddingBottom = 30;
			this.chart.labelTextValueWidth = 0;
			this.chart.area = {
				top: this.chart.paddingTop,
				//left: this.options.chart.paddingLeft,
				left: 0,
				bottom: this.chart.height - this.chart.paddingBottom,
				//width: this.chart.width - this.options.chart.paddingLeft,
				width: this.chart.width,
				right: this.chart.width,
				height: this.chart.height - this.chart.paddingTop - this.chart.paddingBottom
			};
			this.preview.prevPointerX = 0;
			this.preview.prevMax = getMaxValue(this.data.columns) * 2; // for initial animation purpose
			this.preview.area = {
				top: 0,
				left: 0,
				right: this.preview.width,
				bottom: this.options.preview.height,
				width: this.preview.width,
				height: this.options.preview.height
			};
		},

		_setStartRange: function () {
			this.range = {
				x0: this.nodes.previewSlider.offsets.left - this.nodes.previewWrapper.offsets.left,
				x1: this.nodes.previewSlider.offsets.right - this.nodes.previewWrapper.offsets.left,
				prevMax: 0, // set below
				max: 0
			};
			this.range.index0 = this.range.x0 === this.preview.area.left ? 1 : Math.round((this.range.x0 - this.range.x0 % this.stepX) / this.stepX + 2);
			this.range.index1 = this.range.x1 === this.preview.area.right ? this.data.columns[0].length - 1 : Math.round((this.range.x1 - this.range.x1 % this.stepX) / this.stepX + 1);
			this.range.prevMax = getMaxValue(getDataRange(this.data.columns, this.range.index0, this.range.index1)) * 2;
		},

		_preparation: function () {
			this.gridLineWidth = this.options.gridLineWidth;
			this.gridFont = this.options.theme[this.options.themeActive].gridFont;
			this.labelDateFont = this.options.theme[this.options.themeActive].labelDateFont;
			this.labelValueFont = this.options.theme[this.options.themeActive].labelValueFont;
			this.labelLineNameFont = this.options.theme[this.options.themeActive].labelLineNameFont;
			this.gridDateOffset = 60;

			this.dates = ['x'];
			this.datesFull = ['x'];

			var data = this.data.columns[0],
				i = 1,
				tsLength = data.length,
				maxDateText = 0;

			for (; i < tsLength; i++) {
				var date = new Date(data[i]),
					month = this.months()[date.getMonth()],
					num = date.getDate(),
					day = this.days()[date.getDay()],
					dateText = month + ' ' + num,
					dateTextFull = day + ', ' + month + ' ' + num;

				if (dateText.length > maxDateText.length) maxDateText = dateText;

				this.dates.push(dateText);
				this.datesFull.push(dateTextFull);
			}
			this.dateWidth = Math.max(getTextWidth(this.chart, this.gridFont, maxDateText), 60);

			this._updateColorScheme();
		},

		_updateColorScheme: function () {
			this.gridFontColor = this.options.theme[this.options.themeActive].gridFontColor;
			this.background = this.options.theme[this.options.themeActive].background;
			this.gridActiveColor = this.options.theme[this.options.themeActive].gridActiveColor;
			this.gridColor = this.options.theme[this.options.themeActive].gridColor;
			this.labelShadowColor = this.options.theme[this.options.themeActive].labelShadowColor;
			this.labelDateFontColor = this.options.theme[this.options.themeActive].labelDateFontColor;
			this.labelBackground = hexToRGB(this.options.theme[this.options.themeActive].labelBackround, 0.85);
		},

		_drawGrid: function (ctx) {
			ctx.fillStyle = this.background;
			ctx.fillRect(0, 0, ctx.width, ctx.height);

			if (!this.lines.length) {
				var _this = this;
				this._drawLine(ctx, ctx.area.left, ctx.area.top, ctx.area.left, ctx.area.bottom, this.gridLineWidth, this.gridActiveColor);
				this._drawLine(ctx, ctx.area.left, ctx.area.bottom, ctx.width, ctx.area.bottom, this.gridLineWidth, this.gridColor);
				this._drawText(ctx, 'No data available', 'center', 'middle', ctx.area.width / 2, ctx.area.height / 2, this.gridFont, this.gridFontColor);
				return;
			}

			var data = getDataRange(this.lines, this.range.index0, this.range.index1),
				max = getMaxValue(data);

			if (max !== this.range.prevMax) {
				/* Since max Y may be changed earlier then we reach loop,
				 * we should avoid it render with yProgress == 1, so
				 * check it here and trigger Y animation with proper yProgress
				 */
				this.isYAnimating = true;
			}
			this.range.max = max;

			var yStep = normalizeGridSteps(0, max, this.options.gridLines),
				stepHeight = yStep * ctx.area.height / max,
				gridColor = hexToRGB(this.options.theme[this.options.themeActive].gridColor, this.yFactor),
				fontColor = hexToRGB(this.options.theme[this.options.themeActive].gridFontColor, this.yFactor),
				lineYPos = ctx.area.bottom,
				numberYPos = ctx.area.bottom - ctx.textPaddingBottom,
				animationOffset = this.yDirection === 'up' ? 40 : -40;

			for (var k = 0; k <= this.options.gridLines; k++) {
				if (k === 0) {
					this._drawLine(ctx, ctx.area.left, lineYPos - stepHeight * k, ctx.width, lineYPos - stepHeight * k, this.gridLineWidth, this.gridColor);
					this._drawText(ctx, normalizeBigNumber(yStep * k), 'left', 'alphabetic', 0, numberYPos - stepHeight * k, this.gridFont, this.gridFontColor);
				} else {
					this._drawLine(ctx, ctx.area.left, (lineYPos - stepHeight * k + animationOffset) - animationOffset * this.yFactor, ctx.width, (lineYPos - stepHeight * k + animationOffset) - animationOffset * this.yFactor, this.gridLineWidth, gridColor);
					this._drawText(ctx, normalizeBigNumber(yStep * k), 'left', 'alphabetic', 0, (numberYPos - stepHeight * k + animationOffset) - animationOffset * this.yFactor, this.gridFont, fontColor);
				}
			}
		},

		_drawPreview: function () {
			//console.log('_drawPreview',this.chart.canvas.id)
			this.redraw = true;
			this.preview.fillStyle = this.background;
			this.preview.fillRect(0, 0, this.preview.width, this.options.preview.height);
			this._drawChart(this.preview);
		},

		_drawChart: function (ctx) {
			//console.log('_drawChart')
			var data = this.data.columns[0],
				lines = this.lines;

			ctx.save();
			ctx.lineWidth = this.options[ctx.name].lineWidth;
			/*ctx.clearRect(0, 0, this.chart.width, this.chart.height);*/ // +

			if (ctx.name === 'preview') {
				if (!this.lines.length) return;
				ctx.max = getMaxValue(lines);
				var scale = 1,
					max = ctx.max,
					rangeEnd = ctx.area.right;
			} else {
				ctx.lineCap = 'round';

				this.coordsX = [];
				this.coordsY = {};
				
				for (var n = 0; n < lines.length; n++) {
					this.coordsY[lines[n][0]] = [];
				}
				var rangeW = this.range.x1 - this.range.x0,
					scale = ctx.area.width / rangeW,
					max = this.range.max,
					rangeEnd = this.range.x1;
			}

			if (this.isYAnimating) {
				if (ctx.name === 'preview') {
					var max = this.preview.yValueFrom + this.yFactor * (this.preview.prevMax - this.preview.yValueFrom);
					this.preview.yValuePrev = max;
				} else {
					var max = this.yValueFrom + this.yFactor * (this.range.prevMax - this.yValueFrom);
					this.yValuePrev = max;
				}
			}

			if (this.isXAnimating) {
				this.prevXValue = this.xFactor;
			}

			var j = 0,
				linesLength = lines.length,
				stepX = this.stepX * scale,
				xCalc = (ctx.area.width - rangeEnd) * scale + ctx.area.right,
				yCalc = ctx.area.bottom,
				yCalc1 = ctx.area.height / max;

			for (; j < linesLength; j++) {

				var i = data.length - 1,
					k = 0,
					line = lines[j];

				ctx.beginPath();
				ctx.strokeStyle = hexToRGB(this.data.colors[line[0]], this.oFactor); // add condition

				for (; i > 0; i--, k++) {

					var x1 = xCalc - stepX * k,
						x2 = xCalc - stepX * (k + 1),
						y1 = yCalc - line[i] * yCalc1,
						y2 = yCalc - line[i - 1] * yCalc1;

					if (k === 0) ctx.moveTo(x1, y1);
					ctx.lineTo(x2, y2);

					if (ctx.name === 'chart' && j === 0) {

						if (stepX / (this.dateWidth + this.gridDateOffset) < 1) {
							var n = parseInt((this.dateWidth + this.gridDateOffset) / stepX, 10);
						} else {
							var n = 1;
						}

						if (i % n === 0) {
							this._drawText(ctx, this.dates[i], 'right', 'middle', x1, this.chart.height - this.chart.datesPaddingBottom, this.gridFont, hexToRGB(this.gridFontColor, 1));
						}
					}

					if (ctx.name === 'chart') {
						if (x1 >= 0 && x1 <= ctx.area.width) {
							if (j === 0) this.coordsX.push(x1);
							this.coordsY[line[0]].push(y1);
						}
						if (x2 < 0 /*&& j === linesLength - 1*/ ) {
							// we don't need to draw outside of canvas, so
							break;
						}
					}

				}

				ctx.stroke();

			}

			ctx.restore();

		},

		_drawText: function (ctx, text, align, valign, x, y, font, color) {
			ctx.save();
			ctx.font = font;
			ctx.fillStyle = color;
			ctx.textAlign = align;
			ctx.textBaseline = valign;
			ctx.fillText(text, x, y);
			ctx.restore();
		},

		_drawLine: function (ctx, fromX, fromY, toX, toY, width, color, rounded) {
			ctx.save();
			ctx.beginPath();
			ctx.strokeStyle = color;
			ctx.moveTo(fromX, fromY);
			ctx.lineTo(toX, toY);
			ctx.stroke();
			ctx.restore();
		},

		_drawCircle: function (ctx, x, y, r, color, width) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(x, y, r, 0, 2 * Math.PI);
			ctx.fillStyle = this.background;
			ctx.fill();
			ctx.strokeStyle = color;
			ctx.lineWidth = width;
			ctx.stroke();
			ctx.restore();
		},

		_drawRoundRect: function (ctx, x, y, w, h, r, color, lineColor, shadowColor, lineWidth) {
			ctx.save();
			ctx.beginPath();
			ctx.lineWidth = lineWidth;
			ctx.fillStyle = color;
			ctx.strokeStyle = lineColor;
			ctx.shadowColor = shadowColor;
			ctx.shadowBlur = 8;
			ctx.shadowOffsetX = 3;
			ctx.shadowOffsetY = 3;
			ctx.moveTo(x + r, y);
			ctx.arcTo(x + w, y, x + w, y + h, r);
			ctx.arcTo(x + w, y + h, x, y + h, r);
			ctx.arcTo(x, y + h, x, y, r);
			ctx.arcTo(x, y, x + w, y, r);
			ctx.closePath();
			ctx.stroke();
			ctx.fill();
			ctx.restore();
		},

		_checkLines: function (elem) {
			if (!this.lines) {
				// set it initially
				var lines = [];
				for (var prop in this.data.names) {
					if (this.data.names.hasOwnProperty(prop)) {
						var elem = document.getElementById(this.options.id + '-' + prop);
						if (elem && elem.checked) {
							for (var i = 1; i < this.data.columns.length; i++) {
								if (this.data.columns[i][0] === elem.id.replace(this.options.id + '-', '')) {
									lines.push(this.data.columns[i]);
								}
							}
						}
					}
					this.lines = lines;
				}
			} else {
				// handling on 'onchange' event
				var line = elem.id.replace(this.options.id + '-', '');
				main:
					for (var i = 1; i < this.data.columns.length; i++) {
						if (line === this.data.columns[i][0]) {
							if (this.lines.length) {
								// check if it is already in lines array
								for (var j = 0; j < this.lines.length; j++) {
									if (line === this.lines[j][0]) {
										// it is, so remove
										this.lines.splice(j, 1);
										break main;
									}
								}
								this.lines.push(this.data.columns[i]);
								
								
								
								
								
								if (this.isOAnimating) {
								}
								this.oStart = performance.now();
								
								this._animate('oFactor', 800, function() {
										this.isOAnimating = false;
									}, this.isOReverse);
								
								
								
								
								
							} else {
								// just add
								this.lines.push(this.data.columns[i]);
							}
							break;
						}
					}
				this.lines.sort();
			}
			
			
//			if (this.xAnimation) {
//				if (this.isXAnimating) {
//					this.oFactor = this.prevXValue;
//				} else {
					
//				}
			

				this.oStart = performance.now();
				this.isOAnimating = true;
				this.isOReverse = false;
//			}
			
			this.isPreviewAnimating = true;
			this._drawPreview();
		},

		_handlers: function () {
			var _this = this;

			this.nodes.tooltip.onmousemove = function (e) {
				/*_this.redraw = true;*/

				var clientX = e.touches ? e.touches[0].clientX : e.clientX,
					rect = this.offsets;

				if (clientX - rect.left < _this.chart.area.left) _this.chart.pointerX = _this.chart.area.left;
				else _this.chart.pointerX = clientX - rect.left;

				_this.chart.clientX = clientX - rect.left;

				_this._drawLabel();
			};

			['mousedown', 'touchstart'].forEach(function (e) {
				_this.nodes.previewSlider.addEventListener(e, dragstart, false);
			});

			['mouseup', 'touchend'].forEach(function (e) {
				document.addEventListener(e, dragend, false);
			});

			['mousemove', 'touchmove'].forEach(function (e) {
				_this.nodes.wrapper.addEventListener(e, move, false);
			});

			window.addEventListener('resize', function () {
				// Check window width has actually changed and it's not just iOS triggering a resize event on scroll
				if (window.innerWidth !== _this.windowWidth) {
					_this.windowWidth = window.innerWidth;
					_this._onResize();
				}
			});

			window.addEventListener('scroll', function () {
				_this._updateNodesOffsets();
			});

			function dragstart(e) {
				var clientX = e.touches ? e.touches[0].clientX : e.clientX,
					rect = _this.nodes.previewSlider.offsets,
					RESIZE_AREA = 22;

				_this.nodes.previewSlider.dragStart = clientX;
				_this.nodes.previewSlider.fromLeft = clientX - rect.left;
				_this.nodes.previewSlider.fromRight = rect.right - clientX;

				if (clientX - rect.left <= RESIZE_AREA) _this.nodes.previewSlider.resizer = 'left';
				else if (rect.right - clientX <= RESIZE_AREA) _this.nodes.previewSlider.resizer = 'right';
				else _this.nodes.previewSlider.drag = true;
			}

			function dragend(e) {
				_this.nodes.previewSlider.drag = false;
				_this.nodes.previewSlider.resizer = false;
				_this._updateNodesOffsets();
			}

			function move(e) {
				var clientX = e.touches ? e.touches[0].clientX : e.clientX,
					clientY = e.touches ? e.touches[0].clientY : e.clientY;

				if (!pointerInRect(clientX, clientY, _this.nodes.tooltip.offsets.left, _this.nodes.tooltip.offsets.top, _this.tooltip.width, _this.tooltip.height)) {
					_this.tooltip.clearRect(0, 0, _this.tooltip.width, _this.tooltip.height);
				}

				if (!_this.nodes.previewSlider.drag && !_this.nodes.previewSlider.resizer) return;

				if (_this.nodes.previewSlider.dragStart !== clientX) {

					/*this.isXAnimating = true;*/
					_this.preview.pointerX = clientX;

					var previewSliderRect = _this.nodes.previewSlider.offsets,
						previewRect = _this.nodes.previewWrapper.offsets,
						previewWidth = previewRect.width,
						sliderLeft = previewSliderRect.left - previewRect.left,
						sliderRight = previewSliderRect.right - previewRect.left,
						sliderWidth = previewSliderRect.width,
						x = clientX - previewRect.left,
						fromLeft = _this.nodes.previewSlider.fromLeft,
						fromRight = _this.nodes.previewSlider.fromRight,
						MIN_SLIDER_WIDTH = 52,
						left,
						width;

					if (_this.nodes.previewSlider.resizer) {
						if (_this.nodes.previewSlider.resizer === 'left') {
							if (x - fromLeft >= 0 && x - fromLeft <= sliderRight - MIN_SLIDER_WIDTH) {
								left = x - fromLeft;
								width = sliderRight - left;
								_this.nodes.previewSlider.style.transform = 'translate3d(' + left + 'px, 0, 0)';
								_this.nodes.previewSlider.style.width = width + 'px';
							} else if (x - fromLeft < 0) {
								left = 0;
								width = sliderRight - left;
								_this.nodes.previewSlider.style.transform = 'translate3d(' + left + 'px, 0, 0)';
								_this.nodes.previewSlider.style.width = width + 'px';
							} else {
								return;
							}
						} else if (_this.nodes.previewSlider.resizer === 'right') {
							if (x + fromRight <= previewWidth && x + fromRight >= sliderLeft + MIN_SLIDER_WIDTH) {
								left = sliderLeft;
								width = x + fromRight - sliderLeft;
								_this.nodes.previewSlider.style.transform = 'translate3d(' + left + 'px, 0, 0)';
								_this.nodes.previewSlider.style.width = width + 'px';
							} else if (x + fromRight > previewWidth) {
								left = sliderLeft; //
								width = previewWidth - sliderLeft;
								_this.nodes.previewSlider.style.width = width + 'px';
							} else {
								return;
							}
						}
					} else if (_this.nodes.previewSlider.drag) {
						if (x - fromLeft >= 0 && x + fromRight <= previewWidth) {
							left = x - fromLeft;
							width = sliderWidth; //
							_this.nodes.previewSlider.style.transform = 'translate3d(' + left + 'px, 0, 0)';
						} else {
							if (x - fromLeft < 0) {
								left = 0;
								width = sliderWidth;
								_this.nodes.previewSlider.style.transform = 'translate3d(' + left + 'px, 0, 0)';
								_this.nodes.previewSlider.style.width = width + 'px';
							} else if (x + fromRight > previewWidth) {
								left = previewWidth - sliderWidth;
								width = sliderWidth; //
								_this.nodes.previewSlider.style.transform = 'translate3d(' + left + 'px, 0, 0)';
							}
						}
					}

					_this.range.x0 = Math.round(left);
					_this.range.x1 = Math.round(left + width);
					_this.range.index0 = _this.range.x0 === _this.preview.area.left ? 1 : Math.round((_this.range.x0 - _this.range.x0 % _this.stepX) / _this.stepX + 2);
					_this.range.index1 = _this.range.x1 === _this.preview.area.right ? _this.data.columns[0].length - 1 : Math.round((_this.range.x1 - _this.range.x1 % _this.stepX) / _this.stepX + 1);

				}
			}
		},

		_updateNodesOffsets: function () {
			for (var prop in this.nodes) {
				if (this.nodes.hasOwnProperty(prop)) {
					var rect = this.nodes[prop].getBoundingClientRect();
					this.nodes[prop].offsets = {
						top: Math.round(rect.top),
						left: Math.round(rect.left),
						right: Math.round(rect.right),
						bottom: Math.round(rect.bottom),
						width: Math.round(rect.right - rect.left),
						height: Math.round(rect.bottom - rect.top)
					}
				}
			}
		},

		_onResize: function () {
			this.dpr = window.devicePixelRatio || 1;
			var width = this.nodes.wrapper.clientWidth - parseInt(getComputedStyle(this.nodes.wrapper).paddingLeft, 10) - parseInt(getComputedStyle(this.nodes.wrapper).paddingRight, 10),
				prevWidth = this.nodes.previewWrapper.clientWidth,
				sliderRect = this.nodes.previewSlider.getBoundingClientRect(),
				wrapperRectLeft = this.nodes.previewSlider.getBoundingClientRect().left,
				sliderLeft = sliderRect.left,
				sliderWidth = sliderRect.right - sliderRect.left,
				scale = prevWidth / width;

			this.nodes.previewSlider.style.transform = 'translate3d(' + this.range.x0 / scale + 'px, 0, 0)';
			this.nodes.previewSlider.style.width = (this.range.x1 - this.range.x0) / scale + 'px';
			this.range.x0 /= scale;
			this.range.x1 /= scale;

			this.chart.width = width;
			this.preview.width = width;
			this.tooltip.width = width;

			this.nodes.chart.style.width = width + 'px';
			this.nodes.chart.width = Math.round(width * this.dpr);
			this.nodes.preview.style.width = width + 'px';
			this.nodes.preview.width = Math.round(width * this.dpr);
			this.nodes.tooltip.style.width = width + 'px';
			this.nodes.tooltip.width = Math.round(width * this.dpr);
			this.nodes.previewWrapper.style.width = width + 'px';

			this.chart.scale(this.dpr, this.dpr);
			this.preview.scale(this.dpr, this.dpr);
			this.tooltip.scale(this.dpr, this.dpr);

			this._updateNodesOffsets();
			this._defineArea();
			this.stepX = width / (this.data.columns[0].length === 2 ? 1 : this.data.columns[0].length - 2);
			this._drawPreview();
		},

		_loop: function (ts) {
			var _this = this;

			if (this.preview.prevPointerX !== this.preview.pointerX) {
				this.preview.prevPointerX = this.preview.pointerX;
				this.xAnimation = true;
			} else {
				this.xAnimation = false;
			}

			// condition to trigger X animation
			if (this.xAnimation) {
				if (this.isXAnimating) {
					this.xFactor = this.prevXValue;
				} else {}

				this.xStart = performance.now();
				this.isXAnimating = true;
			}

			// condition to trigger Y animation
			if (this.range.prevMax !== this.range.max) {
				this.yDirection = this.range.max - this.range.prevMax > 0 ? 'down' : 'up';

				if (this.isYAnimating) {
					this.yValueFrom = this.yValuePrev;
					this.preview.yValueFrom = this.preview.yValuePrev;
					this.preview.prevMax = this.preview.max;
					this.range.prevMax = this.range.max;
				} else {
					this.yValueFrom = this.range.prevMax;
					this.preview.yValueFrom = this.preview.prevMax;
					this.preview.prevMax = this.preview.max;
					this.range.prevMax = this.range.max;
				}

				this.yStart = performance.now();
				this.isYAnimating = true;
			}

			var now = performance.now(),
				yTimePassed = now - this.yStart,
				xTimePassed = now - this.xStart,
				oTimePassed = now - this.oStart;

			// if animation in progress or just triggered
			if (this.isYAnimating) {
				this._animate('yFactor', yTimePassed, 180, function() {
					_this.isYAnimating = false;
					_this.isPreviewAnimating = false;
				});
			}
			if (this.isXAnimating) {
				this._animate('xFactor', xTimePassed, 120, function() {
					_this.isXAnimating = false;
				});
			}

			this._render();

			requestAnimationFrame(function (ts) {
				_this._loop(ts);
			});
		},

		_render: function () {
			if (!this.redraw) return;
			this._drawGrid(this.chart);
			if (this.isYAnimating && this.isPreviewAnimating || !this.preview.pointerX) this._drawPreview();
			this._drawChart(this.chart);
			/*this.chart.clearRect(0, 0, this.chart.width, this.chart.height); // +*/
			/*this.chart.drawImage(this.off.canvas, 0, 0, this.chart.width, this.chart.height); // +*/
			this.redraw = false;
		},

		_animate: function (prop, timePassed, duration, callback, reverse) {
			this.redraw = true;
			var progress = timePassed / duration;
			
			if (progress > 1) {
				progress = 1;
				timePassed = duration;
			}
			
			if (timePassed < duration) {
				this[prop] = reverse ? 1 - progress : progress;
			} else {
				this[prop] = reverse ? 0 : 1;
				callback();
			}
		},
		
		_animate2: function (prop, duration, callback, reverse, timestamp) {
			var _this = this,
				timePassed = timestamp - this.oStart || performance.now() - this.oStart;
			console.log(timestamp)
			this.redraw = true;
			var progress = timePassed / duration;
			
			if (progress > 1) {
				progress = 1;
				timePassed = duration;
			}
			
			if (timePassed < duration) {
				this[prop] = reverse ? 1 - progress : progress;
				requestAnimationFrame(function(timestamp) {
					console.log('progress',progress)
					_this.animate2(timestamp);
				});
			} else {
				this[prop] = reverse ? 0 : 1;
				if (callback) callback();
			}
		},

		_drawLabel: function () {
			if (!this.lines.length || !this.chart.pointerX) return;

			var ctx = this.tooltip;
			ctx.clearRect(0, 0, ctx.width, ctx.height);

			var x = nearestValue(this.chart.pointerX, this.coordsX),
				dates = this.datesFull.slice(this.range.index0, this.range.index1 + 1),
				dateText = dates[dates.length - 1 - x.index],
				textAlign = 'left',
				linesLength = this.lines.length,
				labelOffset = 12,
				labelYPos = 5;

			this._drawLine(ctx, x.value, this.chart.area.top, x.value, this.chart.area.bottom, 1, this.gridActiveColor);

			for (var i = 0; i < linesLength; i++) {
				var range = this.lines[i].slice(this.range.index0, this.range.index1 + 1),
					y = range[range.length - 1 - x.index],
					lineName = this.data.names[this.lines[i][0]],
					labelWidth = Math.max(this.chart.labelTextValueWidth * linesLength + labelOffset * linesLength, getTextWidth(this.chart, this.labelDateFont, dateText) + labelOffset * 2),
					labelXPos = this.chart.pointerX - labelWidth / 2;

				var labelTextValueWidth = getTextWidth(this.chart, this.labelValueFont, y);

				if (labelTextValueWidth > this.chart.labelTextValueWidth) this.chart.labelTextValueWidth = labelTextValueWidth;

				if (labelXPos <= this.chart.area.left + labelOffset)
					labelXPos = this.chart.area.left + labelOffset;
				else if (this.chart.pointerX + labelWidth / 2 >= this.chart.area.right - labelOffset)
					labelXPos = this.chart.area.right - labelWidth - labelOffset;

				var textInnerPos = labelXPos + labelOffset,
					textXPos = textInnerPos + this.chart.labelTextValueWidth * i + labelOffset * i;

				this._drawCircle(ctx, x.value, this.coordsY[this.lines[i][0]][x.index], 5, this.data.colors[this.lines[i][0]], this.options.chart.lineWidth);

				if (i === 0) {
					this._drawRoundRect(ctx, labelXPos, labelYPos, labelWidth, 78, 3, this.labelBackground, this.labelShadowColor, this.labelShadowColor, 1);
					this._drawText(ctx, dateText, textAlign, 'alphabetic', textXPos, labelYPos + 21, this.labelDateFont, this.labelDateFontColor);
				}

				this._drawText(ctx, y, textAlign, 'alphabetic', textXPos, labelYPos + 49, this.labelValueFont, this.data.colors[this.lines[i][0]]);
				this._drawText(ctx, lineName, textAlign, 'alphabetic', textXPos, labelYPos + 67, this.labelLineNameFont, this.data.colors[this.lines[i][0]]);
			}

		}
	}
}());
