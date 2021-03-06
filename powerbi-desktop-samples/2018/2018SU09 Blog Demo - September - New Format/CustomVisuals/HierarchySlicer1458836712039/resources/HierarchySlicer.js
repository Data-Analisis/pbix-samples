/**
 * jQuery CSS Customizable Scrollbar
 *
 * Copyright 2014, Yuriy Khabarov
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * If you found bug, please contact me via email <13real008@gmail.com>
 *
 * @author Yuriy Khabarov aka Gromo
 * @version 0.2.5
 * @url https://github.com/gromo/jquery.scrollbar/
 *
 */
;
(function ($, doc, win) {
    'use strict';

    // init flags & variables
    var debug = false;
    var lmb = 1, px = "px";

    var browser = {
        "data": {},
        "macosx": win.navigator.platform.toLowerCase().indexOf('mac') !== -1,
        "mobile": /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(win.navigator.userAgent),
        "overlay": null,
        "scroll": null,
        "scrolls": [],
        "webkit": /WebKit/.test(win.navigator.userAgent),

        "log": debug ? function (data, toString) {
            var output = data;
            if (toString && typeof data != "string") {
                output = [];
                $.each(data, function (i, v) {
                    output.push('"' + i + '": ' + v);
                });
                output = output.join(", ");
            }
            if (win.console && win.console.log) {
                win.console.log(output);
            } else {
                alert(output);
            }
        } : function () {

        }
    };

    var defaults = {
        "autoScrollSize": true,     // automatically calculate scrollsize
        "autoUpdate": true,         // update scrollbar if content/container size changed
        "debug": false,             // debug mode
        "disableBodyScroll": false, // disable body scroll if mouse over container
        "duration": 200,            // scroll animate duration in ms
        "ignoreMobile": true,       // ignore mobile devices
        "ignoreOverlay": true,      // ignore browsers with overlay scrollbars (mobile, MacOS)
        "scrollStep": 30,           // scroll step for scrollbar arrows
        "showArrows": false,        // add class to show arrows
        "stepScrolling": true,      // when scrolling to scrollbar mousedown position
        "type": "simple",            // [advanced|simple] scrollbar html type

        "scrollx": null,            // horizontal scroll element
        "scrolly": null,            // vertical scroll element

        "onDestroy": null,          // callback function on destroy,
        "onInit": null,             // callback function on first initialization
        "onScroll": null,           // callback function on content scrolling
        "onUpdate": null            // callback function on init/resize (before scrollbar size calculation)
    };


    var customScrollbar = function (container, options) {

        if (!browser.scroll) {
            browser.log("Init jQuery Scrollbar v0.2.5");
            browser.overlay = isScrollOverlaysContent();
            browser.scroll = getBrowserScrollSize();
            updateScrollbars();

            $(win).resize(function () {
                var forceUpdate = false;
                if (browser.scroll && (browser.scroll.height || browser.scroll.width)) {
                    var scroll = getBrowserScrollSize();
                    if (scroll.height != browser.scroll.height || scroll.width != browser.scroll.width) {
                        browser.scroll = scroll;
                        forceUpdate = true; // handle page zoom
                    }
                }
                updateScrollbars(forceUpdate);
            });
        }

        this.container = container;
        this.options = $.extend({}, defaults, win.jQueryScrollbarOptions || {});
        this.scrollTo = null;
        this.scrollx = {};
        this.scrolly = {};

        this.init(options);
    };

    customScrollbar.prototype = {

        destroy: function () {

            if (!this.wrapper) {
                return;
            }

            // init variables
            var scrollLeft = this.container.scrollLeft();
            var scrollTop = this.container.scrollTop();

            this.container.insertBefore(this.wrapper).css({
                "height": "",
                "margin": ""
            })
            .removeClass("scroll-content")
            .removeClass("scroll-scrollx_visible")
            .removeClass("scroll-scrolly_visible")
            .off(".scrollbar")
            .scrollLeft(scrollLeft)
            .scrollTop(scrollTop);

            this.scrollx.scrollbar.removeClass("scroll-scrollx_visible").find("div").andSelf().off(".scrollbar");
            this.scrolly.scrollbar.removeClass("scroll-scrolly_visible").find("div").andSelf().off(".scrollbar");

            this.wrapper.remove();

            $(doc).add("body").off(".scrollbar");

            if ($.isFunction(this.options.onDestroy))
                this.options.onDestroy.apply(this, [this.container]);
        },



        getScrollbar: function (d) {

            var scrollbar = this.options["scroll" + d];
            var html = {
                "advanced":
                '<div class="scroll-element_corner"></div>' +
                '<div class="scroll-arrow scroll-arrow_less"></div>' +
                '<div class="scroll-arrow scroll-arrow_more"></div>' +
                '<div class="scroll-element_outer">' +
                '    <div class="scroll-element_size"></div>' + // required! used for scrollbar size calculation !
                '    <div class="scroll-element_inner-wrapper">' +
                '        <div class="scroll-element_inner scroll-element_track">' + // used for handling scrollbar click
                '            <div class="scroll-element_inner-bottom"></div>' +
                '        </div>' +
                '    </div>' +
                '    <div class="scroll-bar">' +
                '        <div class="scroll-bar_body">' +
                '            <div class="scroll-bar_body-inner"></div>' +
                '        </div>' +
                '        <div class="scroll-bar_bottom"></div>' +
                '        <div class="scroll-bar_center"></div>' +
                '    </div>' +
                '</div>',

                "simple":
                '<div class="scroll-element_outer">' +
                '    <div class="scroll-element_size"></div>' + // required! used for scrollbar size calculation !
                '    <div class="scroll-element_track"></div>' + // used for handling scrollbar click
                '    <div class="scroll-bar"></div>' +
                '</div>'
            };
            var type = html[this.options.type] ? this.options.type : "advanced";

            if (scrollbar) {
                if (typeof (scrollbar) == "string") {
                    scrollbar = $(scrollbar).appendTo(this.wrapper);
                } else {
                    scrollbar = $(scrollbar);
                }
            } else {
                scrollbar = $("<div>").addClass("scroll-element").html(html[type]).appendTo(this.wrapper);
            }

            if (this.options.showArrows) {
                scrollbar.addClass("scroll-element_arrows_visible");
            }

            return scrollbar.addClass("scroll-" + d);
        },



        init: function (options) {

            // init variables
            var S = this;

            var c = this.container;
            var cw = this.containerWrapper || c;
            var o = $.extend(this.options, options || {});
            var s = {
                "x": this.scrollx,
                "y": this.scrolly
            };
            var w = this.wrapper;

            var initScroll = {
                "scrollLeft": c.scrollLeft(),
                "scrollTop": c.scrollTop()
            };

            // do not init if in ignorable browser
            if ((browser.mobile && o.ignoreMobile)
                    || (browser.overlay && o.ignoreOverlay)
                    || (browser.macosx && !browser.webkit) // still required to ignore nonWebKit browsers on Mac
                    ) {
                return false;
            }

            // init scroll container
            if (!w) {
                this.wrapper = w = $('<div>').addClass('scroll-wrapper').addClass(c.attr('class'))
                .css('position', c.css('position') == 'absolute' ? 'absolute' : 'relative')
                .insertBefore(c).append(c);

                if (c.is('textarea')) {
                    this.containerWrapper = cw = $('<div>').insertBefore(c).append(c);
                    w.addClass('scroll-textarea');
                }

                cw.addClass("scroll-content").css({
                    "height": "",
                    "margin-bottom": browser.scroll.height * -1 + px,
                    "margin-right": browser.scroll.width * -1 + px
                });

                c.on("scroll.scrollbar", function (event) {
                    if ($.isFunction(o.onScroll)) {
                        o.onScroll.call(S, {
                            "maxScroll": s.y.maxScrollOffset,
                            "scroll": c.scrollTop(),
                            "size": s.y.size,
                            "visible": s.y.visible
                        }, {
                            "maxScroll": s.x.maxScrollOffset,
                            "scroll": c.scrollLeft(),
                            "size": s.x.size,
                            "visible": s.x.visible
                        });
                    }
                    s.x.isVisible && s.x.scroller.css("left", c.scrollLeft() * s.x.kx + px);
                    s.y.isVisible && s.y.scroller.css("top", c.scrollTop() * s.y.kx + px);
                });

                /* prevent native scrollbars to be visible on #anchor click */
                w.on("scroll", function () {
                    w.scrollTop(0).scrollLeft(0);
                });

                if (o.disableBodyScroll) {
                    var handleMouseScroll = function (event) {
                        isVerticalScroll(event) ?
                        s.y.isVisible && s.y.mousewheel(event) :
                        s.x.isVisible && s.x.mousewheel(event);
                    };
                    w.on({
                        "MozMousePixelScroll.scrollbar": handleMouseScroll,
                        "mousewheel.scrollbar": handleMouseScroll
                    });

                    if (browser.mobile) {
                        w.on("touchstart.scrollbar", function (event) {
                            var touch = event.originalEvent.touches && event.originalEvent.touches[0] || event;
                            var originalTouch = {
                                "pageX": touch.pageX,
                                "pageY": touch.pageY
                            };
                            var originalScroll = {
                                "left": c.scrollLeft(),
                                "top": c.scrollTop()
                            };
                            $(doc).on({
                                "touchmove.scrollbar": function (event) {
                                    var touch = event.originalEvent.targetTouches && event.originalEvent.targetTouches[0] || event;
                                    c.scrollLeft(originalScroll.left + originalTouch.pageX - touch.pageX);
                                    c.scrollTop(originalScroll.top + originalTouch.pageY - touch.pageY);
                                    event.preventDefault();
                                },
                                "touchend.scrollbar": function () {
                                    $(doc).off(".scrollbar");
                                }
                            });
                        });
                    }
                }
                if ($.isFunction(o.onInit))
                    o.onInit.apply(this, [c]);
            } else {
                cw.css({
                    "height": "",
                    "margin-bottom": browser.scroll.height * -1 + px,
                    "margin-right": browser.scroll.width * -1 + px
                });
            }

            // init scrollbars & recalculate sizes
            $.each(s, function (d, scrollx) {

                var scrollCallback = null;
                var scrollForward = 1;
                var scrollOffset = (d == "x") ? "scrollLeft" : "scrollTop";
                var scrollStep = o.scrollStep;
                var scrollTo = function () {
                    var currentOffset = c[scrollOffset]();
                    c[scrollOffset](currentOffset + scrollStep);
                    if (scrollForward == 1 && (currentOffset + scrollStep) >= scrollToValue)
                        currentOffset = c[scrollOffset]();
                    if (scrollForward == -1 && (currentOffset + scrollStep) <= scrollToValue)
                        currentOffset = c[scrollOffset]();
                    if (c[scrollOffset]() == currentOffset && scrollCallback) {
                        scrollCallback();
                    }
                }
                var scrollToValue = 0;

                if (!scrollx.scrollbar) {

                    scrollx.scrollbar = S.getScrollbar(d);
                    scrollx.scroller = scrollx.scrollbar.find(".scroll-bar");

                    scrollx.mousewheel = function (event) {

                        if (!scrollx.isVisible || (d == 'x' && isVerticalScroll(event))) {
                            return true;
                        }
                        if (d == 'y' && !isVerticalScroll(event)) {
                            s.x.mousewheel(event);
                            return true;
                        }

                        var delta = event.originalEvent.wheelDelta * -1 || event.originalEvent.detail;
                        var maxScrollValue = scrollx.size - scrollx.visible - scrollx.offset;

                        if (!((scrollToValue <= 0 && delta < 0) || (scrollToValue >= maxScrollValue && delta > 0))) {
                            scrollToValue = scrollToValue + delta;
                            if (scrollToValue < 0)
                                scrollToValue = 0;
                            if (scrollToValue > maxScrollValue)
                                scrollToValue = maxScrollValue;

                            S.scrollTo = S.scrollTo || {};
                            S.scrollTo[scrollOffset] = scrollToValue;
                            setTimeout(function () {
                                if (S.scrollTo) {
                                    c.stop().animate(S.scrollTo, 240, 'linear', function () {
                                        scrollToValue = c[scrollOffset]();
                                    });
                                    S.scrollTo = null;
                                }
                            }, 1);
                        }

                        event.preventDefault();
                        return false;
                    };

                    scrollx.scrollbar.on({
                        "MozMousePixelScroll.scrollbar": scrollx.mousewheel,
                        "mousewheel.scrollbar": scrollx.mousewheel,
                        "mouseenter.scrollbar": function () {
                            scrollToValue = c[scrollOffset]();
                        }
                    });

                    // handle arrows & scroll inner mousedown event
                    scrollx.scrollbar.find(".scroll-arrow, .scroll-element_track")
                    .on("mousedown.scrollbar", function (event) {

                        if (event.which != lmb)
                            return true;

                        scrollForward = 1;

                        var data = {
                            "eventOffset": event[(d == "x") ? "pageX" : "pageY"],
                            "maxScrollValue": scrollx.size - scrollx.visible - scrollx.offset,
                            "scrollbarOffset": scrollx.scroller.offset()[(d == "x") ? "left" : "top"],
                            "scrollbarSize": scrollx.scroller[(d == "x") ? "outerWidth" : "outerHeight"]()
                        };
                        var timeout = 0, timer = 0;

                        if ($(this).hasClass('scroll-arrow')) {
                            scrollForward = $(this).hasClass("scroll-arrow_more") ? 1 : -1;
                            scrollStep = o.scrollStep * scrollForward;
                            scrollToValue = scrollForward > 0 ? data.maxScrollValue : 0;
                        } else {
                            scrollForward = (data.eventOffset > (data.scrollbarOffset + data.scrollbarSize) ? 1
                                : (data.eventOffset < data.scrollbarOffset ? -1 : 0));
                            scrollStep = Math.round(scrollx.visible * 0.75) * scrollForward;
                            scrollToValue = (data.eventOffset - data.scrollbarOffset -
                                (o.stepScrolling ? (scrollForward == 1 ? data.scrollbarSize : 0)
                                    : Math.round(data.scrollbarSize / 2)));
                            scrollToValue = c[scrollOffset]() + (scrollToValue / scrollx.kx);
                        }

                        S.scrollTo = S.scrollTo || {};
                        S.scrollTo[scrollOffset] = o.stepScrolling ? c[scrollOffset]() + scrollStep : scrollToValue;

                        if (o.stepScrolling) {
                            scrollCallback = function () {
                                scrollToValue = c[scrollOffset]();
                                clearInterval(timer);
                                clearTimeout(timeout);
                                timeout = 0;
                                timer = 0;
                            };
                            timeout = setTimeout(function () {
                                timer = setInterval(scrollTo, 40);
                            }, o.duration + 100);
                        }

                        setTimeout(function () {
                            if (S.scrollTo) {
                                c.animate(S.scrollTo, o.duration);
                                S.scrollTo = null;
                            }
                        }, 1);

                        return handleMouseDown(scrollCallback, event);
                    });

                    // handle scrollbar drag'n'drop
                    scrollx.scroller.on("mousedown.scrollbar", function (event) {

                        if (event.which != lmb)
                            return true;

                        var eventPosition = event[(d == "x") ? "pageX" : "pageY"];
                        var initOffset = c[scrollOffset]();

                        scrollx.scrollbar.addClass("scroll-draggable");

                        $(doc).on("mousemove.scrollbar", function (event) {
                            var diff = parseInt((event[(d == "x") ? "pageX" : "pageY"] - eventPosition) / scrollx.kx, 10);
                            c[scrollOffset](initOffset + diff);
                        });

                        return handleMouseDown(function () {
                            scrollx.scrollbar.removeClass("scroll-draggable");
                            scrollToValue = c[scrollOffset]();
                        }, event);
                    });
                }
            });

            // remove classes & reset applied styles
            $.each(s, function (d, scrollx) {
                var scrollClass = "scroll-scroll" + d + "_visible";
                var scrolly = (d == "x") ? s.y : s.x;

                scrollx.scrollbar.removeClass(scrollClass);
                scrolly.scrollbar.removeClass(scrollClass);
                cw.removeClass(scrollClass);
            });

            // calculate init sizes
            $.each(s, function (d, scrollx) {
                $.extend(scrollx, (d == "x") ? {
                    "offset": parseInt(c.css("left"), 10) || 0,
                    "size": c.prop("scrollWidth"),
                    "visible": w.width()
                } : {
                    "offset": parseInt(c.css("top"), 10) || 0,
                    "size": c.prop("scrollHeight"),
                    "visible": w.height()
                });
            });


            var updateScroll = function (d, scrollx) {

                var scrollClass = "scroll-scroll" + d + "_visible";
                var scrolly = (d == "x") ? s.y : s.x;
                var offset = parseInt(c.css((d == "x") ? "left" : "top"), 10) || 0;

                var AreaSize = scrollx.size;
                var AreaVisible = scrollx.visible + offset;

                scrollx.isVisible = (AreaSize - AreaVisible) > 1; // bug in IE9/11 with 1px diff
                if (scrollx.isVisible) {
                    scrollx.scrollbar.addClass(scrollClass);
                    scrolly.scrollbar.addClass(scrollClass);
                    cw.addClass(scrollClass);
                } else {
                    scrollx.scrollbar.removeClass(scrollClass);
                    scrolly.scrollbar.removeClass(scrollClass);
                    cw.removeClass(scrollClass);
                }

                if (d == "y" && (scrollx.isVisible || scrollx.size < scrollx.visible)) {
                    cw.css("height", (AreaVisible + browser.scroll.height) + px);
                }

                if (s.x.size != c.prop("scrollWidth")
                    || s.y.size != c.prop("scrollHeight")
                    || s.x.visible != w.width()
                    || s.y.visible != w.height()
                    || s.x.offset != (parseInt(c.css("left"), 10) || 0)
                    || s.y.offset != (parseInt(c.css("top"), 10) || 0)
                    ) {
                    $.each(s, function (d, scrollx) {
                        $.extend(scrollx, (d == "x") ? {
                            "offset": parseInt(c.css("left"), 10) || 0,
                            "size": c.prop("scrollWidth"),
                            "visible": w.width()
                        } : {
                            "offset": parseInt(c.css("top"), 10) || 0,
                            "size": c.prop("scrollHeight"),
                            "visible": w.height()
                        });
                    });
                    updateScroll(d == "x" ? "y" : "x", scrolly);
                }
            };
            $.each(s, updateScroll);

            if ($.isFunction(o.onUpdate))
                o.onUpdate.apply(this, [c]);

            // calculate scroll size
            $.each(s, function (d, scrollx) {

                var cssOffset = (d == "x") ? "left" : "top";
                var cssFullSize = (d == "x") ? "outerWidth" : "outerHeight";
                var cssSize = (d == "x") ? "width" : "height";
                var offset = parseInt(c.css(cssOffset), 10) || 0;

                var AreaSize = scrollx.size;
                var AreaVisible = scrollx.visible + offset;

                var scrollSize = scrollx.scrollbar.find(".scroll-element_size");
                scrollSize = scrollSize[cssFullSize]() + (parseInt(scrollSize.css(cssOffset), 10) || 0);

                if (o.autoScrollSize) {
                    scrollx.scrollbarSize = parseInt(scrollSize * AreaVisible / AreaSize, 10);
                    scrollx.scroller.css(cssSize, scrollx.scrollbarSize + px);
                }

                scrollx.scrollbarSize = scrollx.scroller[cssFullSize]();
                scrollx.kx = ((scrollSize - scrollx.scrollbarSize) / (AreaSize - AreaVisible)) || 1;
                scrollx.maxScrollOffset = AreaSize - AreaVisible;
            });

            c.scrollLeft(initScroll.scrollLeft).scrollTop(initScroll.scrollTop).trigger("scroll");
        }
    };

    /*
     * Extend jQuery as plugin
     *
     * @param {object|string} options or command to execute
     * @param {object|array} args additional arguments as array []
     */
    $.fn.scrollbar = function (options, args) {

        var toReturn = this;

        if (options === "get")
            toReturn = null;

        this.each(function () {

            var container = $(this);

            if (container.hasClass("scroll-wrapper")
                || container.get(0).nodeName == "body") {
                return true;
            }

            var instance = container.data("scrollbar");
            if (instance) {
                if (options === "get") {
                    toReturn = instance;
                    return false;
                }

                var func = (typeof options == "string" && instance[options]) ? options : "init";
                instance[func].apply(instance, $.isArray(args) ? args : []);

                if (options === "destroy") {
                    container.removeData("scrollbar");
                    while ($.inArray(instance, browser.scrolls) >= 0)
                        browser.scrolls.splice($.inArray(instance, browser.scrolls), 1);
                }
            } else {
                if (typeof options != "string") {
                    instance = new customScrollbar(container, options);
                    container.data("scrollbar", instance);
                    browser.scrolls.push(instance);
                }
            }
            return true;
        });

        return toReturn;
    };

    /**
     * Connect default options to global object
     */
    $.fn.scrollbar.options = defaults;

    /**
     * Extend AngularJS as UI directive
     *
     *
     */
    if (win.angular) {
        (function (angular) {
            var app = angular.module('jQueryScrollbar', []);
            app.directive('jqueryScrollbar', function () {
                return {
                    "link": function (scope, element) {
                        element.scrollbar(scope.options).on('$destroy', function () {
                            element.scrollbar('destroy');
                        });
                    },
                    "restring": "AC",
                    "scope": {
                        "options": "=jqueryScrollbar"
                    }
                };
            });
        })(win.angular);
    }

    /**
     * Check if scroll content/container size is changed
     */
    var timer = 0, timerCounter = 0;
    var updateScrollbars = function (force) {
        var i, c, o, s, w, x, y;
        for (i = 0; i < browser.scrolls.length; i++) {
            s = browser.scrolls[i];
            c = s.container;
            o = s.options;
            w = s.wrapper;
            x = s.scrollx;
            y = s.scrolly;
            if (force || (o.autoUpdate && w && w.is(":visible") &&
                (c.prop("scrollWidth") != x.size
                    || c.prop("scrollHeight") != y.size
                    || w.width() != x.visible
                    || w.height() != y.visible
                    ))) {
                s.init();

                if (debug) {
                    browser.log({
                        "scrollHeight": c.prop("scrollHeight") + ":" + s.scrolly.size,
                        "scrollWidth": c.prop("scrollWidth") + ":" + s.scrollx.size,
                        "visibleHeight": w.height() + ":" + s.scrolly.visible,
                        "visibleWidth": w.width() + ":" + s.scrollx.visible
                    }, true);
                    timerCounter++;
                }
            }
        }
        if (debug && timerCounter > 10) {
            browser.log("Scroll updates exceed 10");
            updateScrollbars = function () { };
        } else {
            clearTimeout(timer);
            timer = setTimeout(updateScrollbars, 300);
        }
    };

    /* ADDITIONAL FUNCTIONS */
    /**
     * Get native browser scrollbar size (height/width)
     *
     * @param {Boolean} actual size or CSS size, default - CSS size
     * @returns {Object} with height, width
     */
    function getBrowserScrollSize(actualSize) {

        if (browser.webkit && !actualSize) {
            return {
                "height": 0,
                "width": 0
            };
        }

        if (!browser.data.outer) {
            var css = {
                "border": "none",
                "box-sizing": "content-box",
                "height": "200px",
                "margin": "0",
                "padding": "0",
                "width": "200px"
            };
            browser.data.inner = $("<div>").css($.extend({}, css));
            browser.data.outer = $("<div>").css($.extend({
                "left": "-1000px",
                "overflow": "scroll",
                "position": "absolute",
                "top": "-1000px"
            }, css)).append(browser.data.inner).appendTo("body");
        }

        browser.data.outer.scrollLeft(1000).scrollTop(1000);

        return {
            "height": Math.ceil((browser.data.outer.offset().top - browser.data.inner.offset().top) || 0),
            "width": Math.ceil((browser.data.outer.offset().left - browser.data.inner.offset().left) || 0)
        };
    }

    function handleMouseDown(callback, event) {
        $(doc).on({
            "blur.scrollbar": function () {
                $(doc).add('body').off('.scrollbar');
                callback && callback();
            },
            "dragstart.scrollbar": function (event) {
                event.preventDefault();
                return false;
            },
            "mouseup.scrollbar": function () {
                $(doc).add('body').off('.scrollbar');
                callback && callback();
            }
        });
        $("body").on({
            "selectstart.scrollbar": function (event) {
                event.preventDefault();
                return false;
            }
        });
        event && event.preventDefault();
        return false;
    }

    /**
     * Check if native browser scrollbars overlay content
     *
     * @returns {Boolean}
     */
    function isScrollOverlaysContent() {
        var scrollSize = getBrowserScrollSize(true);
        return !(scrollSize.height || scrollSize.width);
    }

    function isVerticalScroll(event) {
        var e = event.originalEvent;
        if (e.axis && e.axis === e.HORIZONTAL_AXIS)
            return false;
        if (e.wheelDeltaX)
            return false;
        return true;
    }

})(jQuery, document, window);


