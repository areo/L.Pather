this.L = this.L || {};
this.L.Pather = (function (leaflet) {
    'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };

    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };

    var Mode;
    (function (Mode) {
        Mode[Mode["VIEW"] = 1] = "VIEW";
        Mode[Mode["CREATE"] = 2] = "CREATE";
        Mode[Mode["EDIT"] = 4] = "EDIT";
        Mode[Mode["DELETE"] = 8] = "DELETE";
        Mode[Mode["APPEND"] = 16] = "APPEND";
        Mode[Mode["EDIT_APPEND"] = 20] = "EDIT_APPEND";
        Mode[Mode["ALL"] = 31] = "ALL";
    })(Mode || (Mode = {}));
    var Mode$1 = Mode;

    var PatherPolyline = /** @class */ (function () {
        function PatherPolyline(map, latLngs, options, methods) {
            this.map = map;
            this.options = options;
            this.methods = methods;
            this.edges = [];
            this.polyline = new leaflet.Polyline(latLngs, this.options).addTo(map);
            this.edges = [];
            this.manipulating = null;
            this.attachPolylineEvents(this.polyline);
            this.select();
        }
        PatherPolyline.prototype.select = function () {
            this.attachElbows();
        };
        PatherPolyline.prototype.deselect = function () {
            this.manipulating = null;
        };
        PatherPolyline.prototype.attachElbows = function () {
            var _this = this;
            this.detachElbows();
            this.getLatLngs().forEach(function (latLng) {
                var icon = new leaflet.DivIcon({
                    className: _this.options.elbowClass || 'elbow'
                });
                var edge = new leaflet.Marker(latLng, { icon: icon }).addTo(_this.map);
                _this.attachElbowEvents(edge);
                _this.edges.push(edge);
            });
        };
        PatherPolyline.prototype.detachElbows = function () {
            var _this = this;
            this.edges.forEach(function (edge) { return _this.map.removeLayer(edge); });
            this.edges.length = 0;
        };
        PatherPolyline.prototype.attachPolylineEvents = function (polyline) {
            var _this = this;
            polyline.on('click', function (event) {
                event.originalEvent.stopPropagation();
                event.originalEvent.preventDefault();
                if (_this.methods.mode() & Mode$1.APPEND) {
                    // Appending takes precedence over deletion!
                    var latLng = _this.map.mouseEventToLatLng(event.originalEvent);
                    _this.insertElbow(latLng);
                }
                else if (_this.methods.mode() & Mode$1.DELETE) {
                    _this.methods.remove(_this);
                }
            });
        };
        PatherPolyline.prototype.attachElbowEvents = function (marker) {
            var _this = this;
            marker.on('mousedown touchstart', function (event) {
                var originalEvent = event.originalEvent;
                if (_this.methods.mode() & Mode$1.EDIT) {
                    if (originalEvent.stopPropagation) {
                        originalEvent.stopPropagation();
                        originalEvent.preventDefault();
                    }
                    _this.manipulating = marker;
                }
            });
            marker.on('mouseup touchend', function (event) {
                var originalEvent = event.originalEvent;
                if (originalEvent.stopPropagation) {
                    originalEvent.stopPropagation();
                    originalEvent.preventDefault();
                }
                _this.manipulating = null;
            });
        };
        PatherPolyline.prototype.insertElbow = function (latLng) {
            var _this = this;
            var newPoint = this.map.latLngToLayerPoint(latLng);
            var leastDistance = Infinity;
            var insertAt = -1;
            var points = this.getLatLngs().map(function (latLng) {
                return _this.map.latLngToLayerPoint(latLng);
            });
            points.forEach(function (currentPoint, index) {
                var nextPoint = points[index + 1] || points[0];
                var distance = leaflet.LineUtil.pointToSegmentDistance(newPoint, currentPoint, nextPoint);
                if (distance < leastDistance) {
                    leastDistance = distance;
                    insertAt = index;
                }
            });
            points.splice(insertAt + 1, 0, newPoint);
            var parts = points.map(function (point) {
                var latLng = _this.map.layerPointToLatLng(point);
                return { _latlng: latLng };
            });
            this.redraw(parts);
            this.attachElbows();
        };
        PatherPolyline.prototype.moveTo = function (point) {
            this.manipulating.setLatLng(this.map.layerPointToLatLng(point));
            this.redraw(this.edges);
        };
        PatherPolyline.prototype.finished = function () {
            this.methods.fire('edited', {
                polyline: this,
                latLngs: this.polyline.getLatLngs()
            });
        };
        PatherPolyline.prototype.redraw = function (edges) {
            var latLngs = edges.map(function (edge) { return edge._latlng; });
            var options = __assign({}, this.options, { smoothFactor: 0 });
            this.softRemove(false);
            this.polyline = new leaflet.Polyline(latLngs, options).addTo(this.map);
            this.attachPolylineEvents(this.polyline);
        };
        PatherPolyline.prototype.softRemove = function (edgesToo) {
            var _this = this;
            if (edgesToo === void 0) { edgesToo = true; }
            this.map.removeLayer(this.polyline);
            if (edgesToo) {
                this.edges.forEach(function (edge) {
                    _this.map.removeLayer(edge);
                });
            }
        };
        PatherPolyline.prototype.getLatLngs = function () {
            return this.polyline.getLatLngs();
        };
        return PatherPolyline;
    }());

    var Pather = /** @class */ (function (_super) {
        __extends(Pather, _super);
        function Pather(options, d3) {
            if (options === void 0) { options = {}; }
            var _this = _super.call(this) || this;
            _this.options = options;
            _this.creating = false;
            _this.polylines = [];
            _this.draggingState = false;
            _this.latLngs = [];
            _this.d3 = d3;
            _this.options = __assign({}, _this.defaultOptions(), options);
            return _this;
        }
        Pather.prototype.createPath = function (latLngs) {
            if (latLngs.length <= 1) {
                return false;
            }
            this.clearAll();
            var options = {
                color: this.options.color,
                opacity: this.options.opacity,
                weight: this.options.weight,
                smoothFactor: this.options.smoothFactor,
                elbowClass: this.options.elbowClass
            };
            var polyline = new PatherPolyline(this.map, latLngs, options, {
                fire: this.fire.bind(this),
                mode: this.getMode.bind(this),
                remove: this.removePath.bind(this)
            });
            this.polylines.push(polyline);
            this.fire("created", {
                polyline: polyline,
                latLngs: polyline.getLatLngs()
            });
            return polyline;
        };
        Pather.prototype.removePath = function (model) {
            if (model instanceof PatherPolyline) {
                var indexOf = this.polylines.indexOf(model);
                this.polylines.splice(indexOf, 1);
                model.softRemove();
                this.fire("deleted", { polyline: model, latLngs: [] });
                return true;
            }
            return false;
        };
        Pather.prototype.clearPaths = function () {
            var _this = this;
            this.polylines.forEach(function (polyline) {
                polyline.softRemove();
                _this.fire("deleted", { polyline: polyline, latLngs: [] });
            });
            this.polylines = [];
        };
        Pather.prototype.getPaths = function () {
            return this.polylines;
        };
        Pather.prototype.onAdd = function (map) {
            this.map = map;
            this.element = map.getContainer();
            this.draggingState = map.dragging.enabled();
            this.fromPoint = new leaflet.Point(0, 0, false);
            this.svg = this.d3
                .select(this.element)
                .append("svg")
                .attr("pointer-events", "none")
                .attr("class", this.getOption("moduleClass"))
                .attr("width", this.getOption("width"))
                .attr("height", this.getOption("height"));
            map.dragging.disable();
            // Attach the mouse events for drawing the polyline.
            this.attachEvents(map);
            this.setMode(this.options.mode);
            return this;
        };
        Pather.prototype.onRemove = function (map) {
            this.svg.remove();
            if (this.options.removePolylines) {
                var length = this.polylines.length;
                while (length--) {
                    this.removePath(this.polylines[length]);
                }
            }
            this.map.off("mousedown", this.eventHandlers.mouseDown);
            this.map.off("mousemove", this.eventHandlers.mouseMove);
            this.map.off("mouseup", this.eventHandlers.mouseUp);
            this.map
                .getContainer()
                .removeEventListener("mouseleave", this.eventHandlers.mouseLeave);
            this.map
                .getContainer()
                .removeEventListener("touchstart", this.eventHandlers.touchStart);
            this.map
                .getContainer()
                .removeEventListener("touchmove", this.eventHandlers.touchMove);
            this.map
                .getContainer()
                .removeEventListener("touchend", this.eventHandlers.touchEnd);
            this.element.classList.remove("mode-create");
            this.element.classList.remove("mode-delete");
            this.element.classList.remove("mode-edit");
            this.element.classList.remove("mode-append");
            var tileLayer = this.map
                .getContainer()
                .querySelector(".leaflet-tile-pane");
            var originalState = this.draggingState ? "enable" : "disable";
            tileLayer.style.pointerEvents = "all";
            this.map.dragging[originalState]();
            return this;
        };
        Pather.prototype.edgeBeingChanged = function () {
            var edges = this.polylines.filter(function (polyline) { return polyline.manipulating != null; });
            return edges.length === 0 ? null : edges[0];
        };
        Pather.prototype.isPolylineCreatable = function () {
            return !!(this.options.mode & Mode$1.CREATE);
        };
        Pather.prototype.mouseDownHandler = function (event) {
            var latLng = this.map.mouseEventToLatLng(event);
            if (this.isPolylineCreatable() && !this.edgeBeingChanged()) {
                this.creating = true;
                this.fromPoint = this.map.latLngToContainerPoint(latLng);
                this.latLngs = [];
            }
        };
        Pather.prototype.mouseMoveHandler = function (event) {
            var point = this.map.mouseEventToContainerPoint(event);
            if (this.edgeBeingChanged()) {
                this.edgeBeingChanged().moveTo(this.map.containerPointToLayerPoint(point));
                return;
            }
            var lineFunction = this.d3
                .line()
                .x(function (d) { return d.x; })
                .y(function (d) { return d.y; })
                .curve(this.d3.curveLinear);
            if (this.creating) {
                var lineData = [this.fromPoint, new leaflet.Point(point.x, point.y, false)];
                this.latLngs.push(this.map.containerPointToLatLng(point));
                this.svg
                    .append("path")
                    .classed("drawing-line", true)
                    .attr("d", lineFunction(lineData))
                    .attr("stroke", this.getOption("strokeColour"))
                    .attr("stroke-width", this.getOption("strokeWidth"))
                    .attr("fill", "none");
                this.fromPoint = new leaflet.Point(point.x, point.y, false);
            }
        };
        Pather.prototype.mouseLeaveHandler = function () {
            this.clearAll();
            this.creating = false;
        };
        Pather.prototype.mouseUpHandler = function () {
            if (this.creating) {
                this.creating = false;
                this.createPath(this.latLngs);
                this.latLngs = [];
                return;
            }
            var edgeBeingChanged = this.edgeBeingChanged();
            if (!edgeBeingChanged)
                return;
            edgeBeingChanged.attachElbows();
            edgeBeingChanged.finished();
            edgeBeingChanged.manipulating = null;
        };
        Pather.prototype.attachEvents = function (map) {
            var _this = this;
            this.eventHandlers = {
                mouseDown: function (event) { return _this.mouseDownHandler(event.originalEvent); },
                mouseMove: function (event) {
                    event.originalEvent.preventDefault();
                    _this.mouseMoveHandler(event.originalEvent);
                },
                mouseUp: function (event) { return _this.mouseUpHandler(); },
                mouseLeave: function (event) { return _this.mouseLeaveHandler(); },
                touchStart: function (event) {
                    return _this.mouseDownHandler(event.touches[0]);
                },
                touchMove: function (event) {
                    event.preventDefault();
                    _this.mouseMoveHandler(event.touches[0]);
                },
                touchEnd: function (event) { return _this.mouseUpHandler(); }
            };
            this.map.on("mousedown", this.eventHandlers.mouseDown);
            this.map.on("mousemove", this.eventHandlers.mouseMove);
            this.map.on("mouseup", this.eventHandlers.mouseUp);
            this.map
                .getContainer()
                .addEventListener("mouseleave", this.eventHandlers.mouseLeave);
            // Attach the mobile events that delegate to the desktop events.
            this.map
                .getContainer()
                .addEventListener("touchstart", this.eventHandlers.touchStart);
            this.map
                .getContainer()
                .addEventListener("touchmove", this.eventHandlers.touchMove);
            this.map
                .getContainer()
                .addEventListener("touchend", this.eventHandlers.touchEnd);
        };
        /**
         * @method clearAll
         * @return {void}
         */
        Pather.prototype.clearAll = function () {
            this.svg.text("");
        };
        /**
         * @method getOption
         * @param {String} property
         * @return {String|Number}
         */
        Pather.prototype.getOption = function (property) {
            return this.options[property] || this.defaultOptions()[property];
        };
        /**
         * @method defaultOptions
         * @return {Object}
         */
        Pather.prototype.defaultOptions = function () {
            return {
                moduleClass: "pather",
                lineClass: "drawing-line",
                detectTouch: true,
                elbowClass: "elbow",
                removePolylines: true,
                strokeColour: "rgba(0,0,0,.5)",
                strokeWidth: 2,
                width: "100%",
                height: "100%",
                smoothFactor: 10,
                color: "black",
                opacity: 0.55,
                weight: 3,
                mode: Mode$1.ALL
            };
        };
        /**
         * @method setSmoothFactor
         * @param {Number} smoothFactor
         * @return {void}
         */
        Pather.prototype.setSmoothFactor = function (smoothFactor) {
            this.options.smoothFactor = smoothFactor;
        };
        /**
         * @method setMode
         * @param {Number} mode
         * @return {void}
         */
        Pather.prototype.setMode = function (mode) {
            var _this = this;
            this.setClassName(mode);
            this.options.mode = mode;
            var tileLayer = this.map
                .getContainer()
                .querySelector(".leaflet-tile-pane");
            /**
             * @method shouldDisableDrag
             * @return {Boolean}
             * @see http://www.stucox.com/blog/you-cant-detect-a-touchscreen/
             */
            var shouldDisableDrag = function () {
                if (_this.options.detectTouch &&
                    ("ontouchstart" in window || "onmsgesturechange" in window)) {
                    return (!!(_this.options.mode & Mode$1.CREATE) ||
                        !!(_this.options.mode & Mode$1.EDIT));
                }
                return !!(_this.options.mode & Mode$1.CREATE);
            };
            if (shouldDisableDrag()) {
                var originalState = this.draggingState ? "disable" : "enable";
                tileLayer.style.pointerEvents = "none";
                return void this.map.dragging[originalState]();
            }
            tileLayer.style.pointerEvents = "all";
            this.map.dragging.enable();
        };
        /**
         * @method setClassName
         * @param {Number} mode
         * @return {void}
         */
        Pather.prototype.setClassName = function (mode) {
            var _this = this;
            /**
             * @method conditionallyAppendClassName
             * @param {String} modeName
             * @return {void}
             */
            var conditionallyAppendClassName = function (modeName) {
                var className = ["mode", modeName].join("-");
                if (Mode$1[modeName.toUpperCase()] & mode) {
                    return void _this.element.classList.add(className);
                }
                _this.element.classList.remove(className);
            };
            conditionallyAppendClassName("create");
            conditionallyAppendClassName("delete");
            conditionallyAppendClassName("edit");
            conditionallyAppendClassName("append");
        };
        Pather.prototype.getMode = function () {
            return this.options.mode;
        };
        Pather.prototype.setOptions = function (options) {
            this.options = __assign({}, this.options, options);
        };
        Pather.MODE = Mode$1;
        return Pather;
    }(leaflet.FeatureGroup));

    return Pather;

}(L));
module.exports = this.L.Pather;
