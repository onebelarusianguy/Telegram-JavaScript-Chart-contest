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
			lineWidth: 2
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
				gridFontColor: '#96a2aa',
				gridFont: '300 13px sans-serif',
			},
			dark: {
				background: '#242f3e',
				gridColor: '#293544',
				gridFontColor: '#546778',
				gridFont: '300 13px sans-serif',
			}
		}
	};

	var _supp = {
		init: function () {
			this.el = document.getElementsByTagName('body')[0];
			this.log10Check();
		},
		log10Check: function () {
			if (typeof Math.log10 === 'undefined') {
				Object.prototype.log10 = function (x) {
					return Math.log(x) / Math.log(10);
				}
			}
		},
	}
	_supp.init();

	function isTouchDevice() {
		var prefixes = ' -webkit- -moz- -o- -ms- '.split(' ');
		var mq = function (query) {
			return window.matchMedia(query).matches;
		}

		if (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
			return true;
		}

		var query = ['(', prefixes.join('touch-enabled),('), 'heartz', ')'].join('');
		return mq(query);
	}
	var isTouch = isTouchDevice();

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
		var max = -Infinity,
			i = data[0][0] === 'x' ? 1 : 0; // to handle array with or w/o timestamps
		for (; i < data.length; i++) {
			var item = data[i];
			for (var j = 1; j < item.length; j++) { // skip "y0", "y1", etc...
				if (item[j] > max) max = item[j];
			}
		}
		return max;
	}

	function getMinValue(data) {
		var min = Infinity,
			i = data[0][0] === 'x' ? 1 : 0; // to handle array with or w/o timestamps
		for (; i < data.length; i++) {
			var item = data[i];
			for (var j = 1; j < item.length; j++) { // skip "y0", "y1", etc...
				if (item[j] < min) min = item[j];
			}
		}
		return min;
	}

	function normalizeGridSteps(min, max, lines) {
		if (max <= 3) {
			return Math.ceil(min * 2) / 2;
		} else if (max > 3 && max <= 6) {
			return 1;
		} else if (max > 6 && max <= 60) {
			return 5;
		} else if (max > 60 && max <= 120) {
			return 20;
		} else if (max > 120 && max <= 240) {
			return 40;
		}

		return Math.floor((max - min) / lines);
	}

	function normalizeBigNumber(number) {
		var arr = ['', 'k', 'M', 'B', 'T'],
			tier = Math.log10(number) / 3 | 0;

		if (0 === tier) return Math.round(number);

		var scale = Math.pow(10, tier * 3),
			scaled = number / scale;

		return scaled.toFixed(1) + arr[tier];
	}

	function formatBigNumber(number) {
		return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
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

	function getTextWidth(ctx, font, text, offset) {
		offset = offset || 0;
		ctx.font = font;
		return ctx.measureText(text).width + offset;
	}

	function easeInCubic(t) {
		return t * t * t;
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
			this._createCanvas('chart', width, this.options.chart.height, this.options.id, true, false, this.nodes.chartWrapper);
			this._preparation();
			this._createTooltip();
			this._createCanvas('preview', width, this.options.preview.height, this.options.id + '-preview', false, false, this._createPreview());

			this.nodes.chart = this.chart.canvas;
			this.nodes.preview = this.preview.canvas;

			this._updateNodesOffsets();
			this._defineArea();
			// step in px between x values in preview chart
			this.stepX = this.preview.area.width / (this.data.columns[0].length === 2 ? 1 : this.data.columns[0].length - 2);

			this._setStartRange();
			this._createControls();

			this.animateLines = {};
			for (var lineName in this.data.names) {
				this.animateLines[lineName] = {
					opacity: {
						value: 0,
						valueFrom: 0,
						progress: 0,
						rafId: 0
					},
					y: {
						value: 0,
						valueFrom: getMaxValue(this.data.columns) * 8,
						progress: 0,
						rafId: 0
					},
					yMin: {
						value: 0,
						valueFrom: 0,
						progress: 0,
						rafId: 0
					}
				}
			}

			this.yDirection = 'up';

			this._checkLines(); // -> this._drawPreview();
			this._handlers();

			this.redraw = true;
			this._loop();
			window.scrollBy(0, 1);
		},

		_createWrapper: function () {
			var wrapper = document.createElement('div'),
				chartWrapper = document.createElement('div');
			wrapper.className = this.options.class;
			chartWrapper.className = this.options.class + '-wrapper';
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

		_createPreview: function () {
			var previewWrapper = document.createElement('div'),
				previewSlider = document.createElement('div'),
				previewSliderInner = document.createElement('div');

			previewWrapper.className = this.options.class + '-preview';
			previewWrapper.style.width = this.chart.width + 'px';
			previewSlider.className = this.options.class + '-preview__slider';
			previewSliderInner.className = this.options.class + '-preview__slider_inner';

			previewSlider.appendChild(previewSliderInner);
			previewWrapper.appendChild(previewSlider);
			this.nodes.wrapper.appendChild(previewWrapper);

			var sliderRect = previewSlider.getBoundingClientRect(),
				left = Math.round(sliderRect.left - previewWrapper.getBoundingClientRect().left),
				width = sliderRect.right - sliderRect.left;
			previewSlider.style.transform = 'translate3d(' + left + 'px, 0, 0)';
			previewSlider.style.width = Math.round(width) + 'px';
			previewSlider.style.left = '0px';

			this.nodes.previewWrapper = previewWrapper;
			this.nodes.previewSlider = previewSlider;
			this.nodes.previewSliderInner = previewSliderInner;

			return previewWrapper;
		},

		_createTooltip: function () {
			var tooltip = document.createElement('div'),
				x = document.createElement('div'),
				date = document.createElement('div'),
				wrapper = document.createElement('div');

			this.toolTip = {};

			this.toolTip.tooltip = tooltip;
			this.toolTip.tooltipDate = date;
			this.toolTip.tooltipLine = x;
			this.toolTip.tooltipLines = {};
			this.toolTip.tooltipCircles = {};

			wrapper.className = this.options.class + '-tooltip-wrapper';
			tooltip.className = this.options.class + '-tooltip';
			x.className = this.options.class + '-tooltip__line';
			wrapper.appendChild(x);
			date.className = this.options.class + '-tooltip__date';
			tooltip.appendChild(date);

			for (var prop in this.data.names) {
				var line = document.createElement('div'),
					circle = document.createElement('div'),
					value = document.createElement('span');

				line.className = this.options.class + '-tooltip-line__name';
				line.textContent = this.data.names[prop];
				line.setAttribute('data-name', prop);
				value.style.color = this.data.colors[prop];
				value.setAttribute('data-name', prop);

				circle.className = this.options.class + '-tooltip__circle';
				circle.setAttribute('data-name', prop);
				circle.style.borderColor = this.data.colors[prop];

				tooltip.appendChild(line);
				tooltip.appendChild(value);
				wrapper.appendChild(circle);

				this.toolTip.tooltipLines[prop] = value;
				this.toolTip.tooltipCircles[prop] = circle;

				if (!this.type) this.type = this.data.types[prop];
				if (!this.lineName) this.lineName = this.data.columns[1][0];
			}
			wrapper.appendChild(tooltip);
			this.nodes.tooltipWrapper = wrapper;
			this.nodes.chartWrapper.appendChild(wrapper);
		},

		_createControls: function () {
			var _this = this,
				chartName = document.createElement('span'),
				chartDateRange = document.createElement('span'),
				controls = document.createElement('div');

			chartName.className = this.options.class + '-name';
			chartDateRange.className = this.options.class + '-date-range';
			controls.className = this.options.class + '-controls';

			for (var prop in this.data.names) {
				if (this.data.names.hasOwnProperty(prop)) {
					var wrapper = document.createElement('div'),
						check = document.createElement('input'),
						span = document.createElement('span'),
						label = document.createElement('label');

					wrapper.className = this.options.class + '-check-wrapper';
					check.checked = true;
					check.type = 'checkbox';
					check.id = this.options.id + '-' + prop;
					check.name = prop;
					check.onchange = function () {
						_this._checkLines(this);
						this.nextSibling.style.backgroundColor = this.checked ? _this.data.colors[this.name] : 'transparent';
						this.nextSibling.style.color = this.checked ? '#fff' : _this.data.colors[this.name];
					}
					label.htmlFor = this.options.id + '-' + prop;
					label.textContent = this.data.names[prop];
					label.style.borderColor = this.data.colors[prop];
					label.style.backgroundColor = this.data.colors[prop];
					label.style.color = '#fff';
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
			this.chartDateRange = chartDateRange;
			this._setDateRange();
			this.nodes.chartWrapper.parentNode.insertBefore(chartDateRange, this.nodes.chartWrapper);
			this.nodes.previewWrapper.parentNode.insertBefore(controls, this.nodes.previewWrapper.nextSibling);
		},

		_setDateRange: function () {
			var date1 = this.datesFull[this.range.index0],
				date2 = this.datesFull[this.range.index1];

			if (date1 !== this.prevDate1 || date2 !== this.prevDate2) {
				this.chartDateRange.textContent = date1 + ' - ' + date2;
				this.prevDate1 = date1;
				this.prevDate2 = date2;
			}
		},

		_defineArea: function () {
			this.chart.paddingTop = 0;
			this.chart.paddingBottom = 60;
			this.chart.textPaddingBottom = 10;
			this.chart.datesPaddingBottom = 30;
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
				x1: this.nodes.previewSlider.offsets.right - this.nodes.previewWrapper.offsets.left
			};
			this.range.index0 = this.range.x0 === this.preview.area.left ? 1 : Math.round((this.range.x0 - this.range.x0 % this.stepX) / this.stepX + 2);
			this.range.index1 = this.range.x1 === this.preview.area.right ? this.data.columns[0].length - 1 : Math.round((this.range.x1 - this.range.x1 % this.stepX) / this.stepX + 1);

			var data = this.data.columns;
			if (this.data.y_scaled) {
				for (var i = 1; i < data.length; i++) {
					this.range[data[i][0]] = {
						max: 0,
						prevMax: getMaxValue(getDataRange([data[i]], this.range.index0, this.range.index1)) * 2
					}
					this.preview[data[i][0]] = {
						max: 0,
						prevMax: getMaxValue(data[i]) * 2
					}
				}
			} else {
				this.range.prevMax = 0;
				this.range.max = getMaxValue(getDataRange(data, this.range.index0, this.range.index1)) * 2;
				this.preview.max = 0;
				this.preview.prevMax = 0;
			}
		},

		_preparation: function () {
			this.gridLineWidth = this.options.gridLineWidth;
			this.gridFont = this.options.theme[this.options.themeActive].gridFont;
			this.gridDateOffset = 60;

			this.dates = ['x'];
			this.datesFull = ['x'];
			this.datesTooltip = ['x'];

			var data = this.data.columns[0],
				i = 1,
				tsLength = data.length,
				maxDateText = 0;

			for (; i < tsLength; i++) {
				var date = new Date(data[i]),
					month = this.months()[date.getMonth()],
					num = date.getDate(),
					day = this.days()[date.getDay()],
					year = date.getFullYear(),
					dateText = month + ' ' + num,
					dateTextFull = num + ' ' + month + ' ' + year,
					dateTextTooltip = day + ', ' + num + ' ' + month + ' ' + year;

				if (dateText.length > maxDateText.length) maxDateText = dateText;

				this.dates.push({
					date: dateText,
					opacity: 0
				});
				this.datesFull.push(dateTextFull);
				this.datesTooltip.push(dateTextTooltip);
			}
			this.dateWidth = Math.max(getTextWidth(this.chart, this.gridFont, maxDateText), 60);

			this._updateColorScheme();
		},

		_updateColorScheme: function () {
			this.gridFontColor = this.options.theme[this.options.themeActive].gridFontColor;
			this.background = this.options.theme[this.options.themeActive].background;
			this.gridColor = this.options.theme[this.options.themeActive].gridColor;
		},

		_drawPreview: function () {
			this.redraw = true;
			this.preview.fillStyle = this.background;
			this.preview.fillRect(0, 0, this.preview.width, this.options.preview.height);

			if (this.data.y_scaled) {
				this.preview.clearRect(0, 0, this.preview.width, this.preview.height);

				for (var i = 0; i < this.lines.length; i++) {
					this._drawChart(this.preview, [this.lines[i]]);
				}
			} else {
				this._drawChart(this.preview);
			}
		},

		_drawChart: function (ctx, arrLine) {
			var lines = arrLine || this.lines;

			if (!this.data.y_scaled) ctx.clearRect(0, 0, ctx.width, ctx.height);

			if (!lines.length) {
				this._drawLine(ctx, ctx.area.left, ctx.area.bottom, ctx.width, ctx.area.bottom, this.gridLineWidth, this.gridColor);
				this._drawText(ctx, 'No data available', 'center', 'middle', ctx.area.width / 2, ctx.area.height / 2, this.gridFont, this.gridFontColor);
				return;
			}

			var _this = this,
				data = this.data.columns[0],
				linesLength = lines.length,
				lineName = this.lineName,
				rangeRef = this.data.y_scaled ? ctx.name === 'chart' ? this.range[lineName] : this.preview[lineName] : ctx.name === 'chart' ? this.range : this.preview;

			if (rangeRef.max !== rangeRef.prevMax) {
				this.yDirection = rangeRef.max - rangeRef.prevMax > 0 ? 'down' : 'up';

				if (this.animateLines[lineName].y.rafId) {
					this.animateLines[lineName].y.valueFrom = this.animateLines[lineName].y.value; // set value from
					cancelAnimationFrame(this.animateLines[lineName].y.rafId);
					this.animateLines[lineName].y.rafId = null;
				}
				this._animate(this.animateLines[lineName], 'y', rangeRef.max, performance.now(), 280, function () {
					_this.isPreviewAnimating = false;
				});

				rangeRef.prevMax = rangeRef.max;
			}

			if (rangeRef.min !== rangeRef.prevMin) {
				this.yDirection = rangeRef.max - rangeRef.prevMax > 0 ? 'down' : 'up';

				if (this.animateLines[lineName].yMin.rafId) {
					this.animateLines[lineName].yMin.valueFrom = this.animateLines[lineName].yMin.value; // set value from
					cancelAnimationFrame(this.animateLines[lineName].yMin.rafId);
					this.animateLines[lineName].yMin.rafId = null;
				}
				this._animate(this.animateLines[lineName], 'yMin', rangeRef.min, performance.now(), 280, function () {
					_this.isPreviewAnimating = false;
				});

				rangeRef.prevMin = rangeRef.min;
			}

			if (ctx.name === 'chart') {
				var range = getDataRange(lines, this.range.index0, this.range.index1),
					max = getMaxValue(range),
					min = this.type === 'line' ? getMinValue(range) : 0,
					lName = this.data.y_scaled ? 'y0' : this.lineName;

				rangeRef.min = min;
				rangeRef.max = max;

				var yStep = normalizeGridSteps(min, max, this.options.gridLines),
					stepHeight = yStep * ctx.area.height / (max - min),
					opacity = Math.min(this.animateLines[lName].yMin.progress, this.animateLines[lName].y.progress),
					gridColor = hexToRGB(this.options.theme[this.options.themeActive].gridColor, opacity),
					lineYPos = ctx.area.bottom,
					numberYPos = ctx.area.bottom - ctx.textPaddingBottom,
					animationOffset = this.yDirection === 'up' ? 40 : -40;

				for (var l = 0; l < this.options.gridLines; l++) {
					if (l === 0) {
						this._drawLine(ctx, ctx.area.left, lineYPos - stepHeight * l, ctx.width, lineYPos - stepHeight * l, this.gridLineWidth, this.gridColor);
					} else {
						this._drawLine(ctx, ctx.area.left, (lineYPos - stepHeight * l + animationOffset) - animationOffset * opacity, ctx.width, (lineYPos - stepHeight * l + animationOffset) - animationOffset * opacity, this.gridLineWidth, gridColor);
					}
				}
			}

			ctx.save();
			ctx.lineWidth = this.options[ctx.name].lineWidth;

			if (ctx.name === 'preview') {

				var scale = 1,
					max = getMaxValue(lines),
					min = this.type === 'line' ? getMinValue(lines) : 0,
					rangeEnd = ctx.area.right;

				rangeRef.max = max;
				rangeRef.min = min;

			} else {
				ctx.lineJoin = 'round';

				this.coordsX = [];
				if (!this.data.y_scaled) this.coordsY = {};

				for (var n = 0; n < linesLength; n++) {
					this.coordsY[lines[n][0]] = [];
				}
				var rangeW = this.range.x1 - this.range.x0,
					scale = ctx.area.width / rangeW,
					rangeEnd = this.range.x1;
			}

			if (ctx.name === 'preview') {
				if (this.animateLines[lineName].y.rafId)
					max = this.animateLines[lineName].y.value;
			} else {
				max = this.animateLines[lineName].y.value;
				min = this.animateLines[lineName].yMin.value;
			}

			var j = 0,
				stepX = this.stepX * scale,
				xCalc = (ctx.area.width - rangeEnd) * scale + ctx.area.right,
				yCalc = ctx.area.bottom,
				yCalc1 = ctx.area.height / (max - min);

			for (; j < linesLength; j++) {

				var i = data.length - 1,
					k = 0,
					line = lines[j];

				lineName = line[0];
				this.lineName = lineName;

				ctx.beginPath();

				if (this.animateLines[lineName].opacity.rafId) {
					ctx.strokeStyle = hexToRGB(this.data.colors[lineName], this.animateLines[lineName].opacity.value); // add condition
				} else {
					ctx.strokeStyle = this.data.colors[lineName];
				}

				for (; i > 0; i--, k++) {

					var x1 = xCalc - stepX * k,
						x2 = xCalc - stepX * (k + 1),
						y1 = yCalc - (line[i] - min) * yCalc1,
						y2 = yCalc - (line[i - 1] - min) * yCalc1;
					//if (y1 < 0) console.log(line[i],' - ',min,'*',ctx.area.height,'/',max,'-',min )
					//console.log('y1',y1,line[i],' - ',min,'*',ctx.area.height,'/',max,'-',min )
					//if (ctx.name === 'preview') console.log('y1',y1,line[i],' - ',min,'*',ctx.area.height,'/',max,'-',min )

					if (k === 0) ctx.moveTo(x1, y1);
					ctx.lineTo(x2, y2);

					if (ctx.name === 'chart' && j === 0) {
						var t = (this.dateWidth + this.gridDateOffset) / stepX;

						if (stepX / (this.dateWidth + this.gridDateOffset) < 1) {
							var n = parseInt(t, 10);
						} else {
							var n = 1;
						}

						if (i % n === 0) {
							_this._drawText(ctx, _this.dates[i].date, 'right', 'middle', x1, _this.chart.height - _this.chart.datesPaddingBottom, _this.gridFont, hexToRGB(_this.gridFontColor, 1));
						}

					}

					if (ctx.name === 'chart') {
						if (x1 >= 0 && x1 <= ctx.area.width) {
							if (j === 0) this.coordsX.push(x1);
							this.coordsY[lineName].push(y1);
						}
						if (x2 < 0) {
							// we don't need to draw outside of canvas, so
							break;
						}
					}

				}

				ctx.stroke();
			}

			ctx.restore();

			if (ctx.name === 'chart') {
				if (this.data.y_scaled && this.lineName === 'y1') {
					var textAlign = 'right',
						x = ctx.area.right;
				} else {
					var textAlign = 'left',
						x = 0;
				}
				for (var l = 0; l <= this.options.gridLines; l++) {
					if (l === 0) {
						if (this.data.y_scaled)
							var fontColor = this.data.colors[lineName];
						else
							var fontColor = this.options.theme[this.options.themeActive].gridFontColor;

						if (this.type === 'line')
							this._drawText(ctx, normalizeBigNumber(min), textAlign, 'alphabetic', x, (numberYPos - stepHeight * l + animationOffset) - animationOffset * opacity, this.gridFont, hexToRGB(fontColor, opacity));
						else
							this._drawText(ctx, normalizeBigNumber(yStep * l), textAlign, 'alphabetic', x, numberYPos - stepHeight * l, this.gridFont, fontColor);

					} else {
						if (l === 1) {
							fontColor = hexToRGB(fontColor, opacity);
						}
						if (this.type === 'line')
							this._drawText(ctx, normalizeBigNumber(min + yStep * l), textAlign, 'alphabetic', x, (numberYPos - stepHeight * l + animationOffset) - animationOffset * opacity, this.gridFont, fontColor);
						else
							this._drawText(ctx, normalizeBigNumber(min + yStep * l), textAlign, 'alphabetic', x, (numberYPos - stepHeight * l + animationOffset) - animationOffset * opacity, this.gridFont, fontColor);
					}
				}
			}
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

		_drawLine: function (ctx, fromX, fromY, toX, toY, width, color) {
			ctx.save();
			ctx.beginPath();
			ctx.strokeStyle = color;
			ctx.moveTo(fromX, fromY);
			ctx.lineTo(toX, toY);
			ctx.stroke();
			ctx.restore();
		},

		_checkLines: function (elem) {
			var _this = this;
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
					this._animate(this.animateLines[prop], 'opacity', 1, performance.now(), 280);
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
										this.isPreviewAnimating = true;

										if (this.animateLines[line].opacity.rafId) {
											this.animateLines[line].opacity.valueFrom = this.animateLines[line].opacity.value; // set value from
											cancelAnimationFrame(this.animateLines[line].opacity.rafId);
											this.animateLines[line].opacity.rafId = null;
										}

										this._animate(_this.animateLines[line], 'opacity', 0, performance.now(), 280, function () {
											_this.lines.splice(j, 1); // callback
											elem.checked = false;
											_this.isPreviewAnimating = false;

											if (!_this.lines.length) {
												_this.preview.fillRect(0, 0, _this.preview.width, _this.preview.height);
											}

											var related = _this.nodes.tooltipWrapper.querySelectorAll('[data-name="' + line + '"]');
											for (var t = 0; t < related.length; t++) {
												related[t].style.display = 'none';
											}

										});

										break main;
									}
								}

								var related = this.nodes.tooltipWrapper.querySelectorAll('[data-name="' + line + '"]');
								for (var t = 0; t < related.length; t++) {
									related[t].style.removeProperty('display');
								}

								this.lines.push(this.data.columns[i]);
								this.isPreviewAnimating = true;

								if (this.animateLines[line].opacity.rafId) {
									this.animateLines[line].opacity.valueFrom = this.animateLines[line].opacity.value; // set value from
									cancelAnimationFrame(this.animateLines[line].opacity.rafId);
									this.animateLines[line].opacity.rafId = null;
								}

								this._animate(_this.animateLines[line], 'opacity', 1, performance.now(), 280, function () {
									_this.isPreviewAnimating = false;
									elem.checked = true;
								});

							} else {
								// just add

								var related = this.nodes.tooltipWrapper.querySelectorAll('[data-name="' + line + '"]');
								for (var t = 0; t < related.length; t++) {
									related[t].style.removeProperty('display');
								}

								this.isPreviewAnimating = true;
								this.lines.push(this.data.columns[i]);

								var max = Math.max.apply(null, this.data.columns[i].slice(1));

								if (this.data.y_scaled) {
									this.range[line].max = max * 16; //
								} else {
									this.range.max = max * 16; //
								}

								if (this.animateLines[line].opacity.rafId) {
									this.animateLines[line].opacity.valueFrom = this.animateLines[line].opacity.value; // set value from
									cancelAnimationFrame(this.animateLines[line].opacity.rafId);
									this.animateLines[line].opacity.rafId = null;
								}
								this._animate(_this.animateLines[line], 'opacity', 1, performance.now(), 240, function () {
									_this.isPreviewAnimating = false;
									elem.checked = true;
								});

							}
							break;
						}
					}
				this.lines.sort();
			}

			// update
			/*			if (this.data.y_scaled) {
							if (this.range[this.lineName].min) this.range[this.lineName].prevMin = this.range[this.lineName].min - 1;
							if (this.range[this.lineName].max) this.range[this.lineName].prevMax = this.range[this.lineName].max + 1;
						} else {
							if (this.range.min) {
								this.range.prevMin = this.range.min - 1;
								this.preview.prevMin = this.preview.min - 1;
							}
							if (this.range.max) {
								this.range.prevMax = this.range.max + 1;
								this.preview.prevMax = this.preview.max + 1;
							}
						}*/

			this.redraw = true;

			this.isPreviewAnimating = true;
			this._drawPreview();
		},

		_handlers: function () {
			var _this = this;

			function showTooltip(e) {
				if (!_this.lines.length) {
					_this.nodes.tooltipWrapper.style.display = 'none';
					return;
				} else {
					_this.nodes.tooltipWrapper.removeAttribute('style');
				}

				var clientX = e.touches ? e.touches[0].clientX : e.clientX,
					rect = this.offsets;
				/*if ((Math.abs(_this.chart.clientX - (clientX - rect.left))) < 3) return;*/

				if (clientX - rect.left < _this.chart.area.left) _this.chart.pointerX = _this.chart.area.left;
				else _this.chart.pointerX = clientX - rect.left;

				_this.chart.clientX = clientX - rect.left;

				_this._drawTooltip();
			}
			this.nodes.chart[isTouch ? 'ontouchmove' : 'onmousemove'] = showTooltip;
			this.nodes.chart.onclick = showTooltip;

			this.nodes.previewSlider.addEventListener(isTouch ? 'touchstart' : 'mousedown', dragstart, false);

			document.addEventListener(isTouch ? 'touchend' : 'mouseup', dragend, false);

			this.nodes.wrapper.addEventListener(isTouch ? 'touchmove' : 'mousemove', move, false);

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

				if (!_this.nodes.previewSlider.drag && !_this.nodes.previewSlider.resizer) return;

				if (_this.nodes.previewSlider.dragStart !== clientX) {

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


					_this._setDateRange();
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

			this.nodes.chart.style.width = width + 'px';
			this.nodes.chart.width = Math.round(width * this.dpr);
			this.nodes.preview.style.width = width + 'px';
			this.nodes.preview.width = Math.round(width * this.dpr);
			this.nodes.previewWrapper.style.width = width + 'px';

			this.chart.scale(this.dpr, this.dpr);
			this.preview.scale(this.dpr, this.dpr);

			this._updateNodesOffsets();
			this._defineArea();
			this.stepX = width / (this.data.columns[0].length === 2 ? 1 : this.data.columns[0].length - 2);
			/*this._drawPreview();*/
		},

		_loop: function () {
			var _this = this;

			if (this.preview.prevPointerX !== this.preview.pointerX) {
				this.preview.prevPointerX = this.preview.pointerX;
				this.redraw = true;
			}

			this._render();

			requestAnimationFrame(function () {
				_this._loop();
			});
		},

		_render: function () {
			if (!this.redraw) return;

			if (this.data.y_scaled) {
				this.chart.clearRect(0, 0, this.chart.width, this.chart.height); // todo: ctx
				if (this.data.y_scaled) this.coordsY = {};

				for (var i = 0; i < this.lines.length; i++) {
					this._drawChart(this.chart, [this.lines[i]]);
				}
			} else {
				this._drawChart(this.chart);
			}
			if (this.isPreviewAnimating || !this.preview.pointerX) this._drawPreview();
			this.redraw = false;
		},

		_animate: function (obj, prop, to, start, duration, callback) {
			this.redraw = true;

			var args = arguments,
				_this = this,
				timePassed = performance.now() - start,
				from = obj[prop].valueFrom,
				progress = /*easeInCubic(*/ timePassed / duration /*)*/ ,
				value;

			if (progress > 1) {
				progress = 1;
				timePassed = duration;
			}

			value = from + progress * (to - from);

			if (timePassed < duration) {
				obj[prop].value = value;
				obj[prop].progress = progress;
				//console.log('step', prop, _this.lineName,'to',to,'from',from,'progress',progress,'value',value)

				obj[prop].rafId = requestAnimationFrame(function () {
					_this._animate.apply(_this, args);
				});
			} else {
				obj[prop].rafId = null;
				obj[prop].value = value;
				obj[prop].valueFrom = value;
				obj[prop].progress = progress;
				if (callback) callback();
			}
		},

		_drawTooltip: function () {
			var x = nearestValue(this.chart.pointerX, this.coordsX);

			if (this.chart.prevNearest !== 'undefined' && this.chart.prevNearest === x.index) {
				return;
			}

			var dates = this.datesTooltip.slice(this.range.index0, this.range.index1 + 1),
				dateText = dates[dates.length - 1 - x.index],
				linesLength = this.lines.length,
				tooltipWidth = this.toolTip.tooltip.clientWidth,
				offset = 10,
				tooltipLines = this.toolTip.tooltipLines,
				circles = this.toolTip.tooltipCircles,
				i = 0;

			if (this.chart.pointerX < this.chart.area.width / 2) {
				var labelXPos = this.chart.pointerX + offset;
			} else {
				var labelXPos = this.chart.pointerX - offset - tooltipWidth;
			}

			this.toolTip.tooltipDate.textContent = dateText;
			this.toolTip.tooltip.style.setProperty('transform', 'translate3d(' + labelXPos + 'px, 0, 0');
			this.toolTip.tooltipLine.style.setProperty('transform', 'translate3d(' + x.value + 'px, 0, 0');

			for (; i < linesLength; i++) {
				var range = this.lines[i].slice(this.range.index0, this.range.index1 + 1),
					y = formatBigNumber(range[range.length - 1 - x.index]),
					lineName = this.lines[i][0];
				tooltipLines[lineName].textContent = y;
				tooltipLines[lineName].className = tooltipLines[lineName].className === 'fadein' ? 'fadeout' : 'fadein';

				circles[lineName].style.setProperty('transform', 'translate3d(' + x.value + 'px, ' + this.coordsY[lineName][x.index] + 'px, 0)');
			}
			this.chart.prevNearest = x.index;
		}
	}
}());