var powerbi;
(function (powerbi) {
    var visuals;
    (function (visuals) {
        var HierarchySlicer1458836712039;
        (function (HierarchySlicer1458836712039) {
            var SelectionManager = visuals.utility.SelectionManager;
            var createClassAndSelector = jsCommon.CssConstants.createClassAndSelector;
            var PixelConverter = jsCommon.PixelConverter;
            var TreeViewFactory;
            (function (TreeViewFactory) {
                function createTreeView(options) {
                    return new TreeView(options);
                }
                TreeViewFactory.createTreeView = createTreeView;
            })(TreeViewFactory = HierarchySlicer1458836712039.TreeViewFactory || (HierarchySlicer1458836712039.TreeViewFactory = {}));
            /**
             * A UI Virtualized List, that uses the D3 Enter, Update & Exit pattern to update rows.
             * It can create lists containing either HTML or SVG elements.
             */
            var TreeView = (function () {
                function TreeView(options) {
                    var _this = this;
                    // make a copy of options so that it is not modified later by caller
                    this.options = $.extend(true, {}, options);
                    this.scrollbarInner = options.baseContainer.append("div").classed("scrollbar-inner", true).on("scroll", function () { return _this.renderImpl(_this.options.rowHeight); });
                    this.scrollContainer = this.scrollbarInner.append("div").classed("scrollRegion", true);
                    this.visibleGroupContainer = this.scrollContainer.append("div").classed("visibleGroup", true);
                    var scrollInner = $(this.scrollbarInner.node());
                    scrollInner.scrollbar({ignoreOverlay: false, ignoreMobile: false, onDestroy: function () { return scrollInner.off("scroll");}});
                    $(options.baseContainer.node()).find(".scroll-element").attr("drag-resize-disabled", "true");
                    this.scrollToFrame = this.options.scrollToFrame || this.defaultScrollToFrame;
                    TreeView.SetDefaultOptions(options);
                };
                TreeView.prototype.getContainerHeight = function () {
                    return $(this.options.baseContainer.node()).outerHeight();
                };
                TreeView.SetDefaultOptions = function (options) {
                    options.rowHeight = options.rowHeight || TreeView.defaultRowHeight;
                };
                TreeView.prototype.rowHeight = function (rowHeight) {
                    this.options.rowHeight = Math.ceil(rowHeight); // + 2; // Margin top/bottom
                    return this;
                };
                TreeView.prototype.data = function (data, getDatumIndex, dataReset) {
                    if (dataReset === void 0) { dataReset = false; }
                    this._data = data;
                    this.getDatumIndex = getDatumIndex;
                    this.setTotalRows();
                    if (dataReset)
                        $(this.scrollbarInner.node()).scrollTop(0);
                    this.render();
                    return this;
                };
                TreeView.prototype.viewport = function (viewport) {
                    //this.options.viewport = viewport;
                    this.render();
                    return this;
                };
                TreeView.prototype.empty = function () {
                    this._data = [];
                    this.render();
                };
                TreeView.prototype.render = function () {
                    var _this = this;
                    if (this.renderTimeoutId)
                        window.clearTimeout(this.renderTimeoutId);
                    this.renderTimeoutId = window.setTimeout(function () {
                        _this.getRowHeight().then((function (rowHeight) {
                            _this.renderImpl(rowHeight);
                        }));
                        _this.renderTimeoutId = undefined;
                    }, 0);
                };
                TreeView.prototype.renderImpl = function (rowHeight) {
                    var totalHeight = this.options.scrollEnabled ? Math.max(0, (this._totalRows * rowHeight)) : this.getContainerHeight();
                    this.scrollContainer.style("height", totalHeight + "px").attr("height", totalHeight);
                    this.scrollToFrame(this, true /*loadMoreData*/, this.options.rowHeight || TreeView.defaultRowHeight, this.scrollbarInner.node().scrollTop, this._totalRows, this.visibleGroupContainer, this.options.baseContainer);
                };
                /*
                *  This method is called in order to prevent a bug found in the Interact.js.
                *  The bug is caused when finishing a scroll outside the scroll area.
                *  In that case the Interact doesn"t process a touchcancel event and thinks a touch point still exists.
                *  since the Interact listens on the visualContainer, by stoping the propagation we prevent the bug from taking place.
                */
                TreeView.prototype.stopTouchPropagation = function () {
                    //Stop the propagation only in read mode so the drag won"t be affected.
                    if (this.options.isReadMode()) {
                        if (d3.event.type === "touchstart") {
                            var event_1 = d3.event;
                            //If there is another touch point outside this visual than the event should be propagated.
                            //This way the pinch to zoom will not be affected.
                            if (event_1.touches && event_1.touches.length === 1) {
                                d3.event.stopPropagation();
                            }
                        }
                        if (d3.event.type === "touchmove") {
                            d3.event.stopPropagation();
                        }
                    }
                };
                TreeView.prototype.defaultScrollToFrame = function (treeView, loadMoreData, rowHeight, scrollTop, totalElements, visibleGroupContainer, baseContainer) {
                    var visibleRows = this.getVisibleRows();
                    var scrollPosition = (scrollTop === 0) ? 0 : Math.floor(scrollTop / rowHeight);
                    var transformAttr = visuals.SVGUtil.translateWithPixels(0, scrollPosition * rowHeight);
                    visibleGroupContainer.style({
                        //order matters for proper overriding
                        "transform": function (d) { return transformAttr; },
                        "-webkit-transform": transformAttr
                    });
                    var position0 = Math.max(0, Math.min(scrollPosition, totalElements - visibleRows + 1)), position1 = position0 + visibleRows;
                    this.performScrollToFrame(position0, position1, totalElements, visibleRows, loadMoreData);
                };
                TreeView.prototype.performScrollToFrame = function (position0, position1, totalRows, visibleRows, loadMoreData) {
                    var options = this.options;
                    var visibleGroupContainer = this.visibleGroupContainer;
                    var rowSelection = visibleGroupContainer.selectAll(".row")
                        .data(this._data.slice(position0, Math.min(position1, totalRows)), this.getDatumIndex);
                    rowSelection
                        .enter()
                        .append("div")
                        .classed("row", true)
                        .call((function (d) { return options.enter(d); }));
                    rowSelection.order();
                    var rowUpdateSelection = visibleGroupContainer.selectAll(".row:not(.transitioning)");
                    rowUpdateSelection.call((function (d) { return options.update(d); }));
                    rowSelection
                        .exit()
                        .call((function (d) { return options.exit(d); }))
                        .remove();
                    if (loadMoreData && visibleRows !== totalRows && position1 >= totalRows * TreeView.loadMoreDataThreshold)
                        options.loadMoreData();
                };
                TreeView.prototype.setTotalRows = function () {
                    var data = this._data;
                    this._totalRows = data ? data.length : 0;
                };
                TreeView.prototype.getVisibleRows = function () {
                    var minimumVisibleRows = 1;
                    var options = this.options;
                    var rowHeight = options.rowHeight;
                    var containerHeight = this.getContainerHeight();
                    if (!rowHeight || rowHeight < 1)
                        return minimumVisibleRows;
                    // How many rows of space the viewport can hold (not the number of rows it can display).
                    var viewportRowCount = containerHeight / rowHeight;    
                    if (this.options.scrollEnabled) {
                        // Ceiling the count since we can have items be partially displayed when scrolling.
                        // Add 1 to make sure we always render enough rows to cover the entire viewport (handles when rows are partially visible when scrolling).
                        // Ex. If you have a viewport that can show 280 (viewport height) / 100 (row height) = 2.8 rows, you need to have up to Math.ceil(2.8) + 1 = 4 rows of data to cover the viewport.
                        // If you only had Math.ceil(2.8) = 3 rows of data, and the top rows was 50% visible (scrolled up), you"d only be able to cover .5 + 1 + 1 = 2.5 rows of the viewport.
                        // This makes a gap at the bottom of the treeview.
                        // Add an extra row of data and we can cover .5 + 1 + 1 + 1 = 3.5 rows of the viewport. 3.5 is enough to cover the entire viewport as only 2.8 is needed.
                        // 1 is always added, even if not needed, to keep logic simple. Advanced logic would figure out what % of the top row is visible and use that to add 1 if needed.
                        return Math.min(Math.ceil(viewportRowCount) + 1, this._totalRows) || minimumVisibleRows;
                    }
                    // Floor the count since that"s the maximum number of entire rows we can display without scrolling.
                    return Math.min(Math.floor(viewportRowCount), this._totalRows) || minimumVisibleRows;
                };
                TreeView.prototype.getRowHeight = function () {
                    var deferred = $.Deferred();
                    var treeView = this;
                    var options = treeView.options;
                    if (this.cancelMeasurePass)
                        this.cancelMeasurePass();
                    // if there is no data, resolve and return
                    if (!(this._data && this._data.length && options)) {
                        treeView.rowHeight(TreeView.defaultRowHeight);
                        return deferred.resolve(options.rowHeight).promise();
                    }
                    //render the first item to calculate the row height
                    this.scrollToFrame(this, false /*loadMoreData*/, this.options.rowHeight || TreeView.defaultRowHeight, this.scrollbarInner.node().scrollTop, this._totalRows, this.visibleGroupContainer, this.options.baseContainer);
                    var requestAnimationFrameId = window.requestAnimationFrame((function () {
                        // Measure row height. Take non empty rows to measure the row height because if the first row is empty, it returns incorrect height
                        // which causes scrolling issues. 
                        var rows = treeView.visibleGroupContainer.selectAll(".row").filter((function () { return this.textContent !== ""; }));
                        // For image slicer, the text content will be empty. Hence just select the rows for that and then we use the first row height
                        if (rows.empty()) {
                            rows = treeView.visibleGroupContainer.select(".row");
                        }
                        if (!rows.empty()) {
                            var firstRow = rows.node();
                            // If the container (child) has margins amd the row (parent) doesn"t, the child"s margins will collapse into the parent.
                            // outerHeight doesn"t report the correct height for the parent in this case, but it does measure the child properly.
                            // Fix for #7497261 Measures both and take the max to work around this issue.
                            var rowHeight = Math.max($(firstRow).outerHeight(true), $(firstRow).children().first().outerHeight(true));
                            treeView.rowHeight(rowHeight);
                            deferred.resolve(rowHeight);
                        }
                        treeView.cancelMeasurePass = undefined;
                        window.cancelAnimationFrame(requestAnimationFrameId);
                    }));
                    this.cancelMeasurePass = function () {
                        window.cancelAnimationFrame(requestAnimationFrameId);
                        deferred.reject();
                    };
                    return deferred.promise();
                };
                /**
                 * The value indicates the percentage of data already shown
                 * in the list view that triggers a loadMoreData call.
                 */
                TreeView.loadMoreDataThreshold = 0.8;
                TreeView.defaultRowHeight = 1;
                return TreeView;
            })();
            var HierarchySlicerWebBehavior = (function () {
                function HierarchySlicerWebBehavior() {
                    this.initFilter = true;
                }
                HierarchySlicerWebBehavior.prototype.bindEvents = function (options, selectionHandler) {
                    var _this = this;
                    var expanders = this.expanders = options.expanders;
                    var slicers = this.slicers = options.slicerItemContainers;
                    this.slicerItemLabels = options.slicerItemLabels;
                    this.slicerItemInputs = options.slicerItemInputs;
                    this.dataPoints = options.dataPoints;
                    this.interactivityService = options.interactivityService;
                    this.selectionHandler = selectionHandler;
                    this.settings = options.slicerSettings;
                    this.hostServices = options.hostServices;
                    this.levels = options.levels;
                    this.options = options;
                    var slicerClear = options.slicerClear;
                    var slicerExpand = options.slicerExpand;
                    var slicerCollapse = options.slicerCollapse;
                    if ((this.dataPoints.filter(function (d) { return d.selected; }).length > 0) && this.initFilter) {
                        this.initFilter = false;
                        this.applyFilter();
                    } else {
                        this.renderSelection()
                    }
                    expanders.on("click", function (d, i) {
                        d.isExpand = !d.isExpand;
                        var currentExpander = expanders.filter(function (e, l) { return i === l; });
                        var height = $(currentExpander[0][0].firstChild).height();
                        var width = $(currentExpander[0][0].firstChild).width();
                        var scale = height / 26.0;
                        currentExpander.select(".collapsed").remove();
                        currentExpander.select(".expanded").remove();
                        var container = currentExpander.select(".spinner-icon").style("display", "inline");
                        var margin = _this.settings.slicerText.textSize / 1.25;
                        var spinner = container.append("div").classed("xsmall", true).classed("powerbi-spinner", true).style({
                            "top": "25%",
                            "right": "50%",
                            "transform": "scale("+ scale + ")",
                            "margin": "0px;",
                            "padding-left": "5px;",
                            "display": "block;",
                            "top": "25%",
                            "right": "50%",
                            "margin-top": _this.settings.slicerText.textSize < 12 ? "0px" : margin + "px",
                            "margin-left": _this.settings.slicerText.textSize < 12 ? "0px" : (margin * .6) + "px"
                        }).attr("ng-if", "viewModel.showProgressBar") //.attr("delay", "500")
                            .append("div").classed("spinner", true);
                        for (var i = 0; i < 5; i++) {
                            spinner.append("div").classed("circle", true);
                        }
                        _this.persistExpand(false);
                    }); 
                    slicerCollapse.on("click", function (d) {
                        $(".scrollbar-inner").scrollTop(0);
                        _this.dataPoints.filter(function (d) { return !d.isLeaf; }).forEach(function (d) { return d.isExpand = false; });
                        _this.persistExpand(true);
                    });
                    slicerExpand.on("click", function (d) {
                        _this.dataPoints.filter(function (d) { return !d.isLeaf; }).forEach(function (d) { return d.isExpand = true; });
                        _this.persistExpand(true);
                    });
                    options.slicerContainer.classed("hasSelection", true);
                    slicers.on("mouseover", function (d) {
                        if (d.selectable) {
                            d.mouseOver = true;
                            d.mouseOut = false;
                            _this.renderMouseover();
                        }
                    });
                    slicers.on("mouseout", function (d) {
                        if (d.selectable) {
                            d.mouseOver = false;
                            d.mouseOut = true;
                            _this.renderMouseover();
                        }
                    });
                    slicers.on("click", function (d, index) {
                        if (!d.selectable) {
                            return;
                        }
                        var selected = d.partialSelected ? !d.selected : d.selected;
                        if (d.ownId==="selectAll") {
                            _this.dataPoints.forEach(function(dp) { dp.selected = !selected; });
                            d.selected =  !selected;
                            _this.applyFilter();
                            return
                        }
                        var settings = _this.settings;
                        d3.event.preventDefault();
                        if (!settings.general.singleselect) {
                            d.selected = !selected; // Toggle selection
                            if (!selected) {
                                var selectDataPoints = _this.dataPoints.filter(function (dp) { return dp.parentId.indexOf(d.ownId) >= 0; });
                                for (var i = 0; i < selectDataPoints.length; i++) {
                                    if (selected === selectDataPoints[i].selected) {
                                        selectDataPoints[i].selected = !selected;
                                    }
                                }
                                selectDataPoints = _this.getParentDataPoints(_this.dataPoints, d.parentId);
                                for (var i = 0; i < selectDataPoints.length; i++) {
                                    if (!selected && !selectDataPoints[i].selected) {
                                        selectDataPoints[i].selected = !selected;
                                    }
                                    else if (selected && (_this.dataPoints.filter(function (dp) { return dp.selected && dp.level === d.level && dp.parentId === d.parentId; }).length === 0)) {
                                        selectDataPoints[i].selected = !selected;
                                    }
                                }
                            } else if (!d.isLeaf) {
                                var selectDataPoints = _this.dataPoints.filter(function (dp) { return dp.parentId.indexOf(d.ownId) >= 0; });
                                for (var i = 0; i < selectDataPoints.length; i++) {
                                    if (selected === selectDataPoints[i].selected) {
                                        selectDataPoints[i].selected = !selected;
                                    }
                                }
                            }
                            if (_this.dataPoints.filter(function(dp) { return (dp.parentId === d.parentId) && dp.selected }).length===0) { // Last Child Standing
                                var p = _this.dataPoints.filter(function(dp) { return dp.ownId === d.parentId })[0];
                                if (p) {
                                    p.selected = !selected;
                                    var parentId = p.parentId;
                                    for(var i = d.level-1; i > 0; i--) {
                                        var p = _this.dataPoints.filter(function(dp) { return dp.ownId === parentId })[0];
                                        if (_this.dataPoints.filter(function(dp) { return (dp.parentId === p.ownId) && dp.selected }).length===0) {
                                            p.selected = !selected;
                                        }
                                        parentId = p.parentId;
                                    }
                                }
                            }
                        }
                        else {
                            _this.dataPoints.forEach(function(dp) { dp.selected = false; } );
                            d.selected = !selected;
                            if (!selected) {
                                var selectDataPoints = [d]; //Self
                                selectDataPoints = selectDataPoints.concat(_this.dataPoints.filter(function (dp) { return dp.parentId.indexOf(d.ownId) >= 0; })); // Children
                                selectDataPoints = selectDataPoints.concat(_this.getParentDataPoints(_this.dataPoints, d.parentId)); // Parents
                                if (selectDataPoints) {
                                    for (var i = 0; i < selectDataPoints.length; i++) {
                                        selectDataPoints[i].selected = true;
                                    }
                                }
                            } else if (_this.dataPoints.filter(function(dp) { return (dp.parentId === d.parentId) && dp.selected }).length===0) { // Last Child Standing
                                var p = _this.dataPoints.filter(function(dp) { return dp.ownId === d.parentId })[0];
                                if (p) { // Not parent level
                                    p.selected = !selected;
                                    var parentId = p.parentId;
                                    for(var i = d.level-1; i > 0; i--) {
                                        var p = _this.dataPoints.filter(function(dp) { return dp.ownId === parentId })[0];
                                        if (_this.dataPoints.filter(function(dp) { return (dp.parentId === p.ownId) && dp.selected }).length===0) {
                                            p.selected = !selected;
                                        }
                                        parentId = p.parentId;
                                    }
                                }
                            }
                        }
                        _this.applyFilter();
                    });
                    slicerClear.on("click", function (d) {
                        _this.selectionHandler.handleClearSelection();
                        _this.persistFilter(null);
                    });
                };
                HierarchySlicerWebBehavior.prototype.renderMouseover = function () {
                    var _this = this;
                    this.slicerItemLabels.style({
                        "color": function (d) {
                            if (d.mouseOver)
                                return _this.settings.slicerText.hoverColor;
                            else if (d.mouseOut) {
                                if (d.selected)
                                    return _this.settings.slicerText.selectedColor;
                                else
                                    return _this.settings.slicerText.fontColor;
                            }
                            else
                                return _this.settings.slicerText.fontColor; //fallback
                        }
                    });
                    this.slicerItemInputs.selectAll("span").style({
                        "border-color": function (d) {
                            if (d.mouseOver)
                                return _this.settings.slicerText.hoverColor;
                            else if (d.mouseOut) {
                                if (d.selected)
                                    return _this.settings.slicerText.selectedColor;
                                else
                                    return _this.settings.slicerText.fontColor;
                            }
                            else
                                return _this.settings.slicerText.fontColor; //fallback
                        }
                    });
                    this.expanders.style({
                        "color": function (d) {
                            if (d.mouseOver)
                                return _this.settings.slicerText.hoverColor;
                            else if (d.mouseOut) {
                                if (d.selected)
                                    return _this.settings.slicerText.selectedColor;
                                else
                                    return _this.settings.slicerText.fontColor;
                            }
                            else
                                return _this.settings.slicerText.fontColor; //fallback
                        }
                    });
                };
                HierarchySlicerWebBehavior.prototype.renderSelection = function (hasSelection) {
                    if (!hasSelection && !this.interactivityService.isSelectionModeInverted()) {
                        this.slicerItemInputs.filter(".selected").classed("selected", false);
                        this.slicerItemInputs.filter(".partiallySelected").classed("partiallySelected", false);
                        var input = this.slicerItemInputs.selectAll("input");
                        if (input) {
                            input.property("checked", false);
                        }
                    }
                    else {
                        this.styleSlicerInputs(this.slicers, hasSelection);
                    }
                };
                HierarchySlicerWebBehavior.prototype.styleSlicerInputs = function (slicers, hasSelection) {
                    var _this = this;
                    slicers.each(function (d, i) {
                        var slicerItem = this.getElementsByTagName("div")[0];
                        var shouldCheck = d.selected;
                        var partialCheck = d.partialSelected;
                        var input = slicerItem.getElementsByTagName("input")[0];
                        if (input)
                            input.checked = shouldCheck;
                        if (shouldCheck && partialCheck) {
                            slicerItem.classList.remove("selected");
                            slicerItem.classList.add("partiallySelected");
                            //slicerItem.getElementsByTagName("span")[0].style.background = _this.settings.slicerText.selectedColor;
                        } else if (shouldCheck && (!partialCheck)){
                            slicerItem.classList.remove("partiallySelected");
                            slicerItem.classList.add("selected");
                            //slicerItem.getElementsByTagName("span")[0].style.background = _this.settings.slicerText.selectedColor;
                        } else
                            slicerItem.classList.remove("selected");
                        var slicerSpan = slicerItem.getElementsByTagName("span")[0];
                        slicerSpan.style.borderColor = d.selected ? _this.settings.slicerText.selectedColor : _this.settings.slicerText.fontColor;
                        slicerSpan.style.backgroundColor = d.selected ? _this.settings.slicerText.selectedColor : "transparent";
                        _this.slicerItemLabels[0][i].style.color = d.selected ? _this.settings.slicerText.selectedColor : _this.settings.slicerText.fontColor;                                                
                    });
                };
                HierarchySlicerWebBehavior.prototype.applyFilter = function () {
                    if (this.dataPoints.length === 0) {
                        return;
                    }
                    var selectNrValues = 0;
                    var filter;
                    var rootLevels = this.dataPoints.filter(function (d) { return d.level === 0 && d.selected && d.ownId !== "selectAll"; });
                    if (!rootLevels || (rootLevels.length === 0)) {
                        this.selectionHandler.handleClearSelection();
                        this.persistFilter(null);
                    }
                    else {
                        selectNrValues++;
                        var children = this.getChildFilters(this.dataPoints, rootLevels[0].ownId, 1);
                        var rootFilters = [];
                        if (children) {
                            rootFilters.push(powerbi.data.SQExprBuilder.and(rootLevels[0].id, children.filters));
                            selectNrValues += children.memberCount;
                        }
                        else {
                            rootFilters.push(rootLevels[0].id);
                        }
                        if (rootLevels.length > 1) {
                            for (var i = 1; i < rootLevels.length; i++) {
                                selectNrValues++;
                                children = this.getChildFilters(this.dataPoints, rootLevels[i].ownId, 1);
                                if (children) {
                                    rootFilters.push(powerbi.data.SQExprBuilder.and(rootLevels[i].id, children.filters));
                                    selectNrValues += children.memberCount;
                                }
                                else {
                                    rootFilters.push(rootLevels[i].id);
                                }
                            }
                        }
                        var rootFilter = rootFilters[0];
                        for (var i = 1; i < rootFilters.length; i++) {
                            rootFilter = powerbi.data.SQExprBuilder.or(rootFilter, rootFilters[i]);
                        }
                        if (selectNrValues > 120) {
                        }
                        filter = powerbi.data.SemanticFilter.fromSQExpr(rootFilter);
                        this.persistFilter(filter);
                    }
                };
                HierarchySlicerWebBehavior.prototype.getParentDataPoints = function (dataPoints, parentId) {
                    var parent = dataPoints.filter(function (d) { return d.ownId === parentId; });
                    if (!parent || (parent.length === 0)) {
                        return [];
                    }
                    else if (parent[0].level === 0) {
                        return parent;
                    }
                    else {
                        var returnParents = [];
                        returnParents = returnParents.concat(parent, this.getParentDataPoints(dataPoints, parent[0].parentId));
                        return returnParents;
                    }
                };
                HierarchySlicerWebBehavior.prototype.getChildFilters = function (dataPoints, parentId, level) {
                    var memberCount = 0;
                    var childFilters = dataPoints.filter(function (d) { return d.level === level && d.parentId === parentId && d.selected; });
                    var totalChildren = dataPoints.filter(function (d) { return d.level === level && d.parentId === parentId; }).length;
                    if (!childFilters || (childFilters.length === 0)) {
                        return;
                    }
                    else if (childFilters[0].isLeaf) {
                        if ((totalChildren !== childFilters.length) || this.options.slicerSettings.general.selfFilterEnabled) {
                            var returnFilter = childFilters[0].id;
                            memberCount += childFilters.length;
                            if (childFilters.length > 1) {
                                for (var i = 1; i < childFilters.length; i++) {
                                    returnFilter = powerbi.data.SQExprBuilder.or(returnFilter, childFilters[i].id);
                                }
                            }
                            return {
                                filters: returnFilter,
                                memberCount: memberCount,
                            };
                        }
                        else {
                            return;
                        }
                    }
                    else {
                        var returnFilter;
                        var allSelected = (totalChildren === childFilters.length);
                        memberCount += childFilters.length;
                        for (var i = 0; i < childFilters.length; i++) {
                            var childChildFilter = this.getChildFilters(dataPoints, childFilters[i].ownId, level + 1);
                            if ((childChildFilter) || this.options.slicerSettings.general.selfFilterEnabled) {
                                allSelected = false;
                                memberCount += childChildFilter.memberCount;
                                if (returnFilter) {
                                    returnFilter = powerbi.data.SQExprBuilder.or(returnFilter, powerbi.data.SQExprBuilder.and(childFilters[i].id, childChildFilter.filters));
                                }
                                else {
                                    returnFilter = powerbi.data.SQExprBuilder.and(childFilters[i].id, childChildFilter.filters);
                                }
                            }
                            else {
                                if (returnFilter) {
                                    returnFilter = powerbi.data.SQExprBuilder.or(returnFilter, childFilters[i].id);
                                }
                                else {
                                    returnFilter = childFilters[i].id;
                                }
                            }
                        }
                        return allSelected ? undefined : {
                            filters: returnFilter,
                            memberCount: memberCount,
                        };
                    }
                };
                HierarchySlicerWebBehavior.prototype.persistFilter = function (filter) {
                    var properties = {};
                    if (filter) {
                        properties[HierarchySlicer1458836712039.hierarchySlicerProperties.filterPropertyIdentifier.propertyName] = filter;
                    }
                    else {
                        properties[HierarchySlicer1458836712039.hierarchySlicerProperties.filterPropertyIdentifier.propertyName] = "";
                    }
                    var filterValues = this.dataPoints.filter(function (d) { return d.selected; }).map(function (d) { return d.ownId; }).join(",");
                    if (filterValues) {
                        properties[HierarchySlicer1458836712039.hierarchySlicerProperties.filterValuePropertyIdentifier.propertyName] = filterValues;
                    }
                    else {
                        properties[HierarchySlicer1458836712039.hierarchySlicerProperties.filterValuePropertyIdentifier.propertyName] = "";
                    }
                    var objects = {
                        merge: [
                            {
                                objectName: HierarchySlicer1458836712039.hierarchySlicerProperties.filterPropertyIdentifier.objectName,
                                selector: undefined,
                                properties: properties,
                            }
                        ]
                    };
                    this.hostServices.persistProperties(objects);
                    this.hostServices.onSelect({ data: [] });
                };
                HierarchySlicerWebBehavior.prototype.persistExpand = function (updateScrollbar) {
                    var properties = {};
                    properties[HierarchySlicer1458836712039.hierarchySlicerProperties.expandedValuePropertyIdentifier.propertyName] = this.dataPoints.filter(function (d) { return d.isExpand; }).map(function (d) { return d.ownId; }).join(",");
                    var objects = {
                        merge: [
                            {
                                objectName: HierarchySlicer1458836712039.hierarchySlicerProperties.expandedValuePropertyIdentifier.objectName,
                                selector: undefined,
                                properties: properties,
                            }
                        ]
                    };
                    this.hostServices.persistProperties(objects);
                    this.hostServices.onSelect({ data: [] });
                };
                return HierarchySlicerWebBehavior;
            })();
            HierarchySlicer1458836712039.HierarchySlicerWebBehavior = HierarchySlicerWebBehavior;
            HierarchySlicer1458836712039.hierarchySlicerProperties = {
                selection: {
                    singleselect: { objectName: "selection", propertyName: "singleSelect" },
                    emptyLeafs: { objectName: "selection", propertyName: "emptyLeafs" },
                    selectAll: { objectName: "selection", propertyName: "selectAll" },
                    selectAllLabel: { objectName: "selection", propertyName: "selectAllLabel" },
                },
                header: {
                    show: { objectName: "header", propertyName: "show" },
                    title: { objectName: "header", propertyName: "title" },
                    fontColor: { objectName: "header", propertyName: "fontColor" },
                    background: { objectName: "header", propertyName: "background" },
                    textSize: { objectName: "header", propertyName: "textSize" },
                },
                items: {
                    fontColor: { objectName: "items", propertyName: "fontColor" },
                    selectedColor: { objectName: "items", propertyName: "selectedColor" },
                    background: { objectName: "items", propertyName: "background" },
                    hoverColor: { objectName: "items", propertyName: "hoverColor" },
                    textSize: { objectName: "items", propertyName: "textSize" },
                },
                selectedPropertyIdentifier: { objectName: "general", propertyName: "selected" },
                expandedValuePropertyIdentifier: { objectName: "general", propertyName: "expanded" },
                filterPropertyIdentifier: { objectName: "general", propertyName: "filter" },
                filterValuePropertyIdentifier: { objectName: "general", propertyName: "filterValues" },
                defaultValue: { objectName: "general", propertyName: "defaultValue" },
                selfFilterEnabled: { objectName: "general", propertyName: "selfFilterEnabled" },
                // store version
                version: { objectName: "general", propertyName: "version" },
            };
            var HierarchySlicer = (function () {
                function HierarchySlicer(options) {
                    this.IconSet = {
                        expandAll: "<svg  width=\"100%\" height=\"100%\" viewBox=\"0 0 24 24\"><path d=\"M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z\"/><path d=\"M0 0h24v24H0z\" fill=\"none\"/></svg>",
                        collapseAll: "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 24 24\"><path d=\"M19 13H5v-2h14v2z\"/><path d=\"M0 0h24v24H0z\" fill=\"none\"/></svg>",
                        clearAll: "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 24 24\"><path d=\"M5 13h14v-2H5v2zm-2 4h14v-2H3v2zM7 7v2h14V7H7z\"/><path d=\"M0 0h24v24H0z\" fill=\"none\"/></svg>",
                        expand: "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 24 24\"><path d=\"M7 10l5 5 5-5z\"/><path d=\"M0 0h24v24H0z\" fill=\"none\"/></svg>",
                        checkboxTick: "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 1 1\"><path d=\"M 0.04038059,0.6267767 0.14644661,0.52071068 0.42928932,0.80355339 0.3232233,0.90961941 z M 0.21715729,0.80355339 0.85355339,0.16715729 0.95961941,0.2732233 0.3232233,0.90961941 z\" style=\"fill:#ffffff;fill-opacity:1;stroke:none\" /></svg>"
                    };
                    if (options) {
                        if (options.margin) {
                            this.margin = options.margin;
                        }
                        if (options.behavior) {
                            this.behavior = options.behavior;
                        }
                    }
                    if (!this.behavior) {
                        this.behavior = new HierarchySlicerWebBehavior();
                    }
                }
                HierarchySlicer.DefaultSlicerSettings = function () {
                    return {
                        general: {
                            rows: 0,
                            singleselect: true,
                            showDisabled: "",
                            outlineColor: "#808080",
                            outlineWeight: 1,
                            selfFilterEnabled: false,
                            version: 801,
                            emptyLeafs: true,
                            selectAll: false,
                            selectAllLabel: "Select All"
                        },
                        margin: {
                            top: 50,
                            bottom: 50,
                            right: 50,
                            left: 50
                        },
                        header: {
                            borderBottomWidth: 1,
                            show: true,
                            outline: "BottomOnly",
                            fontColor: "#666666",
                            background: undefined,
                            textSize: 10,
                            outlineColor: "#a6a6a6",
                            outlineWeight: 1,
                            title: "",
                        },
                        headerText: {
                            marginLeft: 8,
                            marginTop: 0
                        },
                        slicerText: {
                            textSize: 10,
                            height: 18,
                            width: 0,
                            fontColor: "#808080",
                            hoverColor: "#666666",
                            selectedColor: "#212121",
                            unselectedColor: "#ffffff",
                            disabledColor: "grey",
                            marginLeft: 8,
                            outline: "Frame",
                            background: undefined,
                            transparency: 0,
                            outlineColor: "#000000",
                            outlineWeight: 1,
                            borderStyle: "Cut",
                        },
                        slicerItemContainer: {
                            // The margin is assigned in the less file. This is needed for the height calculations.
                            marginTop: 5,
                            marginLeft: 0,
                        },
                    };
                };
                HierarchySlicer.prototype.converter = function (dataView, searchText) {
                    if (!dataView || !dataView.table || !dataView.table.rows || !(dataView.table.rows.length > 0) || !dataView.table.columns || !(dataView.table.columns.length > 0)) {
                        return {
                            dataPoints: [],
                            settings: null,
                            levels: null,
                        };
                    }
                    var rows = dataView.table.rows;
                    var hierarchyRows = dataView.metadata.columns.filter(function(d) { return d.roles.Fields}).length // Filter out 'Values' level
                    var columns = dataView.table.columns;
                    var levels = hierarchyRows - 1;
                    var dataPoints = [];
                    var defaultSettings = HierarchySlicer.DefaultSlicerSettings();
                    var identityValues = [];
                    var selectedIds = [];
                    var expandedIds = [];
                    var selectionFilter;
                    var order = 0;
                    var objects = dataView.metadata.objects;
                    var isRagged = false;
                    var raggedParents = [];
                    defaultSettings.general.singleselect = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.singleselect, defaultSettings.general.singleselect);
                    defaultSettings.general.emptyLeafs = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.emptyLeafs, defaultSettings.general.emptyLeafs);
                    var selectAll = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.selectAll, defaultSettings.general.selectAll);
                    var selectAllLabel = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.selectAllLabel, defaultSettings.general.selectAllLabel);
                    defaultSettings.general.selectAll = selectAll;
                    defaultSettings.general.selectAllLabel = selectAllLabel;
                    defaultSettings.header.title = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.title, dataView.metadata.columns[0].displayName);
                    selectedIds = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.filterValuePropertyIdentifier, "").split(",");
                    expandedIds = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.expandedValuePropertyIdentifier, "").split(",");
                    defaultSettings.general.selfFilterEnabled = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selfFilterEnabled, defaultSettings.general.selfFilterEnabled);
                    if (selectAll) {
                        dataPoints.push({
                            identity: null,
                            selected: false,
                            value: selectAllLabel,
                            tooltip: selectAllLabel,
                            level: 0,
                            selectable: true,
                            partialSelected: false,
                            isLeaf: true,
                            isExpand: false,
                            isHidden: false,
                            id: "selectAll",
                            ownId: "selectAll",
                            parentId: "none",
                            order: order++,
                        });
                    }
                    for (var r = 0; r < rows.length; r++) {
                        var parentExpr = null;
                        var parentId = "";
                        for (var c = 0; c < hierarchyRows; c++) {
                            if ((rows[r][c] === null) && (!defaultSettings.general.emptyLeafs)) {
                                isRagged = true;
                                raggedParents.push(parentId);
                                break;
                            }
                            var format = dataView.table.columns[c].format;
                            var dataType = dataView.table.columns[c].type;
                            var labelValue = visuals.valueFormatter.format(rows[r][c], format);
                            labelValue = labelValue === null ? "(blank)" : labelValue;
                            var value;
                            if (rows[r][c] === null) {
                                value = powerbi.data.SQExprBuilder.nullConstant();
                            }
                            else {
                                if (dataType.text) {
                                    value = powerbi.data.SQExprBuilder.text(rows[r][c]);
                                }
                                else if (dataType.integer) {
                                    value = powerbi.data.SQExprBuilder.integer(rows[r][c]);
                                }
                                else if (dataType.numeric) {
                                    value = powerbi.data.SQExprBuilder.double(rows[r][c]);
                                }
                                else if (dataType.bool) {
                                    value = powerbi.data.SQExprBuilder.boolean(rows[r][c]);
                                }
                                else if (dataType.dateTime) {
                                    value = powerbi.data.SQExprBuilder.dateTime(rows[r][c]);
                                }
                                else {
                                    value = powerbi.data.SQExprBuilder.text(rows[r][c]);
                                }
                            }
                            var filterExpr = powerbi.data.SQExprBuilder.compare(0, dataView.table.columns[c].expr ? dataView.table.columns[c].expr : dataView.categorical.categories[0].identityFields[c], value);
                            if (c > 0) {
                                parentExpr = powerbi.data.SQExprBuilder.and(parentExpr, filterExpr);
                            }
                            else {
                                parentId = "";
                                parentExpr = filterExpr;
                            }
                            var ownId = parentId + (parentId === "" ? "" : "_") + labelValue.replace(/,/g, "") + "-" + c;
                            var isLeaf = c === hierarchyRows - 1;
                            var dataPoint = {
                                identity: null,
                                selected: selectedIds.filter(function (d) { return d === ownId; }).length > 0,
                                value: labelValue,
                                tooltip: labelValue,
                                level: c,
                                selectable: true,
                                partialSelected: false,
                                isLeaf: isLeaf,
                                isExpand: expandedIds === [] ? false : expandedIds.filter(function (d) { return d === ownId; }).length > 0 || false,
                                isHidden: c === 0 ? false : true,
                                id: filterExpr,
                                ownId: ownId,
                                parentId: parentId,
                                order: order++,
                            };
                            parentId = ownId;
                            if (identityValues.indexOf(ownId) === -1) {
                                identityValues.push(ownId);
                                dataPoints.push(dataPoint);
                            }
                        }
                    }

                    if (isRagged) {
                        dataPoints.filter(function (d) { raggedParents.filter(function (d1) { d1 === d.ownId }).length > 0 }).forEach(function (d) { d.isLeaf = true });
                    }

                    if (defaultSettings.general.selfFilterEnabled && searchText) {
                        searchText = searchText.toLowerCase();
                        var filteredDataPoints = dataPoints.filter(function (d) { return d.value.toLowerCase().indexOf(searchText) >= 0; });
                        var unique = {};
                        for (var i in filteredDataPoints) {
                            unique[filteredDataPoints[i].ownId] = 0;
                        }
                        for (var l = levels; l >= 1; l--) {
                            var levelDataPoints = filteredDataPoints.filter(function (d) { return d.level === l; });
                            var missingParents = {};
                            for (var i in levelDataPoints) {
                                if (typeof (unique[levelDataPoints[i].parentId]) == "undefined") {
                                    missingParents[levelDataPoints[i].parentId] = 0;
                                }
                                unique[levelDataPoints[i].parentId] = 0;
                            }
                            for (var mp in missingParents) {
                                filteredDataPoints.push(dataPoints.filter(function (d) { return d.ownId === mp; })[0]);
                            }
                        }
                        dataPoints = filteredDataPoints.filter(function (value, index, self) { return self.indexOf(value) === index; }).sort(function (d1, d2) { return d1.order - d2.order; }); // set new dataPoints based on the searchText
                        var parent = {};
                        for (var dp in dataPoints) {
                            if (typeof (parent[dataPoints[dp].parentId]) == "undefined") {
                                parent[dataPoints[dp].parentId] = 0;
                            }
                        }
                        dataPoints.map(function (d) { return d.isLeaf = parent[d.ownId] !== 0; });
                        // Add
                        var leafs = dataPoints.filter(function(d) { return d.isLeaf });
                    } else {
                        dataPoints = dataPoints.sort(function (d1, d2) { return d1.order - d2.order; });
                    }
                    // Set isHidden property
                    var parentRootNodes = [];
                    var parentRootNodesTemp = [];
                    var parentRootNodesTotal = [];
                    for (var l = 0; l < levels; l++) {
                        var expandedRootNodes = dataPoints.filter(function (d) { return d.isExpand && d.level === l; });
                        if (expandedRootNodes.length > 0) {
                            for (var n = 0; n < expandedRootNodes.length; n++) {
                                parentRootNodesTemp = parentRootNodes.filter(function (p) { return expandedRootNodes[n].parentId === p.ownId; }); //Is parent expanded?                        
                                if (l === 0 || (parentRootNodesTemp.length > 0)) {
                                    parentRootNodesTotal = parentRootNodesTotal.concat(expandedRootNodes[n]);
                                    dataPoints.filter(function (d) { return d.parentId === expandedRootNodes[n].ownId && d.level === l + 1; }).forEach(function (d) { return d.isHidden = false; });
                                }
                            }
                        }
                        parentRootNodes = parentRootNodesTotal;
                    }
                    // Determine partiallySelected
                    for (var l = levels-1; l >= 0; l--) {
                        var selectedRootNodes = dataPoints.filter(function(d) { return d.selected && d.level === l; });
                        if (selectedRootNodes.length > 0) {
                            for (var n = 0; n < selectedRootNodes.length; n++) {
                                var children = dataPoints.filter(function(d) { return d.parentId === selectedRootNodes[n].ownId; })
                                if (children.length > children.filter(function(d) { return d.selected && !d.partialSelected; }).length) {
                                    selectedRootNodes[n].partialSelected = true;
                                }
                            }
                        }
                    }
                    // Select All level
                    if (selectAll) {
                        var selected = dataPoints.filter(function(d) { return d.selected }).length
                        dataPoints[0].selected = selected > 0 ? true : false;
                        dataPoints[0].partialSelected = (selected===0) || dataPoints.filter(function(d) { return d.selected }).length === dataPoints.length ? false : true;
                    }
                    return {
                        dataPoints: dataPoints,
                        settings: defaultSettings,
                        levels: levels,
                        hasSelectionOverride: true,
                    };
                };
                HierarchySlicer.prototype.init = function (options) {
                    var headerButtonData = [
                        { title: "Clear", class: HierarchySlicer.Clear.class, icon: this.IconSet.clearAll },
                        { title: "Expand all", class: HierarchySlicer.Expand.class, icon: this.IconSet.expandAll },
                        { title: "Collapse all", class: HierarchySlicer.Collapse.class, icon: this.IconSet.collapseAll }
                    ];
                    var _this = this;
                    var hostServices = this.hostServices = options.host;
                    this.element = options.element;
                    this.viewport = options.viewport;
                    this.hostServices = options.host;
                    this.hostServices.canSelect = function () { return true; };
                    this.settings = HierarchySlicer.DefaultSlicerSettings();
                    this.selectionManager = new SelectionManager({ hostServices: options.host });
                    this.selectionManager.clear();
                    if (this.behavior)
                        this.interactivityService = visuals.createInteractivityService(hostServices);
                    this.slicerContainer = d3.select(this.element.get(0)).append("div").classed(HierarchySlicer.Container.class, true);
                    this.slicerHeaderContainer = this.slicerContainer.append("div").classed(HierarchySlicer.HeaderContainer.class, true);
                    this.slicerHeader = this.slicerHeaderContainer.append("div").classed(HierarchySlicer.Header.class, true);
                    this.slicerHeader
                        .selectAll(HierarchySlicer.Icon.class)
                        .data(headerButtonData)
                        .enter()
                        .append("div")
                        .classed(HierarchySlicer.Icon.class, true)
                        .attr("title", function (d) { return d.title; })
                        .each(function (d) { this.classList.add(d.class); })
                        .on("mouseover", function (d) { d3.select(this).style("color", _this.settings.slicerText.hoverColor); })
                        .on("mouseout", function (d) { d3.select(this).style("color", _this.settings.slicerText.fontColor); })
                        .html(function (d) { return d.icon; });
                    this.slicerHeader.append("div").classed(HierarchySlicer.HeaderText.class, true);
                    this.createSearchHeader($(this.slicerHeaderContainer.node()));
                    this.slicerBody = this.slicerContainer.append("div").classed(HierarchySlicer.Body.class, true).style({
                        "height": PixelConverter.toString(this.viewport.height),
                        "width": PixelConverter.toString(this.viewport.width),
                    });
                    var rowEnter = function (rowSelection) {
                        _this.onEnterSelection(rowSelection);
                    };
                    var rowUpdate = function (rowSelection) {
                        _this.onUpdateSelection(rowSelection, _this.interactivityService);
                    };
                    var rowExit = function (rowSelection) {
                        rowSelection.remove();
                    };
                    var treeViewOptions = {
                        rowHeight: this.getRowHeight(),
                        enter: rowEnter,
                        exit: rowExit,
                        update: rowUpdate,
                        loadMoreData: function () { return _this.onLoadMoreData(); },
                        scrollEnabled: true,
                        viewport: this.getBodyViewport(this.viewport),
                        baseContainer: this.slicerBody,
                        isReadMode: function () {
                            return (_this.hostServices.getViewMode() !== powerbi.ViewMode.Edit);
                        },
                        scrollToFrame: undefined
                    };
                    this.treeView = TreeViewFactory.createTreeView(treeViewOptions);
                };
                HierarchySlicer.prototype.update = function (options) {
                    this.viewport = options.viewport;
                    this.dataView = options.dataViews ? options.dataViews[0] : undefined;
                    if (options.viewport.height === this.viewport.height && options.viewport.width === this.viewport.width) {
                        this.waitingForData = false;
                    }
                    this.updateInternal(false);
                };
                HierarchySlicer.prototype.onDataChanged = function (options) {
                    var dataViews = options.dataViews;
                    if (_.isEmpty(dataViews)) {
                        return;
                    }
                    var existingDataView = this.dataView;
                    this.dataView = dataViews[0];
                    var resetScrollbarPosition = options.operationKind !== powerbi.VisualDataChangeOperationKind.Append && !powerbi.DataViewAnalysis.hasSameCategoryIdentity(existingDataView, this.dataView);
                    this.updateInternal(resetScrollbarPosition);
                };
                HierarchySlicer.prototype.onResizing = function (viewPort) {
                    this.viewport = viewPort;
                    this.updateInternal(false);
                };
                HierarchySlicer.prototype.updateInternal = function (resetScrollbar) {
                    var dataView = this.dataView, data = this.data = this.converter(dataView, this.searchInput.val());
                    this.settings = this.data.settings;

                    this.updateSlicerBodyDimensions();
                    this.maxLevels = this.data.levels + 1;
                    if (data.dataPoints.length === 0) {
                        this.treeView.empty();
                        return;
                    }
                    
                    this.updateSettings();
                    this.treeView.viewport(this.getBodyViewport(this.viewport)).rowHeight(this.getRowHeight()).data(data.dataPoints.filter(function (d) { return !d.isHidden; }), function (d) { return $.inArray(d, data.dataPoints); }, resetScrollbar).render();
                    this.updateSearchHeader();
                };
                HierarchySlicer.prototype.updateSettings = function () {
                    this.updateSelectionStyle();
                    this.updateFontStyle();
                    this.updateHeaderStyle();
                };
                HierarchySlicer.prototype.updateSelectionStyle = function () {
                    var objects = this.dataView && this.dataView.metadata && this.dataView.metadata.objects;
                    if (objects) {
                        this.slicerContainer.classed("isMultiSelectEnabled", !powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.singleselect, this.settings.general.singleselect));
                    }
                };
                HierarchySlicer.prototype.updateFontStyle = function () {
                    var objects = this.dataView && this.dataView.metadata && this.dataView.metadata.objects;
                    if (objects) {
                        this.settings.slicerText.fontColor = powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.fontColor, this.settings.slicerText.fontColor);
                        this.settings.slicerText.selectedColor = powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.selectedColor, this.settings.slicerText.selectedColor);
                        this.settings.slicerText.background = powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.background, this.settings.slicerText.background);
                        this.settings.slicerText.hoverColor = powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.hoverColor, this.settings.slicerText.hoverColor);
                        this.settings.slicerText.textSize = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.textSize, this.settings.slicerText.textSize);
                    }
                };
                HierarchySlicer.prototype.updateHeaderStyle = function () {
                    var objects = this.dataView && this.dataView.metadata && this.dataView.metadata.objects;
                    if (objects) {
                        this.settings.header.show = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.show, this.settings.header.show);
                        this.settings.header.fontColor = powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.fontColor, this.settings.header.fontColor);
                        this.settings.header.background = powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.background, this.settings.header.background);
                        this.settings.header.textSize = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.textSize, this.settings.header.textSize);
                    }
                };
                HierarchySlicer.prototype.updateSlicerBodyDimensions = function () {
                    var slicerViewport = this.getBodyViewport(this.viewport);
                    this.slicerBody.style({
                        "height": PixelConverter.toString(slicerViewport.height),
                        "width": "100%",
                    });
                };
                HierarchySlicer.prototype.onEnterSelection = function (rowSelection) {
                    var _this = this;
                    var settings = this.settings;
                    if (!settings) {
                        return
                    }
                    var treeItemElementParent = rowSelection
                        .selectAll("li")
                        .data(function(d) {
                            return [d];
                    });
                    treeItemElementParent
                        .exit()
                        .remove();
        
                    treeItemElementParent
                        .style({
                            "background-color": settings.slicerText.background,
                            "height": "100%"
                        });
        
                    treeItemElementParent
                        .enter()
                        .append("li")
                        .classed(HierarchySlicer.ItemContainer.class, true);
    
                    // Expand/collapse
                    if (this.maxLevels > 1) {
                        var expandCollapse = treeItemElementParent
                            .selectAll(HierarchySlicer.ItemContainerExpander.selectorName)
                            .data(function(d) {
                                return [d];
                        });
                        expandCollapse.exit().remove();
                        expandCollapse
                            .enter()
                            .append("div", ":first-child")
                            .classed(HierarchySlicer.ItemContainerExpander.class, true)
                            .insert("div")
                            .classed("collapsed", function(d) { return !d.isExpand })
                            .classed("expanded", function(d) { return d.isExpand })
                            .classed("icon", true)
                            .classed("icon-left", true)
                            .style({
                                "visibility": function (d) { return d.isLeaf ? "hidden" : "visible"; },
                                "font-size": PixelConverter.toString(PixelConverter.fromPointToPixel(settings.slicerText.textSize)),
                                "margin-left" :  function(d) { return PixelConverter.toString(-settings.slicerText.textSize / ( 2.5)); },
                                "width": PixelConverter.toString(Math.ceil(.95 * PixelConverter.fromPointToPixel(settings.slicerText.textSize))),
                                "height": PixelConverter.toString(Math.ceil(.95 * PixelConverter.fromPointToPixel(settings.slicerText.textSize))),
                                "color": settings.slicerText.fontColor,
                            })
                                .html(_this.IconSet.expand);
                        expandCollapse.selectAll(HierarchySlicer.ItemContainerExpander.selectorName)
                            .data(function(d) {
                                return [d];
                            })
                            .enter()
                            .insert("div") // Spinner location
                            .classed("spinner-icon", true)
                            .style({
                                "display": "none",
                                "font-size": PixelConverter.toString(PixelConverter.fromPointToPixel(settings.slicerText.textSize)),
                                "padding-bottom" : function(d) { return PixelConverter.toString(settings.slicerText.textSize / (d.isExpand ? 3 : 1.8)); },
                                "margin-left" :  function(d) { return PixelConverter.toString(-settings.slicerText.textSize / (2.5)); },
                                "width": PixelConverter.toString(Math.ceil(.95 * PixelConverter.fromPointToPixel(settings.slicerText.textSize))),
                                "height": PixelConverter.toString(Math.ceil(.95 * PixelConverter.fromPointToPixel(settings.slicerText.textSize))) 
                            });
                        //});
                    }
                    var treeItemElement = treeItemElementParent.append("div").classed(HierarchySlicer.ItemContainerChild.class, true);
                    var checkBoxParent = treeItemElement.selectAll(HierarchySlicer.Input.selector).data(function(d) {return [d];});
                    checkBoxParent.enter().append("div").classed(HierarchySlicer.Input.class, true);
                    var checkBoxInput = checkBoxParent.selectAll("input").data(function(d) {return [d];});
                    checkBoxInput.enter().append("input").attr("type", "checkbox");
                    var checkBoxSpan = checkBoxParent.selectAll(HierarchySlicer.Checkbox.selector).data(function(d) {return [d];});
                    checkBoxSpan.enter().append("span").classed(HierarchySlicer.Checkbox.class, true);;
                    checkBoxSpan.style({
                            "width": (.75 * settings.slicerText.textSize) + "px",
                            "height": (.75 * settings.slicerText.textSize) + "px",
                            "margin-right": PixelConverter.fromPointToPixel(.25 * settings.slicerText.textSize) + "px",
                            "margin-bottom": PixelConverter.fromPointToPixel(.25 * settings.slicerText.textSize) + "px"
                        });
                    var labelElement = treeItemElement.selectAll(HierarchySlicer.LabelText.selector).data(function(d) {return [d];});
                    labelElement.enter().append("span").classed(HierarchySlicer.LabelText.class, true);
                    labelElement.style({
                            "color": settings.slicerText.fontColor,
                            "font-size": settings.slicerText.textSize + "pt"
                        });
                    var maxLevel = this.maxLevels;
                    treeItemElementParent.each(function (d, i) {
                        let item = d3.select(this);
                        item.style("padding-left", (maxLevel === 1 ? 8 : (d.level * settings.slicerText.textSize)) + "px");
                    });
                };
                HierarchySlicer.prototype.onUpdateSelection = function (rowSelection, interactivityService) {
                    var settings = this.settings;
                    if (!settings) {
                        return
                    }
                    var data = this.data;
                    if (data) {
                        if (settings.header.show) {
                            this.slicerHeader.style("display", "block");
                        }
                        else {
                            this.slicerHeader.style("display", "none");
                        }
                        this.slicerHeader.select(HierarchySlicer.HeaderText.selector).text(settings.header.title.trim()).style({
                            "color": settings.header.fontColor,
                            "background-color": settings.header.background,
                            "border-style": "solid",
                            "border-color": settings.general.outlineColor,
                            "border-width": this.getBorderWidth(settings.header.outline, settings.header.outlineWeight),
                            "font-size": PixelConverter.fromPoint(settings.header.textSize),
                        });
                        this.slicerBody.classed("slicerBody", true);
                        var slicerText = rowSelection.selectAll(HierarchySlicer.LabelText.selector);
                        slicerText.text(function (d) {
                            return d.value;
                        });
                        if (interactivityService && this.slicerBody) {
                            var body = this.slicerBody.attr("width", this.viewport.width);
                            var expanders = body.selectAll(HierarchySlicer.ItemContainerExpander.selector);
                            var slicerItemContainers = body.selectAll(HierarchySlicer.ItemContainerChild.selector);
                            var slicerItemLabels = body.selectAll(HierarchySlicer.LabelText.selector);
                            var slicerItemInputs = body.selectAll(HierarchySlicer.Input.selector);
                            var slicerClear = this.slicerHeader.select(HierarchySlicer.Clear.selector);
                            var slicerExpand = this.slicerHeader.select(HierarchySlicer.Expand.selector);
                            var slicerCollapse = this.slicerHeader.select(HierarchySlicer.Collapse.selector);
                            var behaviorOptions = {
                                hostServices: this.hostServices,
                                dataPoints: data.dataPoints,
                                expanders: expanders,
                                slicerContainer: this.slicerContainer,
                                slicerItemContainers: slicerItemContainers,
                                slicerItemLabels: slicerItemLabels,
                                slicerItemInputs: slicerItemInputs,
                                slicerClear: slicerClear,
                                slicerExpand: slicerExpand,
                                slicerCollapse: slicerCollapse,
                                interactivityService: interactivityService,
                                slicerSettings: data.settings,
                                levels: data.levels,
                            };
                            try {
                                interactivityService.bind(data.dataPoints, this.behavior, behaviorOptions, {
                                    overrideSelectionFromData: true,
                                    hasSelectionOverride: data.hasSelectionOverride
                                });
                            }
                            catch (e) {
                            }
                            this.behavior.styleSlicerInputs(rowSelection.select(HierarchySlicer.ItemContainerChild.selector), interactivityService.hasSelection());
                        }
                        else {
                            this.behavior.styleSlicerInputs(rowSelection.select(HierarchySlicer.ItemContainerChild.selector), false);
                        }
                    }
                };
                HierarchySlicer.prototype.onLoadMoreData = function () {
                    var dataView = this.dataView;
                    if (!dataView)
                        return;
                    var dataViewMetadata = dataView.metadata;
                    // Making sure that hostservices.loadMoreData is not invoked when waiting for server to load the next segment of data
                    if (!this.waitingForData && dataViewMetadata && dataViewMetadata.segment) {
                        this.hostServices.loadMoreData();
                        this.waitingForData = true;
                    }
                };
                HierarchySlicer.getTextProperties = function (textSize) {
                    return {
                        fontFamily: HierarchySlicer.DefaultFontFamily,
                        fontSize: PixelConverter.fromPoint(textSize || HierarchySlicer.DefaultFontSizeInPt),
                    };
                };
                HierarchySlicer.prototype.getSearchHeight = function () {
                    return this.searchHeader.height() + 2; // 2 for marge
                }
                HierarchySlicer.prototype.getHeaderHeight = function () {
                    return powerbi.TextMeasurementService.estimateSvgTextHeight(HierarchySlicer.getTextProperties(this.settings.header.textSize));
                };
                HierarchySlicer.prototype.getRowHeight = function () {
                    return powerbi.TextMeasurementService.estimateSvgTextHeight(HierarchySlicer.getTextProperties(this.settings.slicerText.textSize));
                };
                HierarchySlicer.prototype.getBodyViewport = function (currentViewport) {
                    var settings = this.settings;
                    var headerHeight;
                    var slicerBodyHeight;
                    if (settings) {
                        headerHeight = settings.header.show ? this.getHeaderHeight() : 0;
                        headerHeight += settings.general.selfFilterEnabled ? this.getSearchHeight() : 0;
                        slicerBodyHeight = currentViewport.height - (headerHeight + settings.header.borderBottomWidth);
                    }
                    else {
                        headerHeight = 0;
                        slicerBodyHeight = currentViewport.height - (headerHeight + 1);
                    }
                    return {
                        height: slicerBodyHeight,
                        width: currentViewport.width
                    };
                };
                HierarchySlicer.prototype.getBorderWidth = function (outlineElement, outlineWeight) {
                    switch (outlineElement) {
                        case "None":
                            return "0px";
                        case "BottomOnly":
                            return "0px 0px " + outlineWeight + "px 0px";
                        case "TopOnly":
                            return outlineWeight + "px 0px 0px 0px";
                        case "TopBottom":
                            return outlineWeight + "px 0px " + outlineWeight + "px 0px";
                        case "LeftRight":
                            return "0px " + outlineWeight + "px 0px " + outlineWeight + "px";
                        case "Frame":
                            return outlineWeight + "px";
                        default:
                            return outlineElement.replace("1", outlineWeight.toString());
                    }
                };
                HierarchySlicer.prototype.createSearchHeader = function (container) {
                    var _this = this;
                    this.searchHeader = $("<div>").appendTo(container).addClass("searchHeader").addClass("collapsed");
                    var counter = 0;
                    $("<div>").appendTo(this.searchHeader).attr("title", "Search").addClass("powervisuals-glyph").addClass("search").on("click", function () { return _this.hostServices.persistProperties({
                        merge: [{
                            objectName: "general",
                            selector: null,
                            properties: {
                                counter: counter++
                            }
                        }]
                    }); });
                    this.searchInput = $("<input>").appendTo(this.searchHeader).attr("type", "text").attr("drag-resize-disabled", "true").addClass("searchInput").on("input", function () { return _this.hostServices.persistProperties({
                        merge: [{
                            objectName: "general",
                            selector: null,
                            properties: {
                                counter: counter++
                            }
                        }]
                    }); });
                    $("<div>").appendTo(this.searchHeader).attr("title", "Delete").addClass("delete glyphicon pbi-glyph-close glyph-micro").addClass("delete").on("click", function () {
                        _this.searchInput[0].value = "";
                        _this.hostServices.persistProperties({
                            merge: [{
                                objectName: "general",
                                selector: null,
                                properties: {
                                    counter: counter++
                                }
                            }]
                        });
                    });
                };
                HierarchySlicer.prototype.updateSearchHeader = function () {
                    this.searchHeader.toggleClass("show", this.settings.general.selfFilterEnabled);
                    this.searchHeader.toggleClass("collapsed", !this.settings.general.selfFilterEnabled);
                };
                HierarchySlicer.prototype.enumerateObjectInstances = function (options) {
                    var instances = [];
                    var objects = this.dataView.metadata.objects;
                    switch (options.objectName) {
                        case "selection":
                            var singleSelect = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.singleselect, this.settings.general.singleselect);
                            var emptyLeafs = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.emptyLeafs, this.settings.general.emptyLeafs)
                            var selectAll = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.selectAll, this.settings.general.selectAll);
                            var selectAllLabel = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.selectAllLabel, this.settings.general.selectAllLabel)
                            var selectionOptions = selectAll ? {
                                objectName: "selection",
                                displayName: "Selection",
                                selector: null,
                                properties: {
                                    singleSelect: singleSelect,
                                    emptyLeafs: emptyLeafs,
                                    selectAll: selectAll,
                                    selectAllLabel: selectAllLabel
                                }
                            } : {
                                objectName: "selection",
                                displayName: "Selection",
                                selector: null,
                                properties: {
                                    singleSelect: singleSelect,
                                    emptyLeafs: emptyLeafs,
                                    selectAll: selectAll
                                }
                            };
                            instances.push(selectionOptions);
                            break;
                        case "header":
                            var headerOptions = {
                                objectName: "header",
                                displayName: "Header",
                                selector: null,
                                properties: {
                                    show: powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.show, this.settings.header.show),
                                    title: powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.title, this.settings.header.title),
                                    fontColor: powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.fontColor, this.settings.header.fontColor),
                                    background: powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.background, this.settings.header.background),
                                    textSize: powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.textSize, this.settings.header.textSize),
                                }
                            };
                            instances.push(headerOptions);
                            break;
                        case "items":
                            var items = {
                                objectName: "items",
                                displayName: "Items",
                                selector: null,
                                properties: {
                                    fontColor: powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.fontColor, this.settings.slicerText.fontColor),
                                    selectedColor: powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.selectedColor, this.settings.slicerText.selectedColor),
                                    background: powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.background, this.settings.slicerText.background),
                                    hoverColor: powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.hoverColor, this.settings.slicerText.hoverColor),
                                    textSize: powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.textSize, this.settings.slicerText.textSize),
                                }
                            };
                            instances.push(items);
                            break;
                    }
                    return instances;
                };
                HierarchySlicer.capabilities = {
                    dataRoles: [{
                        name: "Fields",
                        kind: powerbi.VisualDataRoleKind.Grouping,
                        displayName: "Fields"
                    }, {
                        name: "Values",
                        kind: powerbi.VisualDataRoleKind.Measure,
                        displayName: "Values",
                    }],
                    dataViewMappings: [{
                        conditions: [{
                            "Values": { min: 0, max: 1 }
                        }],
                        table: {
                            rows: {
                                select: 
                                [
                                    {for: { in: "Fields" } },
                                    {for: { in: "Values" } }
                                ], dataReductionAlgorithm: { bottom: { count: 4000 } }
                            },
                        }
                    }],
                    objects: {
                        general: {
                            displayName: "General",
                            properties: {
                                filter: {
                                    type: { filter: {} }
                                },
                                filterValues: {
                                    type: { text: true }
                                },
                                expanded: {
                                    type: { text: true }
                                },
                                hidden: {
                                    type: { text: true }
                                },
                                defaultValue: {
                                    type: { expression: { defaultValue: true } },
                                },
                                formatString: {
                                    type: {
                                        formatting: { formatString: true }
                                    },
                                },
                                selfFilter: {
                                    type: { filter: { selfFilter: true } },
                                },
                                selfFilterEnabled: {
                                    type: { operations: { searchEnabled: true } }
                                },
                                version: {
                                    type: { numeric: true }
                                },
                            },
                        },
                        selection: {
                            displayName: "Selection",
                            properties: {
                                singleSelect: {
                                    displayName: "Single Select",
                                    type: { bool: true }
                                },
                                emptyLeafs: {
                                    displayName: "Empty Leafs",
                                    description: "Show empty leafs as (Blank)",
                                    type: { bool: true }
                                },
                                selectAll: {
                                    displayName: "Select All",
                                    description: "Show the 'Select All' member",
                                    type: { bool: true }
                                },
                                selectAllLabel: {
                                    displayName: "Select All Label",
                                    description: "Label for 'Select All' member",
                                    type: { text: true }
                                }
                            },
                        },
                        header: {
                            displayName: "Header",
                            properties: {
                                show: {
                                    displayName: "Show",
                                    type: { bool: true }
                                },
                                title: {
                                    displayName: "Title",
                                    type: { text: true }
                                },
                                fontColor: {
                                    displayName: "Font color",
                                    description: "Font color of the title",
                                    type: { fill: { solid: { color: true } } }
                                },
                                background: {
                                    displayName: "Background",
                                    type: { fill: { solid: { color: true } } }
                                },
                                textSize: {
                                    displayName: "Text Size",
                                    type: { formatting: { fontSize: true } }
                                },
                            },
                        },
                        items: {
                            displayName: "Items",
                            properties: {
                                fontColor: {
                                    displayName: "Font color",
                                    description: "Font color of the cells",
                                    type: { fill: { solid: { color: true } } }
                                },
                                selectedColor: {
                                    displayName: "Select color",
                                    description: "Font color of the selected cells",
                                    type: { fill: { solid: { color: true } } }
                                },
                                background: {
                                    displayName: "Background",
                                    type: { fill: { solid: { color: true } } }
                                },
                                hoverColor: {
                                    displayName: "Hover",
                                    description: "Color of the cells when the mouse if hovered over",
                                    type: { fill: { solid: { color: true } } }
                                },
                                textSize: {
                                    displayName: "Text Size",
                                    type: { formatting: { fontSize: true } }
                                },
                            },
                        }
                    },
                    supportsHighlight: true,
                    suppressDefaultTitle: true,
                    filterMappings: {
                        measureFilter: { targetRoles: ["Fields"] },
                    },
                    sorting: {
                        default: {},
                    }
                };
                HierarchySlicer.formatStringProp = {
                    objectName: "general",
                    propertyName: "formatString",
                };
                HierarchySlicer.DefaultFontFamily = "Segoe UI, Tahoma, Verdana, Geneva, sans-serif";
                HierarchySlicer.DefaultFontSizeInPt = 11;
                HierarchySlicer.Container = createClassAndSelector("slicerContainer");
                HierarchySlicer.Body = createClassAndSelector("slicerBody");
                HierarchySlicer.ItemContainer = createClassAndSelector("slicerItemContainer");
                HierarchySlicer.ItemContainerSpinner = createClassAndSelector("slicerItemContainerSpinner");
                HierarchySlicer.ItemContainerExpander = createClassAndSelector("slicerItemContainerExpander");
                HierarchySlicer.ItemContainerChild = createClassAndSelector("slicerItemContainerChild");
                HierarchySlicer.LabelText = createClassAndSelector("slicerText");
                HierarchySlicer.CountText = createClassAndSelector("slicerCountText");
                HierarchySlicer.Checkbox = createClassAndSelector("checkbox");
                HierarchySlicer.HeaderContainer = createClassAndSelector("slicerHeaderContainer");
                HierarchySlicer.Header = createClassAndSelector("slicerHeader");
                HierarchySlicer.HeaderText = createClassAndSelector("headerText");
                HierarchySlicer.Collapse = createClassAndSelector("collapse");
                HierarchySlicer.Expand = createClassAndSelector("expand");
                HierarchySlicer.Clear = createClassAndSelector("clear");
                HierarchySlicer.Icon = createClassAndSelector("icon");
                HierarchySlicer.Input = createClassAndSelector("slicerCheckbox");
                return HierarchySlicer;
            })();
            HierarchySlicer1458836712039.HierarchySlicer = HierarchySlicer;
        })(HierarchySlicer1458836712039 = visuals.HierarchySlicer1458836712039 || (visuals.HierarchySlicer1458836712039 = {}));
    })(visuals = powerbi.visuals || (powerbi.visuals = {}));
})(powerbi || (powerbi = {}));
var powerbi;
(function (powerbi) {
    var visuals;
    (function (visuals) {
        var plugins;
        (function (plugins) {
            plugins.HierarchySlicer1458836712039 = {
                name: "HierarchySlicer1458836712039",
                class: "HierarchySlicer1458836712039",
                capabilities: powerbi.visuals.HierarchySlicer1458836712039.HierarchySlicer.capabilities,
                custom: true,
                create: function (options) { return new powerbi.visuals.HierarchySlicer1458836712039.HierarchySlicer(options); },
                apiVersion: null
            };
        })(plugins = visuals.plugins || (visuals.plugins = {}));
    })(visuals = powerbi.visuals || (powerbi.visuals = {}));
})(powerbi || (powerbi = {}));
