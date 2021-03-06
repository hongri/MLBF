/******************************************************************************
 * MLBF 0.0.1 2015-05-26 
 * author hongri
 ******************************************************************************/

/*
 * CMD Rules, do not have dependencies module
 * MLBF.defined('moudleName', function(require, exports, module))
 */

(function(global, undefined) {

    // Avoid conflicting when `MLBF.js` is loaded multiple times
    if (global.MLBF) {
        var lastVersion = global.MLBF;
    }

    var exports = global.MLBF = {
        version: "0.0.1"
    }

    var data = exports.data = {};

    function isType(type) {
        return function(obj) {
            return {}.toString.call(obj) == "[object " + type + "]";
        }
    }

    var isFunction = isType("Function");

    var cachedMods = global.MLBF.cache = {};

    function Module() {};

    // Execute a module
    Module.prototype.exec = function() {
        var mod = this;

        if (this.execed) {
            return mod.exports;
        }
        this.execed = true;

        function require(id) {
            return Module.get(id).exec();
        }

        var factory = mod.factory;

        var exports = isFunction(factory) ?
            factory(require, mod.exports = {}, mod) :
            factory;

        if (exports === undefined) {
            exports = mod.exports;
        }

        // Reduce memory leak
        delete mod.factory;

        mod.exports = exports;

        return exports;
    }

    Module.save = function(meta) {
        var mod = Module.get(meta.id);

        mod.id = meta.id;
        mod.factory = meta.factory;
    }

    Module.get = function(id) {
        return cachedMods[id] || (cachedMods[id] = new Module());
    }

    // Define a module
    Module.define = function(id, factory) {
        var meta = {
            id: id,
            factory: factory
        }

        Module.save(meta);
    }

    exports.define = Module.define;

    // For Developers
    exports.Module = Module;

    exports.require = function(id) {
        var mod = Module.get(id);
        if (!mod.execed) {
            mod.exec();
        }
        return mod.exports;
    }

})(this)
/******************************************************************************
 * MLBF Controller 0.0.1 2015-05-26 
 * author hongri
 ******************************************************************************/

MLBF.define('app.Controller', function(require) {
    var extend = require('util.extend'),
        Zepto = require('lib.Zepto'),
        template = require('lib.template'),
        _ = require('util.underscore'),
        defaults = require('util.defaults'),
        Attribute = require('util.Attribute'),
        Class = require('util.Class');

    var methods = {},
        fn = Zepto.fn;

    //this.method = this.$el.method
    for (var methodName in fn) {
        if (fn.hasOwnProperty(methodName)) {
            (function(methodName) {
                methods[methodName] = function() {
                    if (!this.$el) {
                        this.setElement('<div></div>');
                    }
                    var result = this.$el[methodName].apply(this.$el, arguments);
                    return this.$el === result ? this : result;
                }
            })(methodName);
        }
    }

    delete methods.constructor;

    /**
     * All ui components' base. All Zepto methods and template engine are mixed in.
     * @class Node
     * @namespace app.Controller
     * @extends util.Class
     * @uses lib.Zepto
     * @uses util.Attributes
     * @constructor
     * @param {String|Zepto|documentElement|ui.Nodes.Node} selector Node selector
     * @example
     *      new Node('#someElement'); // Turn element, which id is 'someElement', into a node
     *
     * @example
     *      // Zepto object or Node object or document element object are all acceptable
     *      new Node($('#someElement'));
     *      new Node(new Node('#someElement'));
     *      new Node(document.getElementById('someElement'));
     */
    return Class.inherit(methods, Attribute, {
        initialize: function(opts) {

            //merge options
            this.mergeOptions(opts);

            //render structure
            this.render();

            /**
             * Fire when node initialized
             * @event load
             * @param {Event} event JQuery event
             * @param {Node} node Node object
             */
            this.trigger('load', [this]);
        },

        /**
         * @method $
         * @uses lib.Zepto
         */
        $: Zepto,

        /**
         * @method Zepto
         * @uses lib.Zepto
         */
        Zepto: Zepto,

        /**
         * @method template
         * @uses util.template
         */
        template: template,

        // todo
        // copy static property settings when inheriting

        /**
         * Merge options with defaults and cache to node.opts
         * @method mergeOptions
         * @param {Object} opts Options to be merged
         * @protected
         * @chainable
         * @example
         *      node.mergeOptions({
         *          //options
         *      });
         */
        mergeOptions: function(opts) {
            // use this.defaults before fall back to constructor.settings
            // which enables default settings to be inherited
            var options = defaults(true, opts || (opts = {}), this.defaults || this.constructor.settings || {});

            // set to attributes, keep silent to avoid firing change event
            this.set(options, {
                silence: true
            });
            return this;
        },

        /**
         * Render node
         * Most node needs overwritten this method for own logic
         * @method render
         * @chainable
         */
        render: function() {
            this.setElement(this.get('selector'));
            return this;
        },

        /**
         * Set node's $el. $el is the base of a node ( UI component )
         * Cautious: direct change of node.$el may be dangerous
         * @method setElement
         * @param {String|documentElement|Zepto|Node} el The element to be core $el of the node
         * @chainable
         */
        setElement: function(el) {
            var $el = this.Zepto(el.node || el);

            if (this.$el) {
                this.$el.replaceWith($el);
            }

            this.$el = $el;
            this.el = $el.get(0);

            // customize className
            if (this.get('className')) {
                this.$el.addClass(this.get('className'));
            }

            // Initialization of common elements for the component
            this.initElements();

            // Component default events
            this.delegateEvents();

            // Instance events
            this.initEvents();

            // Component's default actions, should be placed after initElements
            this.defaultActions();

            return this;
        },

        /**
         * Delegate events to node
         * @method delegateEvents
         * @param {Object} [events=this.events] Events to be delegated
         * @chainable
         * @example
         *      node.delegateEvents({
         *          'click .child': function(){
         *              alert('child clicked');
         *          }
         *      });
         */
        delegateEvents: function(events) {
            events = events || this.events;
            if (!events) {
                return this;
            }

            // delegate events
            var node = this;
            $.each(events, function(delegate, handler) {
                var args = (delegate + '').split(' '),
                    eventType = args.shift(),
                    selector = args.join(' ');

                if ($.trim(selector).length > 0) {
                    // has selector
                    // use delegate
                    node.delegate(selector, eventType, function() {
                        return node[handler].apply(node, arguments);
                    });

                    return;
                }

                node.bind(eventType, function() {
                    return node[handler].apply(node, arguments);
                });
            });

            return this;
        },

        /**
         * All default actions bound to node's $el
         * @method defaultActions
         * @protected
         */
        defaultActions: function() {

        },

        /**
         * Bind options.events
         * @method initEvents
         * @param {Object} [delegate=this] Object to be apply as this in callback
         * @chainable
         * @protected
         */
        initEvents: function(delegate) {
            var node = this,
                events = this.get('events');

            if (!events) {
                return this;
            }

            delegate = delegate || node;
            for (var eventName in events) {
                if (events.hasOwnProperty(eventName)) {
                    node.bind(eventName, proxy(events[eventName], delegate));
                }
            }

            return this;
        },

        /**
         * Find this.elements, wrap them with Zepto and cache to this, like this.$name
         * @method initElements
         * @chainable
         * @protected
         */
        initElements: function() {
            var elements = this.elements;

            if (elements) {
                for (var name in elements) {
                    if (elements.hasOwnProperty(name)) {
                        this[name] = this.find(elements[name]);
                    }
                }
            }

            return this;
        },

        /**
         * Set an attribute
         * @method set
         * @param {String} attr Attribute name
         * @param {*} value
         * @param {Object} options Other options for setter
         * @param {Boolean} [options.silence=false] Silently set attribute without fire change event
         * @chainable
         */
        set: function(attr, val, options) {
            var attrs = this['_ATTRIBUTES'];

            if (!attrs) {
                attrs = this['_ATTRIBUTES'] = {};
            }

            if (typeof attr !== 'object') {
                var oAttr = attrs[attr];
                attrs[attr] = val;

                // validate
                if (!attrs) {
                    // restore value
                    attrs[attr] = oAttr;
                } else {
                    // trigger event only when value is changed and is not a silent setting
                    if (val !== oAttr && (!options || !options.silence) && this.trigger) {
                        /**
                         * Fire when an attribute changed
                         * Fire once for each change and trigger method is needed
                         * @event change:attr
                         * @param {Event} JQuery event
                         * @param {Object} Current attributes
                         */
                        this.trigger('change:' + attr, [attrs[attr], oAttr]);

                        /**
                         * Fire when attribute changed
                         * Fire once for each change and trigger method is needed
                         * @event change
                         * @param {Event} JQuery event
                         * @param {Object} Current attributes
                         */
                        this.trigger('change', [attrs]);
                    }
                }

                return this;
            }

            // set multiple attributes by passing in an object
            // the 2nd arg is options in this case
            options = val;

            // plain merge
            // so settings will only be merged plainly
            var obj = extend({}, attrs, attr);

            if (obj) {
                this['_ATTRIBUTES'] = obj;
                // change event
                if ((!options || !options.silence) && this.trigger) {
                    var changedCount = 0;
                    for (var i in attr) {
                        // has property and property changed
                        if (attr.hasOwnProperty(i) && obj[i] !== attrs[i]) {
                            changedCount++;
                            this.trigger('change:' + i, [obj[i], attrs[i]]);
                        }
                    }

                    // only any attribute is changed can trigger change event
                    changedCount > 0 && this.trigger('change', [obj]);
                }
            }

            return this;
        },

        /**
         * Get attribute
         * @method get
         * @param {String} attr Attribute name
         * @return {*}
         */
        get: function(attr) {
            return !this['_ATTRIBUTES'] ? null : this['_ATTRIBUTES'][attr];
        }
    });
});
/******************************************************************************
 * MLBF Controller 0.0.1 2015-05-26 
 * author hongri
 ******************************************************************************/
MLBF.define('app.Model', function(require, exports, module) {
    var extend = require('util.extend'),
        Attribute = require('util.Attribute');
        
    var Model = extend({}, Attribute);
    return Model;
});
/**
 * Created by amos on 14-1-14.
 */
MLBF.define('app.REST', function(require) {
    var extend = require('util.extend'),
        _ = require('util.underscore'),
        $ = require('lib.Zepto'),
        Model = require('app.Model'),
        Event = require('util.Event');

    // var plugins = {
    //     errorLog: require('app.RESTPlugins.errorLog'),
    //     speedReport: require('app.RESTPlugins.speedReport'),
    //     CSRFPatch: require('app.RESTPlugins.CSRFPatch')
    // };

    // Map from CRUD to HTTP for our default sync implementation.
    var methodMap = {
        'create': 'POST',
        'update': 'PUT',
        'patch': 'PATCH',
        'del': 'DELETE',
        'read': 'GET'
    };

    var defaults = {
        errorStatusCode: 608,
        ajax: {}
    };

    /**
     * Restful sync component, provides CRUD methods for ajax programing.
     * REST component supports middle ware plugin and has built-in middle wares of auto error log, auto speed report, auto CSRF patch
     * @class REST
     * @namespace app
     * @module app
     */
    var REST = extend({
        /**
         * An interface to $.ajax
         * @method ajax
         * @static
         * @see $.ajax
         */
        ajax: $.ajax,

        /**
         * Main method for REST to communicate with backend
         * @method sync
         * @static
         * @param {String} method Accept CRUD methods only
         * @param {Object} options Sync options
         * @param {Object} [options.data] Data to be sent
         * @returns {jquery.xhr} JQuery xhr object, supports promise
         */
        sync: function(method, options) {
            var type = methodMap[method];

            // Default options, unless specified.
            var ajaxDefaults = this.attributes().ajax;

            // Default JSON-request options.
            var params = {
                type: type,
                dataType: 'json'
            };

            // Ensure that we have a URL.
            !options.url && urlError();

            // Ensure that we have the appropriate request data.
            if (typeof options.data === 'object' && (type === 'POST' || type === 'PUT' || type === 'DELETE')) {
                params.contentType = 'application/json';
                params.data = options.data = JSON.stringify(options.data || {});
            }

            // Wrap success & error handler
            wrapHandler(this, options);

            var ajaxSettings = extend(params, ajaxDefaults, options);

            /**
             * Event triggered when before sending a request
             * @event beforeSend
             * @param ajaxSettings The final settings(params) of sync
             */
            this.trigger('beforeSend', ajaxSettings);

            // Make the request, allowing the user to override any Ajax options.
            var xhr = options.xhr = this.ajax(ajaxSettings);

            // Replace xhr.fail to transformed arguments
            wrapXHR(xhr);

            /**
             * Event triggered when a request been made
             * @event request
             * @param xhr The XMLHttpRequest instance from $.ajax
             * @param ajaxSettings The final settings(params) of sync
             */
            this.trigger('request', xhr, ajaxSettings);

            return xhr;
        },

        /**
         * Use plugin ( middle ware )
         * 3 built-in plugins (errorLog/speedReport/CSRFPatch) provided right now.
         * @method use
         * @static
         * @param {String|Function} plugin Plugin name, or plugin function. A plugin is a middle ware that will be invoked before sync action (right before event beforeSend)
         * @chainable
         * @example
         *
         *      // Plugin errorLog use monitor.logger and share it's config
         *      logger.config({
         *          writelogger: true,
         *          proj: 'REST test'
         *      });
         *
         *      // Set plugin(middle ware) config
         *      REST.set({
         *          log: {
         *              module: 'test page',
         *              fn: 'test case'
         *          },
         *          CSRF: {
         *              token: '_bqq_csrf'
         *          }
         *      });
         *
         *      // Use plugins
         *      REST
         *          // auto error log plugin
         *          .use('errorLog')
         *
         *          // auto speed report plugin
         *          // speed report need additional option 'speedReport' when sync
         *          .use('speedReport')
         *
         *          // auto CSRF patch
         *          .use('CSRFPatch');
         *
         *
         *      REST.read({
         *          uri: 'readApi',
         *
         *          // Speed report plugin config
         *          // 3 flags & 1 point to identified the report point
         *          // Rate is the percentage to send speed report
         *          speed: {
         *              flag1: 1,
         *              flag2: 2,
         *              flag3: 3,
         *              point: 2,
         *              rate: 1
         *          }
         *      });
         */
        use: function(plugin) {
            _.isFunction(plugin) ?
                plugin(this) :
                plugins[plugin] && plugins[plugin](this);

            return this;
        }
    }, Model, Event);

    /**
     * Create operation on backend
     * @method create
     * @static
     * @param {Object} options Sync options
     * @param {Object} [options.data] Data to be sent
     * @returns {jquery.xhr} JQuery xhr object, supports promise
     */

    /**
     * Read data from backend
     * @method read
     * @static
     * @param {Object} options Sync options
     * @param {Object} [options.data] Data to be sent
     * @returns {jquery.xhr} JQuery xhr object, supports promise
     * @example
     *      LBF.use(['app.REST'], function(REST){
     *          // Read data from backend
     *          // Create/update/del are mostly the same
     *          var xhr = REST.read({
     *              url: 'readApi',
     *
     *              // Success callback
     *              success: function(res, options){
     *                  logger.log('read success');
     *              },
     *
     *              // Error callback
     *              error: function(err, xhr, jQErr){
     *                  logger.log('read error');
     *                  logger.log(err.message);
     *              }
     *          });
     *
     *          // JQuery xhr object, supports promise
     *          xhr
     *              .done(function(res, options){
     *                  logger.log('read done');
     *              })
     *              .fail(function(err, xhr, jQErr){
     *                  logger.log('read fail');
     *              })
     *              // Arguments to then callbacks depend on promise state
     *              .then(function(){
     *                  logger.log('read then');
     *              });
     *      });
     */

    /**
     * Update operation on backend
     * @method update
     * @static
     * @param {Object} options Sync options
     * @param {Object} [options.data] Data to be sent
     * @returns {jquery.xhr} JQuery xhr object, supports promise
     */

    /**
     * delete operation on backend
     * use method name 'del' because 'delete' is reserved in IE
     * @method del
     * @static
     * @param {Object} options Sync options
     * @param {Object} [options.data] Data to be sent
     * @returns {jquery.xhr} JQuery xhr object, supports promise
     */
    _.forEach(['create', 'read', 'update', 'del'], function(method) {
        REST[method] = function(options) {
            return this.sync(method, options);
        };
    });

    REST.on('error', function(err, xhr, textStatus, jQErr) {
        var status = err.status,
            code = err.code,
            errorStatusCode = this.get('errorStatusCode');

        /**
         * Event triggered at a particular http status, like 500/404/509 etc
         * When status is 500, the name of triggered event is 500, not 'status'
         * @event status
         * @param {Error} err Error instance
         * @param {XMLHttpRequest} xhr XMLHttpRequest instance created by $.ajax
         * @param {String} textStatus Description text of the status
         * @param {$Error} jQErr Error instance created by $.ajax
         * @example
         *      // Watch http status 404
         *      REST.on(404, function(){
         *          logger.log(404);
         *      });
         */
        this.trigger(status, err, xhr, textStatus, jQErr);

        /**
         * Event triggered when status is the specified one (like 509) and an error code come up
         * @event errorCode
         * @param {Error} err Error instance
         * @param {XMLHttpRequest} xhr XMLHttpRequest instance created by $.ajax
         * @param {String} textStatus Description text of the status
         * @param {$Error} jQErr Error instance created by $.ajax
         * @example
         *      // Watch code 1001
         *      REST.on('error1001', function(){
         *          logger.log(1001);
         *      });
         */
        status === errorStatusCode && this.trigger('error' + code, err, xhr, textStatus, jQErr);
    });

    // use default settings
    REST.set(defaults);

    return REST;

    /**
     * Wrap success and error handler
     * @method wrapHandler
     * @private
     * @static
     * @param REST
     * @param {Object} options Sync options
     */
    function wrapHandler(REST, options) {
        var successCallbck = options.success,
            errorCallback = options.error;

        options.success = function(res) {
            successCallbck && successCallbck.apply(this, arguments);

            /**
             * Event triggered when a sync succeeds
             * @event sync
             * @param {Object} res Response data
             * @param {Object} options Sync options
             */
            REST.trigger('sync', res, options);
        };

        options.error = function(xhr, textStatus, httpError) {
            var err = wrapError(xhr, httpError);

            /**
             * @param {Object} err Error object
             * @param {Number} err.code Error code, default to be -1 if not assign
             * @param {XMLHttpRequest} xhr XMLHttpRequest instance created by $.ajax
             * @param {String} textStatus Text status of error
             * @param {String} httpError Http status error
             */
            errorCallback && errorCallback.call(this, err, xhr, textStatus, httpError);

            /**
             * Event triggered when a sync fails
             * @event error
             * @param {Object} err Error object
             * @param {Number} err.code Error code, default to be -1 if not assign
             * @param {XMLHttpRequest} xhr XMLHttpRequest instance created by $.ajax
             * @param {String} textStatus Text status of error
             * @param {String} httpError Http status error
             */
            REST.trigger('error', err, xhr, textStatus, httpError);
        };
    }

    /**
     * Wrap fail method of jqXHR to provide more friendly callback arguments
     * @method wrapXHR
     * @private
     * @param {Object} options Sync options
     */
    function wrapXHR(xhr) {
        var fail = xhr.fail;

        xhr.fail = function(fn) {
            var wrappedFn = function(xhr, textStatus, httpError) {
                var err = wrapError(xhr, httpError);
                /**
                 * Call original fail method with transformed arguments 
                 * @param {Object} err Error object
                 * @param {Number} err.code Error code, default to be -1 if not assign
                 * @param {XMLHttpRequest} xhr XMLHttpRequest instance created by $.ajax
                 * @param {String} textStatus Text status of error
                 * @param {String} httpError Http status error
                 */
                fn.call(this, err, xhr, textStatus, httpError);
            };

            return fail.call(this, wrappedFn);
        };
    }

    /**
     * Wrap error from xhr response text, with fallback
     * @method wrapError
     * @private
     * @param {jqXHR} xhr
     * @param {String} httpError HTTP status error wording
     * @return {Error} Wrapped error object
     */
    function wrapError(xhr, httpError) {
        var err = new Error,
            res;

        try {
            // try decode error body as JSON
            res = JSON.parse(xhr.responseText);
        } catch (e) {
            // when error occurs at decoding
            // wrap error string, and create common error object
            res = {
                code: xhr.status,
                message: xhr.responseText || httpError
            }
        }

        err.code = res.code;
        err.message = res.message;
        // copy http status
        err.status = xhr.status;

        //backsend data
        res.data && (err.data = res.data);

        return err;
    }

    function urlError() {
        throw new Error('url must be specified');
    }
});
/*
 * mobilebone.js
 * by zhangxinxu(.com) 2014-09-26
 * https://github.com/zhangxinxu/mobilebone
 * bone of switch for mobile web app 
 **/
MLBF.define('lib.Mobilebone', function(require) {
    var Mobilebone = (function() {
        var Mobilebone = {},
            root = this;

        if (document.MBLOADED) {
            return 'Don\'t repeat load Mobilebone!';
        }

        // Avoid repeated callbacks
        var store = {};

        // Create local references to array methods we'll want to use later.
        var array = [];
        var slice = array.slice;

        // Is it a id selector
        var isSimple = /^#?\w+(?:[\-_]\w+)*$/i;

        // Is it webkit
        var isWebkit = 'WebkitAppearance' in document.documentElement.style || typeof document.webkitHidden != "undefined";

        // Is it suppory history API
        var supportHistory = "pushState" in history && "replaceState" in history;

        Mobilebone.support = supportHistory;

        var hasInited = false;

        /**
         * Current version of the library. Keep in sync with `package.json`.
         *
         * @type string
         **/
        Mobilebone.VERSION = '2.6.1';

        /**
         * Whether catch attribute of href from element with tag 'a'
         * If the value set to false, jump links in a refresh form(not slide)
         * In most cases, you do not need to care about this parameter. 
           Except some special pages that should refresh all links, as test/index.html show.
           However, if your only want several links refesh, you can use data-ajax="false" or data-rel="external"
         *
         * @type boolean
        **/
        Mobilebone.captureLink = true;

        /**
         * Whether catch events of 'submit' from <form> element
         * If the value set to false, <form> is a normal form except data-ajax="true"
         * If the value set to true, <form> will submit as a ajax request, 
           and the return value will be used to create a new page and transition into meanwhile.
           However, if data-ajax="false", <form> won't submit as a ajax.
         *
         * @type boolean
        **/
        Mobilebone.captureForm = true;

        /**
         * The root of transition-callback
         * Default value is 'root', you can consider as window-object. 
           However, there are may many callbacks, it's impossible that all functions are global function.
           We may custom a global object to store our callbacks, such as:
           Callback = {
             fun1: function() {}, 
             fun2: function() {}, 
             fun3: function() {},  
           }
           In this case, the value of 'obilebone.rootTransition' should set Callback;
         *
         * @type object
        **/
        Mobilebone.rootTransition = root;

        /**
         * Whether merge(vs cover) global callback and local callback
         *
         * @type boolean
         **/
        Mobilebone.mergeCallback = true;

        /**
         *  className of animation
         *
         * @type string
         **/
        Mobilebone.classAnimation = "slide";
        /**
         *  for mark page element
         *
         * @type string
         **/
        Mobilebone.classPage = "page";
        /**
         * className for mark mask element
         *
         * @type string
         **/
        Mobilebone.classMask = "mask";
        /**
         * Whether url changes when history changes
         * If this value is false, the url will be no change.
         *
         * @type boolean
         **/
        Mobilebone.pushStateEnabled = true;
        /**
         * Whether excute JavaScript when ajax HTML loaded
         * If this value is true, the script will excute.
         *
         * @type boolean
         **/
        Mobilebone.evalScript = false;


        if ( // When running inside a FF iframe, calling replaceState causes an error. So set 'pushStateEnabled = false' 
            (window.navigator.userAgent.indexOf("Firefox") >= 0 && window.top !== window)
        ) {
            Mobilebone.pushStateEnabled = false;
        }

        /**
         * if browser do not support history/classList, stop here
         **/
        if (supportHistory == false) return Mobilebone;

        /**
         * don't excute window.onpopstate when page load
         **/
        history.popstate = false;

        /**
         * Function for transition
         * In most cases, you are unnecessary to use this function , unlike Mobilebone.createPage
         
         * @params  pageInto: dom-object. Element which will transform into. - Necessary
                    pageOut:  dom-object. Element which will transform out.   - Optional
                    back:     boolean.    Direction of transition.          - Optional
                    options:  object.     Cover or add parameters.           - Optional
         * @returns undefined
         * @example Mobilebone.transition(element);
                    Mobilebone.transition(element1, element2);
                    Mobilebone.transition(element1, element2, true);
                    Mobilebone.transition(element1, element2, { id: "only" });
                    Mobilebone.transition(element1, element2, true, { id: "only" });
        **/
        Mobilebone.transition = function(pageInto, pageOut, back, options) {
            if (arguments.length == 0 || pageInto == pageOut) return;
            if (arguments.length == 3 && isNaN(back * 1) == true) {
                options = back;
                back = options.back;
            };

            //if those parameters is missing
            pageOut = pageOut || null, back = back || false, options = options || {};

            // defaults parameters
            var defaults = {
                    // the value of callback is a key name, and the host is root here. 
                    // eg. if the name of animationstart is 'doLoading', so the script will execute 'root.doLoading()'
                    // By default, the value of root is 'window'
                    root: this.rootTransition,
                    // the form of transition, the value (eg. 'slide') will be a className to add or remove. 
                    // of course, u can set to other valeu, for example, 'fade' or 'flip'. However, u shou add corresponding CSS3 code.
                    form: this.form || this.classAnimation,
                    // 'animationstart/animationend/...' are callbacks params
                    // Note: those all global callbacks!
                    onpagefirstinto: this.onpagefirstinto,
                    animationstart: this.animationstart,
                    animationend: this.animationend,
                    preventdefault: this.preventdefault,
                    fallback: this.fallback,
                    callback: this.callback
                },
                params = function(element) {
                    if (!element || !element.getAttribute) return {};

                    var _params = {},
                        _dataparams = _queryToObject(element.getAttribute("data-params") || '');

                    // rules as follow:
                    // data-* > data-params > options > defaults    
                    ["title", "root", "form"].forEach(function(key) {
                        _params[key] = element.getAttribute("data-" + key) || _dataparams[key] || options[key] || defaults[key];
                    });

                    if (typeof _params.root == "string") {
                        _params.root = Mobilebone.getFunction(_params.root);
                    }

                    ["onpagefirstinto", "callback", "fallback", "animationstart", "animationend", "preventdefault"].forEach(function(key) {
                        if (Mobilebone.mergeCallback == true && typeof defaults[key] == "function") {
                            // merge global callback
                            var local_function_key = element.getAttribute("data-" + key) || _dataparams[key];
                            if (typeof _params.root[local_function_key] == "function") {
                                _params[key] = function() {
                                    defaults[key].apply(this, arguments);
                                    _params.root[local_function_key].apply(this, arguments);
                                }
                            } else if (typeof options[key] == "function") {
                                _params[key] = function() {
                                    defaults[key].apply(this, arguments);
                                    options[key].apply(this, arguments);
                                }
                            } else {
                                _params[key] = defaults[key];
                            }
                        } else {
                            // replace global callback
                            _params[key] = element.getAttribute("data-" + key) || _dataparams[key] || options[key] || defaults[key];
                        }
                    });

                    return _params;
                };

            // get params of each 
            var params_out = params(pageOut),
                params_in = params(pageInto);

            if (pageOut != null && pageOut.classList) {
                // weather prevent transition
                var preventOut = params_out.preventdefault,
                    isPreventOut = false;
                if (typeof preventOut == "string") preventOut = params_out.root[preventOut];
            }
            if (pageInto != null && pageInto.classList) {
                // weather prevent transition
                var preventInto = params_in.preventdefault,
                    isPreventInto = false;
                if (typeof preventInto == "string") preventInto = params_in.root[preventInto];

            }
            if (typeof preventOut == "function") isPreventOut = preventOut.call(params_out.root, pageInto, pageOut, options);

            // if functions of 'preventdefault' are same for pageIn and pageout, just excute once.
            if (isPreventOut == true && preventOut === preventInto) return false;

            if (typeof preventInto == "function") isPreventInto = preventInto.call(params_in.root, pageInto, pageOut, options);
            // if pageinto stopped, stop all
            if (isPreventInto == true) {
                // only run here and nothing more
                return false;
            }

            // set animation callback as a method
            var fun_animationCall = function(page, data) {
                if (page.flagAniBind == true) return;
                // do callback when animation start/end
                ["animationstart", "animationend"].forEach(function(animationkey, index) {
                    var animition = params_in[animationkey],
                        webkitkey = "webkit" + animationkey.replace(/^a|s|e/g, function(matchs) {
                            return matchs.toUpperCase();
                        });
                    var animateEventName = isWebkit ? webkitkey : animationkey;
                    // if it's the out element, hide it when 'animationend'
                    index && page.addEventListener(animateEventName, function() {
                        if (this.classList.contains("in") == false) {
                            this.style.display = "none";
                            // add on v2.5.5
                            // move here on v2.5.8
                            if (this.removeSelf == true) {
                                this.parentElement.removeChild(this);
                                this.removeSelf = null;
                            }
                        }
                        this.classList.remove(params(this).form);
                    });
                    // bind animation events
                    if (typeof animition == "string" && params_in.root[animition]) {
                        page.addEventListener(animateEventName, function() {
                            data.root[animition].call(data.root, this, this.classList.contains("in") ? "into" : "out", options);
                        });
                    } else if (typeof animition == "function") {
                        page.addEventListener(animateEventName, function() {
                            animition.call(data.root, this, this.classList.contains("in") ? "into" : "out", options);
                        });
                    }
                    // set a flag
                    page.flagAniBind = true;
                });
            };

            if (pageOut != null && pageOut.classList) {
                // do transition if there are no 'prevent'
                if (isPreventOut != true) {
                    pageOut.classList.add(params_out.form);
                    // reflow
                    pageOut.offsetWidth = pageOut.offsetWidth;
                    // go, go, go
                    pageOut.style.display = "block";
                    pageOut.classList.add("out");
                    pageOut.classList.remove("in");
                    // if reverse direction
                    pageOut.classList[back ? "add" : "remove"]("reverse");

                    // add on v2.5.5
                    pageOut.removeSelf = pageOut.removeSelf || null;

                    // set animation callback for 'pageInto'
                    // for issues #153
                    fun_animationCall(pageOut, params_out);

                    // do fallback every time
                    var fallback = params_out.fallback;
                    if (typeof fallback == "string") fallback = params_out.root[fallback];
                    if (typeof fallback == "function") fallback.call(params_out.root, pageInto, pageOut, options);
                }
            }

            if (pageInto != null && pageInto.classList) {
                // for title change
                var title = params_in.title,
                    header = document.querySelector("h1"),
                    first_page = document.querySelector("." + this.classPage);

                // do title change  
                if (title && options.title !== false) {
                    document.title = title;
                    if (header) {
                        header.innerHTML = title;
                        header.title = title;
                    }
                } else if (first_page == pageInto && !pageOut && document.title) {
                    // set data-title for first visibie page
                    pageInto.setAttribute("data-title", document.title);
                }

                // delete page with same id when options.remove !== false
                var pageid = options.id || pageInto.id,
                    hashid = options.id || pageInto.id;

                if (options.id) {
                    pageid = pageid.split("?")[0];
                }
                var relid = store["_" + pageid];

                if (options.remove !== false && store[pageid] && store[pageid] != pageInto) {
                    // hashid may store the same page, we should delete also
                    // when data-reload not 'false' or null
                    // v2.4.4+
                    if (relid && store[relid] && options.reload == true) {
                        delete store[relid];
                        delete store["_" + pageid];
                    }

                    if (options.reload == true) {
                        // v2.5.8 for issues #147
                        pageInto.removeSelf = true;
                    }

                    if (store[pageid] != pageOut) {
                        store[pageid].parentElement && store[pageid].parentElement.removeChild(store[pageid]);
                    } else {
                        pageOut.removeSelf = true;
                    }
                    delete store[pageid];
                }


                // do transition
                if (pageOut) pageInto.classList.add(params_in.form);
                // iOS bug 
                // reflow for fixing issues #80, #86
                pageInto.offsetWidth = pageInto.offsetWidth;
                // go~ as normal
                pageInto.style.display = "block";
                pageInto.classList.remove("out");
                pageInto.classList.add("in");
                // if reverse direction
                pageInto.classList[back ? "add" : "remove"]("reverse");

                // do callback when come in first time
                var onpagefirstinto = params_in.onpagefirstinto;
                // first judge change to pageInto store
                // v2.5.5 add for fix issues #138
                if (!pageInto.firstintoBind) {
                    if (typeof onpagefirstinto == "string" && params_in.root[onpagefirstinto]) {
                        params_in.root[onpagefirstinto].call(params_in.root, pageInto, pageOut, options);
                    } else if (typeof onpagefirstinto == "function") {
                        onpagefirstinto.call(params_in.root, pageInto, pageOut, options);
                    }
                    // capture form submit
                    slice.call(pageInto.querySelectorAll("form")).forEach(function(form) {
                        Mobilebone.submit(form);
                    });

                    pageInto.firstintoBind = true;
                }

                // set animation callback for 'pageInto'
                fun_animationCall(pageInto, params_in);

                // history
                // hashid should a full url address
                // different with pageid
                // add on 2.4.2
                var url_push = hashid,
                    url_push_replaced = '';
                if (url_push && /^#/.test(url_push) == false) {
                    url_push = "#" + url_push;
                }
                url_push_replaced = url_push.replace(/^#/, "#&");

                if (supportHistory && this.pushStateEnabled && options.history !== false && url_push
                    // hash should be different
                    // can fix issues #79, #87 maybe
                    && url_push_replaced != location.hash
                ) {
                    // don't trigger 'popstate' events
                    history.popstate = false;
                    // if only pageIn, use 'replaceState'
                    history[pageOut ? "pushState" : "replaceState"](null, document.title, url_push.replace(/^#/, "#&"));
                }

                // store page-id, just once
                if (!store[pageid]) {
                    store[pageid] = pageInto;
                    // when we back/prev, we need to get true 
                    if (hashid !== pageid) {
                        store[hashid] = pageInto;
                        store["_" + pageid] = hashid;
                    }
                }

                // do callback every time
                var callback = params_in.callback;

                if (typeof callback == "string") callback = params_in.root[callback];
                if (typeof callback == "function") callback.call(params_in.root, pageInto, pageOut, options);

                // Safari do 'popstate' after 'pushState/replaceState'
                // So, we neet setTimeout to avoid excuting 'Mobilebone.transition()' twice
                setTimeout(function() {
                    // reset to popable state
                    history.popstate = true;
                }, 17);
            }
        };


        /**
         * For getting whole ajax url
         * In most cases, you are unnecessary to use this function
         
         * @params  trigger: dom-object. element with tag-"a".  - Optional(at least one)
                    url:     string. ajax url.                  - Optional(at least one)
                    params:  string|object. ajax params.        - Optional
         * @returns string
         * @example Mobilebone.getCleanUrl(elementOfA);
                    Mobilebone.getCleanUrl(elementOfForm);
                    Mobilebone.getCleanUrl(elementOfA, '', "a=1&b=2");
                    Mobilebone.getCleanUrl(null, "xxx.html");
                    Mobilebone.getCleanUrl(null, "xxx.html?a=1&b=2");
                    Mobilebone.getCleanUrl(null, "xxx.html", "a=1&b=2");
        **/
        Mobilebone.getCleanUrl = function(trigger, url, params) {
            var href = "",
                formdata = "",
                clean_url = "";
            if (trigger) {
                if (trigger.nodeType == 1) {
                    // form element
                    if (trigger.action) {
                        href = trigger.getAttribute("action");
                        // add on v2.4.1
                        if (trigger.method && trigger.method.toUpperCase() == "POST") {
                            return href;
                        } else if (window.$ && $.fn && $.fn.serialize) {
                            // use jquery serialize()
                            formdata = $(trigger).serialize();
                        } else {
                            formdata = {};
                            // simple serialize from Mobilebone
                            slice.call(trigger.querySelectorAll("input,select,textarea")).forEach(function(control) {
                                if (control.name && !control.disabled) {
                                    var val = control.value.trim(),
                                        name = control.name;
                                    if (/^radio|checkbox/i.test(control.type)) {
                                        if (control.checked) {
                                            if (formdata[name]) {
                                                formdata[name].push(val);
                                            } else {
                                                formdata[name] = [val];
                                            }
                                        }
                                    } else {
                                        formdata[name] = [val];
                                    }
                                }
                            });
                        }
                    } else {
                        // a element
                        href = trigger.getAttribute("href");
                        formdata = trigger.getAttribute("data-formdata") || trigger.getAttribute("data-data") || "";
                        // v2.6.1 for #107
                        // remember container when refresh
                        var str_container = "container",
                            attr_container = trigger.getAttribute("data-" + str_container);
                        if (formdata.indexOf(str_container) == -1 && attr_container) {
                            var query_container = str_container + "=" + attr_container;
                            formdata = formdata ? formdata + "&" + query_container : query_container;
                        }
                    }
                } else if (trigger.url) {
                    href = trigger.url;
                    formdata = trigger.data;
                }
            }

            if (!(href = href || url)) return '';

            // get formdata
            formdata = formdata || params || "";

            if (typeof formdata == "object") {
                var arr_data = [];
                for (key in formdata) {
                    if (!formdata[key].forEach) {
                        formdata[key] = [formdata[key]];
                    }
                    formdata[key].forEach(function(keyValue) {
                        arr_data.push(key + "=" + encodeURIComponent(keyValue));
                    });

                }
                if (arr_data.length > 0) {
                    formdata = arr_data.join("&");
                } else {
                    formdata = "";
                }
            }

            // get url of root
            clean_url = href.split("#")[0].replace(/&+$/, "");

            if (clean_url.slice(-1) == "?") {
                clean_url = clean_url.split("?")[0];
            }
            // url = root_url + joiner + formdata
            if (formdata != "") {
                if (/\?/.test(clean_url)) {
                    formdata = formdata.replace(/^&|\?/, "");
                    clean_url = clean_url + "&" + formdata;
                } else if (formdata != "") {
                    formdata = formdata.replace("?", "");
                    clean_url = clean_url + "?" + formdata;
                }
            }
            return clean_url;
        };

        /**
         * Create page according to given Dom-element or HTML string. And, notice!!!!! will do transition auto.
         
         * @params  domHtml:        dom-object|string. Create this to dom element as a role of into-page.               - Necessary
                    eleOrObj: dom-object|object. '.page element', or 'a element', or 'options' for get out-page   - Optional
                    options:            object.            basically, options = ajax options, of course, u can custom it!   - Optional
         * @returns undefined
         * @example Mobilebone.createPage(pageDom);
                    Mobilebone.createPage(generalDom);
                    Mobilebone.createPage('<div class="page out">xxx</div>');
                    Mobilebone.createPage('<p>xxx</p>');
                    Mobilebone.createPage(pageDom, triggerLink);
                    Mobilebone.createPage(pageDom, { response: '<div...>' });
                    Mobilebone.createPage(pageDom, triggerLink, { response: '<div...>' });
         *
        **/
        Mobilebone.createPage = function(domHtml, eleOrObj, options) {
            var response = null,
                container = null,
                classPage = this.classPage,
                isreload = null;
            // 'eleOrObj' can '.page element', or 'a element', or 'options'
            // basically, options = ajax options, of course, u can custom it!       
            if (!domHtml) return;
            if (typeof options == "undefined" && typeof eleOrObj == "object") {
                options = eleOrObj;
            }
            options = options || {};

            // 'options' that 'Mobilebone.transition()' needs
            var optionsTransition = {};

            // get page-title from eleOrObj or options
            var page_title, id_container, classPageInside;

            if (eleOrObj) {
                if (eleOrObj.nodeType == 1) {
                    // legal elements
                    if (eleOrObj.href || eleOrObj.action) {
                        page_title = eleOrObj.getAttribute("data-title") || options.title;
                    }
                    response = options.response;
                    id_container = eleOrObj.getAttribute("data-container");
                    container = document.getElementById(id_container);
                    classPageInside = eleOrObj.getAttribute("data-classpage");
                    // pass element as target params, add on v2.3.0
                    optionsTransition.target = eleOrObj;
                    // v2.4.4 is_root → isreload
                    isreload = eleOrObj.getAttribute("data-reload");
                    if (eleOrObj.tagName.toLowerCase() == "form" || (isreload !== null && isreload != "false")) {
                        optionsTransition.reload = true;
                    }
                    // v2.5.2
                    // is back? for issues #128
                    optionsTransition.back = eleOrObj.getAttribute("data-rel") == "back";

                    // v2.6.0 history
                    if (eleOrObj.getAttribute("data-history") == "false") {
                        optionsTransition.history = false;
                    }
                } else {
                    response = eleOrObj.response || options.response;
                    page_title = eleOrObj.title || options.title;
                    container = eleOrObj.container || options.container;
                    classPageInside = eleOrObj.classPage || options.classPage;
                    optionsTransition.target = eleOrObj.target;
                    // v2.5.2
                    // is back? for issues #128
                    optionsTransition.back = eleOrObj.back || options.back;
                }
                if (container && classPageInside) classPage = classPageInside;
            }

            // get current page(will be out) according to 'page_or_child'
            var current_page = (classPage == classPageInside ? container : document).querySelector(".in." + classPage);

            // get create page (will be into) according to 'domHtml'
            var create_page = null;

            var create = document.createElement("div");
            if (typeof domHtml == "string") {
                create.innerHTML = domHtml;
            } else {
                create.appendChild(domHtml);
            }

            // excute inline JavaScript
            if (Mobilebone.evalScript == true && domHtml.firstintoBind != true) {
                slice.call(create.getElementsByTagName("script")).forEach(function(originScript) {
                    var scriptContent = originScript.innerHTML.trim(),
                        type = originScript.getAttribute("type");
                    if (scriptContent.trim() == "" || originScript.src) return;
                    var head = document.getElementsByTagName("head")[0] || document.documentElement,
                        script = document.createElement("script");
                    if (type) script.type = type;
                    script.appendChild(document.createTextNode(scriptContent));
                    setTimeout(function() {
                        head.insertBefore(script, head.firstChild);
                        head.removeChild(script);
                        script = null;
                    }, 17);
                    originScript = null;
                });
            }

            var create_title = create.getElementsByTagName("title")[0];

            // get the page element
            if (!(create_page = create.querySelector("." + classPage))) {
                // if there no .page, create as create_page
                create.className = classPage + " out";
                create_page = create;
            }
            // set and store title
            if (typeof page_title == "string") {
                create_page.setAttribute("data-title", page_title);
            } else if (create_title && create_title.innerText) { // the judge behind '&&' for issues #144 
                create_page.setAttribute("data-title", create_title.innerText);
            }

            // insert create page as a last-child
            (container || document.body).appendChild(create_page);

            // release memory
            create = null;

            // do transition
            optionsTransition.response = response || domHtml;
            optionsTransition.id = this.getCleanUrl(eleOrObj) || create_page.id || ("unique" + Date.now());

            // 'if' statement below added on v2.0.0
            if (typeof options == "object") {
                if (typeof options.history != "undefined") {
                    optionsTransition.history = options.history;
                }
                if (typeof options.remove != "undefined") {
                    optionsTransition.remove = options.remove;
                }
                if (typeof options.target != "undefined") {
                    optionsTransition.target = options.target;
                }
                if (typeof options.title != "undefined") {
                    optionsTransition.title = options.title;
                }
            }
            if (classPage == classPageInside) {
                optionsTransition.history = false;
                optionsTransition.classPage = classPage;
            }

            // do transition
            this.transition(create_page, current_page, optionsTransition);
        };

        /**
         * For ajax callback. 
         * For example, data-success="a.b.c". We can't use 'a.b.c' as a function, because it's a string. We should do some work to get it!
         
         * @params  keys:        string. - Necessary
         * @returns function
                    undefined keys is not string
                    window    keys undefined
         * @example Mobilebone.getFunction("a.b.c");
         *
        **/
        Mobilebone.getFunction = function(keys) {
            if (typeof keys != "string") return;
            // eg. 'globalObject.functionName'
            var fun = root,
                arr_key = keys.split(".");
            for (var index = 0; index < arr_key.length; index += 1) {
                if (!(fun = fun[arr_key[index]])) {
                    break;
                }
            }
            return fun;
        };

        /**
         * For ajax request to get HTML or JSON. 
         
         * @params  aOrFormOrObj        - Necessary  
                    1. dom-object:<a>|<form>.
                    2. object.  
         * @returns undefined
         * @example Mobilebone.ajax(document.querySelector("a"));
                    Mobilebone.ajax({
                      url: 'xxx.html',
                      success: function() {}
                    });
         *
        **/
        Mobilebone.ajax = function(aOrFormOrObj) {
            if (!aOrFormOrObj) return;

            // default params
            var defaults = {
                url: "",
                type: "",
                dataType: "",
                data: {},
                timeout: 10000,
                async: true,
                username: "",
                password: "",
                success: function() {},
                error: function() {},
                complete: function() {}
            };

            var params = {},
                ele_mask = null,
                formData = null;

            // if 'aOrFormOrObj' is a element, we should turn it to options-object
            var params_from_trigger = {},
                attr_mask;
            if (aOrFormOrObj.nodeType == 1) {
                params_from_trigger = _queryToObject(aOrFormOrObj.getAttribute("data-params") || "");
                // get params
                for (key in defaults) {
                    // data-* > data-params > defaults
                    params[key] = aOrFormOrObj.getAttribute("data-" + key) || params_from_trigger[key] || defaults[key];
                    if (typeof defaults[key] == "function" && typeof params[key] == "string") {
                        // eg. globalObject.functionName
                        params[key] = this.getFunction(params[key]);
                        if (typeof params[key] != "function") {
                            params[key] = defaults[key];
                        }
                    }
                }

                // address of ajax url
                params.url = this.getCleanUrl(aOrFormOrObj, params.url);
                params.target = aOrFormOrObj;
                // v2.5.2
                // is back? for issues #128
                params.back = aOrFormOrObj.getAttribute("data-rel") == "back";

                var tagName = aOrFormOrObj.tagName.toLowerCase();
                if (tagName == "form") {
                    params.type = aOrFormOrObj.method;

                    formData = new FormData(aOrFormOrObj);
                } else if (tagName == "a") {
                    // v2.5.8 for issues #157
                    var idContainer = aOrFormOrObj.getAttribute("data-container"),
                        classPageInside = aOrFormOrObj.getAttribute("data-classpage"),
                        container = idContainer && document.getElementById(idContainer);
                    if (container && classPageInside && classPageInside != Mobilebone.classPage) {
                        // inner ajax no history change
                        params.history = false;
                        // title do not change
                        params.title = false;
                    }
                }

                // get mask element
                attr_mask = aOrFormOrObj.getAttribute("data-mask");
                if (attr_mask == "true" || attr_mask == "") {
                    ele_mask = aOrFormOrObj.querySelector("." + this.classMask);
                }
            }
            // if 'aOrFormOrObj' is a object
            else if (aOrFormOrObj.url) {
                // get params
                for (key2 in defaults) {
                    params[key2] = aOrFormOrObj[key2] || defaults[key2];
                }
                // get url
                params.url = this.getCleanUrl(null, params.url, params.data);
                // here params.title will become page title;
                params.title = aOrFormOrObj.title;
                // v2.5.2
                // is back? for issues #128
                // when history.back()
                params.back = aOrFormOrObj.back;
                // v2.6.1
                params.container = aOrFormOrObj.container;
            } else {
                return;
            }

            // do ajax
            // get mask and loading element
            var body = container || document.body;
            if (typeof attr_mask != "string") {
                ele_mask = body.querySelector("." + this.classMask);
            }
            if (ele_mask == null) {
                ele_mask = document.createElement("div");
                ele_mask.className = this.classMask;
                ele_mask.innerHTML = '<i class="loading"></i>';
                if (typeof attr_mask == "string") {
                    aOrFormOrObj.appendChild(ele_mask);
                } else {
                    body.appendChild(ele_mask);
                }
            }
            // show loading
            ele_mask.style.display = "block";

            // ajax request
            var xhr = new XMLHttpRequest();
            xhr.open(params.type || "GET", params.url + (/\?/.test(params.url) ? "&" : "?") + "r=" + Date.now(), params.async, params.username, params.password);
            xhr.timeout = params.timeout;

            xhr.onload = function() {
                // so far, many browser hasn't supported responseType = 'json', so, use JSON.parse instead
                var response = null;

                if (xhr.status == 200) {
                    if (params.dataType == "json" || params.dataType == "JSON") {
                        try {
                            response = JSON.parse(xhr.response);
                            params.response = response;
                            Mobilebone.createPage(Mobilebone.jsonHandle(response), aOrFormOrObj, params);
                        } catch (e) {
                            params.message = "JSON parse error：" + e.message;
                            params.error.call(params, xhr, xhr.status);
                        }
                    } else if (params.dataType == "unknown") {
                        // ajax send by url
                        // no history hush                  
                        params.history = false;
                        // I don't remember why add 'params.remove = false' here, 
                        // but it seems that this will cause issues #147
                        // no element remove
                        // del → v2.5.8 // params.remove = false;
                        try {
                            // as json
                            response = JSON.parse(xhr.response);
                            params.response = response;
                            Mobilebone.createPage(Mobilebone.jsonHandle(response), aOrFormOrObj, params);
                        } catch (e) {
                            // as html
                            response = xhr.response;
                            Mobilebone.createPage(response, aOrFormOrObj, params);
                        }
                    } else {
                        response = xhr.response;
                        // 'response' is string
                        Mobilebone.createPage(response, aOrFormOrObj, params);
                    }
                    params.success.call(params, response, xhr.status);
                } else {
                    params.message = "The status code exception!";
                    params.error.call(params, xhr, xhr.status);
                }

                params.complete.call(params, xhr, xhr.status);

                // hide loading
                ele_mask.style.display = "none";
            }

            xhr.onerror = function(e) {
                params.message = "Illegal request address or an unexpected network error!";
                params.error.call(params, xhr, xhr.status);
                // hide loading
                ele_mask.style.display = "none";
            }

            xhr.ontimeout = function() {
                params.message = "The request timeout!";
                params.error.call(params, xhr, xhr.status);
                // hide loading
                ele_mask.style.display = "none";
            };

            // set request header for server
            xhr.setRequestHeader("Type", "ajax");
            xhr.setRequestHeader("From", "mobilebone");

            xhr.send(formData);
        };

        /**
         * capture form submit events to a ajax request.
         
         * @params  form:        formElement. - Necessary
         * @example Mobilebone.form(document.querySelector("form"));
         *
        **/
        Mobilebone.submit = function(form) {
            if (!form || typeof form.action != "string") return;
            var ajax = form.getAttribute("data-ajax");
            if (ajax == "false" || (Mobilebone.captureForm == false && ajax != "true")) return;

            form.addEventListener("submit", function(event) {
                // prevent detect
                var attrPrevent = this.getAttribute("data-preventdefault");
                // get 'preventDefault' function
                var funPrevent = Mobilebone.getFunction(attrPrevent);
                if (typeof funPrevent == "function" && funPrevent(this) == true) {
                    // if the return value of prevent function is true, prevent everything~
                    event.preventDefault();
                    return false;
                }

                Mobilebone.ajax(this);
                event.preventDefault();
            });
        };


        /**
         * Sometime we don't know direction of transition. Such as browser history change, or data-rel="auto".
           In this case, we ensure the direction(back or prev) by the sorts of two pages(into or out)
         
         * @params  page_in  dom-object      - Necessary  
                    page_out  dom-object      - Optional 
                    
         * @returns boolean
         *
        **/
        Mobilebone.isBack = function(page_in, page_out) {
            // back or forword, according to the order of two pages
            if (history.tempBack == true) {
                // backwords
                history.tempBack = null;
                return true;
            }
            if (typeof page_in == "undefined") return true;
            if (!page_out) return false;
            return page_in.compareDocumentPosition(page_out) == 4;
        };

        /**
         * If dataType of ajax is 'json', we can't convert json-data to page-element. 
           So, we export a function names 'jsonHandle' to handle json-data.
         * Attention, it's a global interface. If your project has many json call, you should use JSON itself to make a distinction.
           For example, every JSON include the only json-id:
           {
              "id": "homePage" ,
              "data": []  
           }
           different with
           {
              "id": "listPage" ,
              "data": []  
           }
         *
         * @params  json    - Necessary         
         * @returns dom-object|string
         *
        **/
        Mobilebone.jsonHandle = function(json) {
                return '<p style="text-align:center;">Dear master, if you see me, show that JSON parsing function is undefined!</p>';
            },

            /**
             * Initialization. Load page according to location.hash. And bind link-catch events.
             **/
            Mobilebone.init = function() {
                if (hasInited == true) return 'Don\'t repeat initialization!';

                var hash = location.hash.replace("#&", "#"),
                    ele_in = null,
                    container = null;

                if (hash == "" || hash == "#") {
                    this.transition(document.querySelector("." + this.classPage));
                } else if (isSimple.test(hash) == true && (ele_in = document.querySelector(hash)) && ele_in.classList.contains(this.classPage)) { // 'ele_in' must be a page element
                    this.transition(ele_in);
                } else {
                    // add on v2.6.1
                    if (hash.split("container=").length == 2) {
                        container = document.getElementById(hash.split("container=")[1].split("&")[0]);
                    }
                    // as a ajax
                    this.ajax({
                        url: hash.replace("#", ""),
                        dataType: "unknown",
                        container: container,
                        error: function() {
                            ele_in = document.querySelector("." + Mobilebone.classPage);
                            Mobilebone.transition(ele_in);
                        }
                    });
                }

                // Initialization link-catch events.
                var $ = root.$ || root.jQuery || root.Zepto;
                if ($ && $.fn && $.fn.tap && ('ontouchstart' in window == true)) {
                    // for some unknown 'tap' plugin
                    $(document).tap(this.handleTapEvent);

                    // zepto tap event.preventDefault can't prevent default click-events
                    document.addEventListener("click", function(event) {
                        var target = event.target;
                        if (!target) return;
                        if (target.tagName.toLowerCase() != "a" && !(target = target.getParentElementByTag("a"))) {
                            return;
                        }
                        var ajax = target.getAttribute("data-ajax"),
                            href = target.href;
                        // if not ajax request
                        if (target.getAttribute("data-rel") == "external" || ajax == "false" || (href.replace("://", "").split("/")[0] !== location.href.replace("://", "").split("/")[0] && ajax != "true") || (Mobilebone.captureLink == false && ajax != "true")) {
                            // issues #123 #137 #142
                            if (/^http/i.test(href)) location.href = href;
                            return;
                        }
                        event.preventDefault();
                    });
                } else {
                    document.addEventListener("click", this.handleTapEvent);
                }

                // Important: 
                // In ios7+, swipe the edge of page will navigate Safari
                // that will trigger 'popstate' events and the page will transition twice
                var isSafari7 = !!navigator.userAgent.match(/safari/i) && !navigator.userAgent.match(/chrome/i) && typeof document.hidden !== "undefined" && !window.chrome;
                if ('ontouchstart' in window == true && isSafari7) {
                    document.addEventListener("touchmove", function() {
                        history.popstateswipe = true;
                    });
                    document.addEventListener("touchend", function() {
                        history.popstateswipe = false;
                    });
                }

                // change flag-var for avoiding repeat init
                hasInited = true;
            };

        /**
         * If 'a' element has href, slide auto when tapping~
         **/
        Mobilebone.handleTapEvent = function(event) {
            /**
            // iscroll(set tap: true) may cause twice tap problem 
            // which is none of Mobilebone's business
            // However, you can let code below go to avoid twice tap in Mobilebone
            // but the tap event bind out of Mobilebone also has bug
            // so my advice is that: 
            // 1. use Date.now to judge as Mobilebone did; 
            // or
            // 2. keep this code in the form of comment and fixed bug outside
            if (store.timerTap && Date.now() - store.timerTap < 100) {  
                event.preventDefault();
                return false;
            }
            store.timerTap = Date.now();
            */
            var target = null;
            // you can pass target as params directly
            if (event && event.nodeType == 1) {
                target = event;
                target.preventDefault = function() {};
            }
            // get target and href
            target = target || event.target || event.touches[0], href = target.href;
            if ((!href || /a/i.test(target.tagName) == false) && (target = target.getParentElementByTag("a"))) {
                href = target.href;
            }
            // the page that current touched or actived
            var self_page = document.querySelector(".in." + Mobilebone.classPage);

            if (self_page == null || !target) return;

            // optional params for Mobilebone.transition
            var options = {
                target: target
            };

            // prevent detect
            var attrPrevent = target.getAttribute("data-preventdefault") || _queryToObject(target.getAttribute("data-params") || "").preventdefault;
            // get 'preventDefault' function
            var funPrevent = Mobilebone.getFunction(attrPrevent);
            if (typeof funPrevent == "function" && funPrevent(target) == true) {
                // if the return value of prevent function is true, prevent everything~
                event.preventDefault();
                return false;
            }

            // if mask element exist and displaying, prevent double trigger
            var ele_mask = target.getElementsByClassName(Mobilebone.classMask)[0];
            if (ele_mask && ele_mask.style.display != "none") {
                event.preventDefault();
                return false;
            }

            var idContainer = target.getAttribute("data-container"),
                classPageInside = target.getAttribute("data-classpage"),
                container = idContainer && document.getElementById(idContainer);
            if (container && classPageInside && classPageInside != Mobilebone.classPage) {
                self_page = container.querySelector(".in." + classPageInside) || container.querySelector(classPageInside);
                // if (self_page == null) return false;
                options.history = false;
                options.title = false;
                options.classPage = classPageInside;
            }

            // if captureLink
            var capture = (Mobilebone.captureLink == true);
            // get rel
            var rel = target.getAttribute("data-rel");
            // if back
            var back = false;
            if (rel == "back") {
                back = true;
            }

            // if external link
            var external = (rel == "external");

            // if the 'href' is not legal, return
            // include:
            // 1. undefined
            // 2. javascript: (except data-rel="back")
            // 3. cros, or not capture (except data-ajax="true")
            if (!href) return;

            href = href.replace("#&", "#");

            if (target.getAttribute("href").replace(/#/g, "") === "") {
                event.preventDefault();
                return;
            }
            if (/^javascript/.test(href)) {
                if (back == false) return;
            } else {
                external = external || (href.replace("://", "").split("/")[0] !== location.href.replace("://", "").split("/")[0]);
                if ((external == true || capture == false) && target.getAttribute("data-ajax") != "true") return;
            }

            // judge that if it's a ajax request
            if (/^#/.test(target.getAttribute("href")) == true) {
                // hash slide
                var idTargetPage = href.split("#")[1],
                    eleTargetPage = idTargetPage && document.getElementById(idTargetPage);
                if (back == false && rel == "auto") {
                    back = Mobilebone.isBack(eleTargetPage, self_page);
                }

                if (eleTargetPage) {
                    Mobilebone.transition(eleTargetPage, self_page, back, options);
                }
                event.preventDefault();
            } else if (/^javascript/.test(href)) {
                // back
                history.tempBack = true;
                history.back();
            } else if (target.getAttribute("data-ajax") != "false") {
                // get a clean ajax url as page id
                var clean_url = Mobilebone.getCleanUrl(target);

                // if has loaded and the value of 'data-reload' is not 'true'
                var attr_reload = target.getAttribute("data-reload"),
                    id = target.getAttribute("href");

                if ((attr_reload == null || attr_reload == "false") && store[clean_url]) {
                    if (back == false && rel == "auto") {
                        back = Mobilebone.isBack(store[clean_url], self_page);
                    }
                    options.id = clean_url;

                    var body = container || document.body;

                    if (body.contains(store[clean_url]) == false) {
                        body.appendChild(store[clean_url]);
                    }
                    Mobilebone.transition(store[clean_url], self_page, back, options);
                } else {
                    Mobilebone.ajax(target);
                }
                event.preventDefault();
            }
        };


        /**
         * prototype extend method: get parent element by tagName
         **/
        Element.prototype.getParentElementByTag = function(tag) {
            if (!tag) return null;
            var element = null,
                parent = this;
            var popup = function() {
                parent = parent.parentElement;
                if (!parent) return null;
                var tagParent = parent.tagName.toLowerCase();
                if (tagParent === tag) {
                    element = parent;
                } else if (tagParent == "body") {
                    element = null;
                } else {
                    popup();
                }
            };
            popup();
            return element;
        };

        /**
         * private method: convert query string to key-value object
         **/
        var _queryToObject = function(string) {
            var obj = {};
            if (typeof string == "string") {
                string.split("&").forEach(function(part) {
                    var arr_part = part.split("=");
                    if (arr_part.length > 1) {
                        obj[arr_part[0]] = part.replace(arr_part[0] + "=", "");
                    }
                });
            }
            return obj;
        };

        /**
         * auto init
         **/
        window.addEventListener("DOMContentLoaded", function() {
            if (hasInited == false) {
                Mobilebone.init();
            }
        });

        /**
         * page change when history change
         **/
        window.addEventListener("popstate", function() {
            if (history.popstateswipe == true) {
                location.reload();
                history.popstateswipe = false;
                return;
            }
            if (history.popstate == false) {
                history.popstate = true;
                return;
            }

            var hash = location.hash.replace("#&", "").replace(/^#/, ""),
                page_in = null
                // add on v2.6.1
                ,
                container = null;

            if (hash == "") {
                // if no hash, get first page as 'page_in'
                page_in = document.querySelector("." + Mobilebone.classPage);
                if (page_in.id) return;
            } else {
                page_in = store[hash];

                // add on v2.6.1
                if (hash.split("container=").length == 2) {
                    container = document.getElementById(hash.split("container=")[1].split("&")[0]);
                }

                if (page_in && isSimple.test(hash) == false) {
                    // ajax store
                    Mobilebone.createPage(page_in, {
                        url: hash,
                        dataType: "unknown",
                        history: false,
                        back: true,
                        container: container
                    });
                    return;
                }
            }

            if (!page_in) {
                if (isSimple.test(hash) == false) {
                    // as a url
                    Mobilebone.ajax({
                        url: hash,
                        dataType: "unknown",
                        back: Mobilebone.isBack(),
                        container: container
                    });
                    return;
                }
                page_in = document.querySelector("#" + hash)
            }

            var page_out = document.querySelector(".in." + Mobilebone.classPage);

            if ((page_in && page_in == page_out) || Mobilebone.pushStateEnabled == false) return;

            // hash ↔ id                                                    
            if (page_in) {
                Mobilebone.transition(page_in, page_out, Mobilebone.isBack(page_in, page_out), {
                    id: hash, // fix issue #83
                    history: false,
                    remove: false
                });
            }
        });

        document.MBLOADED = true;

        return Mobilebone;
    })();

    window.Mobilebone = Mobilebone;

    return Mobilebone;
})
/******************************************************************************
 * MLBF 0.0.1 2015-05-27 
 * author hongri
 ******************************************************************************/

MLBF.define('lib.Zepto', function(require) {

    /* Zepto v1.1.6 - zepto event ajax form ie - zeptojs.com/license */

    var Zepto = (function() {
        var undefined, key, $, classList, emptyArray = [],
            slice = emptyArray.slice,
            filter = emptyArray.filter,
            document = window.document,
            elementDisplay = {},
            classCache = {},
            cssNumber = {
                'column-count': 1,
                'columns': 1,
                'font-weight': 1,
                'line-height': 1,
                'opacity': 1,
                'z-index': 1,
                'zoom': 1
            },
            fragmentRE = /^\s*<(\w+|!)[^>]*>/,
            singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
            tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
            rootNodeRE = /^(?:body|html)$/i,
            capitalRE = /([A-Z])/g,

            // special attributes that should be get/set via method calls
            methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

            adjacencyOperators = ['after', 'prepend', 'before', 'append'],
            table = document.createElement('table'),
            tableRow = document.createElement('tr'),
            containers = {
                'tr': document.createElement('tbody'),
                'tbody': table,
                'thead': table,
                'tfoot': table,
                'td': tableRow,
                'th': tableRow,
                '*': document.createElement('div')
            },
            readyRE = /complete|loaded|interactive/,
            simpleSelectorRE = /^[\w-]*$/,
            class2type = {},
            toString = class2type.toString,
            zepto = {},
            camelize, uniq,
            tempParent = document.createElement('div'),
            propMap = {
                'tabindex': 'tabIndex',
                'readonly': 'readOnly',
                'for': 'htmlFor',
                'class': 'className',
                'maxlength': 'maxLength',
                'cellspacing': 'cellSpacing',
                'cellpadding': 'cellPadding',
                'rowspan': 'rowSpan',
                'colspan': 'colSpan',
                'usemap': 'useMap',
                'frameborder': 'frameBorder',
                'contenteditable': 'contentEditable'
            },
            isArray = Array.isArray ||
            function(object) {
                return object instanceof Array
            }

        zepto.matches = function(element, selector) {
            if (!selector || !element || element.nodeType !== 1) return false
            var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector ||
                element.oMatchesSelector || element.matchesSelector
            if (matchesSelector) return matchesSelector.call(element, selector)
                // fall back to performing a selector:
            var match, parent = element.parentNode,
                temp = !parent
            if (temp)(parent = tempParent).appendChild(element)
            match = ~zepto.qsa(parent, selector).indexOf(element)
            temp && tempParent.removeChild(element)
            return match
        }

        function type(obj) {
            return obj == null ? String(obj) :
                class2type[toString.call(obj)] || "object"
        }

        function isFunction(value) {
            return type(value) == "function"
        }

        function isWindow(obj) {
            return obj != null && obj == obj.window
        }

        function isDocument(obj) {
            return obj != null && obj.nodeType == obj.DOCUMENT_NODE
        }

        function isObject(obj) {
            return type(obj) == "object"
        }

        function isPlainObject(obj) {
            return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
        }

        function likeArray(obj) {
            return typeof obj.length == 'number'
        }

        function compact(array) {
            return filter.call(array, function(item) {
                return item != null
            })
        }

        function flatten(array) {
            return array.length > 0 ? $.fn.concat.apply([], array) : array
        }
        camelize = function(str) {
            return str.replace(/-+(.)?/g, function(match, chr) {
                return chr ? chr.toUpperCase() : ''
            })
        }

        function dasherize(str) {
            return str.replace(/::/g, '/')
                .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
                .replace(/([a-z\d])([A-Z])/g, '$1_$2')
                .replace(/_/g, '-')
                .toLowerCase()
        }
        uniq = function(array) {
            return filter.call(array, function(item, idx) {
                return array.indexOf(item) == idx
            })
        }

        function classRE(name) {
            return name in classCache ?
                classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
        }

        function maybeAddPx(name, value) {
            return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
        }

        function defaultDisplay(nodeName) {
            var element, display
            if (!elementDisplay[nodeName]) {
                element = document.createElement(nodeName)
                document.body.appendChild(element)
                display = getComputedStyle(element, '').getPropertyValue("display")
                element.parentNode.removeChild(element)
                display == "none" && (display = "block")
                elementDisplay[nodeName] = display
            }
            return elementDisplay[nodeName]
        }

        function children(element) {
            return 'children' in element ?
                slice.call(element.children) :
                $.map(element.childNodes, function(node) {
                    if (node.nodeType == 1) return node
                })
        }

        // `$.zepto.fragment` takes a html string and an optional tag name
        // to generate DOM nodes nodes from the given html string.
        // The generated DOM nodes are returned as an array.
        // This function can be overriden in plugins for example to make
        // it compatible with browsers that don't support the DOM fully.
        zepto.fragment = function(html, name, properties) {
            var dom, nodes, container

            // A special case optimization for a single tag
            if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))

            if (!dom) {
                if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
                if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
                if (!(name in containers)) name = '*'

                container = containers[name]
                container.innerHTML = '' + html
                dom = $.each(slice.call(container.childNodes), function() {
                    container.removeChild(this)
                })
            }

            if (isPlainObject(properties)) {
                nodes = $(dom)
                $.each(properties, function(key, value) {
                    if (methodAttributes.indexOf(key) > -1) nodes[key](value)
                    else nodes.attr(key, value)
                })
            }

            return dom
        }

        // `$.zepto.Z` swaps out the prototype of the given `dom` array
        // of nodes with `$.fn` and thus supplying all the Zepto functions
        // to the array. Note that `__proto__` is not supported on Internet
        // Explorer. This method can be overriden in plugins.
        zepto.Z = function(dom, selector) {
            dom = dom || []
            dom.__proto__ = $.fn
            dom.selector = selector || ''
            return dom
        }

        // `$.zepto.isZ` should return `true` if the given object is a Zepto
        // collection. This method can be overriden in plugins.
        zepto.isZ = function(object) {
            return object instanceof zepto.Z
        }

        // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
        // takes a CSS selector and an optional context (and handles various
        // special cases).
        // This method can be overriden in plugins.
        zepto.init = function(selector, context) {
            var dom
                // If nothing given, return an empty Zepto collection
            if (!selector) return zepto.Z()
                // Optimize for string selectors
            else if (typeof selector == 'string') {
                selector = selector.trim()
                    // If it's a html fragment, create nodes from it
                    // Note: In both Chrome 21 and Firefox 15, DOM error 12
                    // is thrown if the fragment doesn't begin with <
                if (selector[0] == '<' && fragmentRE.test(selector))
                    dom = zepto.fragment(selector, RegExp.$1, context), selector = null
                    // If there's a context, create a collection on that context first, and select
                    // nodes from there
                else if (context !== undefined) return $(context).find(selector)
                    // If it's a CSS selector, use it to select nodes.
                else dom = zepto.qsa(document, selector)
            }
            // If a function is given, call it when the DOM is ready
            else if (isFunction(selector)) return $(document).ready(selector)
                // If a Zepto collection is given, just return it
            else if (zepto.isZ(selector)) return selector
            else {
                // normalize array if an array of nodes is given
                if (isArray(selector)) dom = compact(selector)
                    // Wrap DOM nodes.
                else if (isObject(selector))
                    dom = [selector], selector = null
                    // If it's a html fragment, create nodes from it
                else if (fragmentRE.test(selector))
                    dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
                    // If there's a context, create a collection on that context first, and select
                    // nodes from there
                else if (context !== undefined) return $(context).find(selector)
                    // And last but no least, if it's a CSS selector, use it to select nodes.
                else dom = zepto.qsa(document, selector)
            }
            // create a new Zepto collection from the nodes found
            return zepto.Z(dom, selector)
        }

        // `$` will be the base `Zepto` object. When calling this
        // function just call `$.zepto.init, which makes the implementation
        // details of selecting nodes and creating Zepto collections
        // patchable in plugins.
        $ = function(selector, context) {
            return zepto.init(selector, context)
        }

        function extend(target, source, deep) {
            for (key in source)
                if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
                    if (isPlainObject(source[key]) && !isPlainObject(target[key]))
                        target[key] = {}
                    if (isArray(source[key]) && !isArray(target[key]))
                        target[key] = []
                    extend(target[key], source[key], deep)
                } else if (source[key] !== undefined) target[key] = source[key]
        }

        // Copy all but undefined properties from one or more
        // objects to the `target` object.
        $.extend = function(target) {
            var deep, args = slice.call(arguments, 1)
            if (typeof target == 'boolean') {
                deep = target
                target = args.shift()
            }
            args.forEach(function(arg) {
                extend(target, arg, deep)
            })
            return target
        }

        // `$.zepto.qsa` is Zepto's CSS selector implementation which
        // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
        // This method can be overriden in plugins.
        zepto.qsa = function(element, selector) {
            var found,
                maybeID = selector[0] == '#',
                maybeClass = !maybeID && selector[0] == '.',
                nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
                isSimple = simpleSelectorRE.test(nameOnly)
            return (isDocument(element) && isSimple && maybeID) ?
                ((found = element.getElementById(nameOnly)) ? [found] : []) :
                (element.nodeType !== 1 && element.nodeType !== 9) ? [] :
                slice.call(
                    isSimple && !maybeID ?
                    maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
                    element.getElementsByTagName(selector) : // Or a tag
                    element.querySelectorAll(selector) // Or it's not simple, and we need to query all
                )
        }

        function filtered(nodes, selector) {
            return selector == null ? $(nodes) : $(nodes).filter(selector)
        }

        $.contains = document.documentElement.contains ?
            function(parent, node) {
                return parent !== node && parent.contains(node)
            } :
            function(parent, node) {
                while (node && (node = node.parentNode))
                    if (node === parent) return true
                return false
            }

        function funcArg(context, arg, idx, payload) {
            return isFunction(arg) ? arg.call(context, idx, payload) : arg
        }

        function setAttribute(node, name, value) {
            value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
        }

        // access className property while respecting SVGAnimatedString
        function className(node, value) {
            var klass = node.className || '',
                svg = klass && klass.baseVal !== undefined

            if (value === undefined) return svg ? klass.baseVal : klass
            svg ? (klass.baseVal = value) : (node.className = value)
        }

        // "true"  => true
        // "false" => false
        // "null"  => null
        // "42"    => 42
        // "42.5"  => 42.5
        // "08"    => "08"
        // JSON    => parse if valid
        // String  => self
        function deserializeValue(value) {
            try {
                return value ?
                    value == "true" ||
                    (value == "false" ? false :
                        value == "null" ? null :
                        +value + "" == value ? +value :
                        /^[\[\{]/.test(value) ? $.parseJSON(value) :
                        value) : value
            } catch (e) {
                return value
            }
        }

        $.type = type
        $.isFunction = isFunction
        $.isWindow = isWindow
        $.isArray = isArray
        $.isPlainObject = isPlainObject

        $.isEmptyObject = function(obj) {
            var name
            for (name in obj) return false
            return true
        }

        $.inArray = function(elem, array, i) {
            return emptyArray.indexOf.call(array, elem, i)
        }

        $.camelCase = camelize
        $.trim = function(str) {
            return str == null ? "" : String.prototype.trim.call(str)
        }

        // plugin compatibility
        $.uuid = 0
        $.support = {}
        $.expr = {}

        $.map = function(elements, callback) {
            var value, values = [],
                i, key
            if (likeArray(elements))
                for (i = 0; i < elements.length; i++) {
                    value = callback(elements[i], i)
                    if (value != null) values.push(value)
                } else
                for (key in elements) {
                    value = callback(elements[key], key)
                    if (value != null) values.push(value)
                }
            return flatten(values)
        }

        $.each = function(elements, callback) {
            var i, key
            if (likeArray(elements)) {
                for (i = 0; i < elements.length; i++)
                    if (callback.call(elements[i], i, elements[i]) === false) return elements
            } else {
                for (key in elements)
                    if (callback.call(elements[key], key, elements[key]) === false) return elements
            }

            return elements
        }

        $.grep = function(elements, callback) {
            return filter.call(elements, callback)
        }

        if (window.JSON) $.parseJSON = JSON.parse

        // Populate the class2type map
        $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
            class2type["[object " + name + "]"] = name.toLowerCase()
        })

        // Define methods that will be available on all
        // Zepto collections
        $.fn = {
            // Because a collection acts like an array
            // copy over these useful array functions.
            forEach: emptyArray.forEach,
            reduce: emptyArray.reduce,
            push: emptyArray.push,
            sort: emptyArray.sort,
            indexOf: emptyArray.indexOf,
            concat: emptyArray.concat,

            // `map` and `slice` in the jQuery API work differently
            // from their array counterparts
            map: function(fn) {
                return $($.map(this, function(el, i) {
                    return fn.call(el, i, el)
                }))
            },
            slice: function() {
                return $(slice.apply(this, arguments))
            },

            ready: function(callback) {
                // need to check if document.body exists for IE as that browser reports
                // document ready when it hasn't yet created the body element
                if (readyRE.test(document.readyState) && document.body) callback($)
                else document.addEventListener('DOMContentLoaded', function() {
                    callback($)
                }, false)
                return this
            },
            get: function(idx) {
                return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
            },
            toArray: function() {
                return this.get()
            },
            size: function() {
                return this.length
            },
            remove: function() {
                return this.each(function() {
                    if (this.parentNode != null)
                        this.parentNode.removeChild(this)
                })
            },
            each: function(callback) {
                emptyArray.every.call(this, function(el, idx) {
                    return callback.call(el, idx, el) !== false
                })
                return this
            },
            filter: function(selector) {
                if (isFunction(selector)) return this.not(this.not(selector))
                return $(filter.call(this, function(element) {
                    return zepto.matches(element, selector)
                }))
            },
            add: function(selector, context) {
                return $(uniq(this.concat($(selector, context))))
            },
            is: function(selector) {
                return this.length > 0 && zepto.matches(this[0], selector)
            },
            not: function(selector) {
                var nodes = []
                if (isFunction(selector) && selector.call !== undefined)
                    this.each(function(idx) {
                        if (!selector.call(this, idx)) nodes.push(this)
                    })
                else {
                    var excludes = typeof selector == 'string' ? this.filter(selector) :
                        (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
                    this.forEach(function(el) {
                        if (excludes.indexOf(el) < 0) nodes.push(el)
                    })
                }
                return $(nodes)
            },
            has: function(selector) {
                return this.filter(function() {
                    return isObject(selector) ?
                        $.contains(this, selector) :
                        $(this).find(selector).size()
                })
            },
            eq: function(idx) {
                return idx === -1 ? this.slice(idx) : this.slice(idx, +idx + 1)
            },
            first: function() {
                var el = this[0]
                return el && !isObject(el) ? el : $(el)
            },
            last: function() {
                var el = this[this.length - 1]
                return el && !isObject(el) ? el : $(el)
            },
            find: function(selector) {
                var result, $this = this
                if (!selector) result = $()
                else if (typeof selector == 'object')
                    result = $(selector).filter(function() {
                        var node = this
                        return emptyArray.some.call($this, function(parent) {
                            return $.contains(parent, node)
                        })
                    })
                else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
                else result = this.map(function() {
                    return zepto.qsa(this, selector)
                })
                return result
            },
            closest: function(selector, context) {
                var node = this[0],
                    collection = false
                if (typeof selector == 'object') collection = $(selector)
                while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
                    node = node !== context && !isDocument(node) && node.parentNode
                return $(node)
            },
            parents: function(selector) {
                var ancestors = [],
                    nodes = this
                while (nodes.length > 0)
                    nodes = $.map(nodes, function(node) {
                        if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
                            ancestors.push(node)
                            return node
                        }
                    })
                return filtered(ancestors, selector)
            },
            parent: function(selector) {
                return filtered(uniq(this.pluck('parentNode')), selector)
            },
            children: function(selector) {
                return filtered(this.map(function() {
                    return children(this)
                }), selector)
            },
            contents: function() {
                return this.map(function() {
                    return slice.call(this.childNodes)
                })
            },
            siblings: function(selector) {
                return filtered(this.map(function(i, el) {
                    return filter.call(children(el.parentNode), function(child) {
                        return child !== el
                    })
                }), selector)
            },
            empty: function() {
                return this.each(function() {
                    this.innerHTML = ''
                })
            },
            // `pluck` is borrowed from Prototype.js
            pluck: function(property) {
                return $.map(this, function(el) {
                    return el[property]
                })
            },
            show: function() {
                return this.each(function() {
                    this.style.display == "none" && (this.style.display = '')
                    if (getComputedStyle(this, '').getPropertyValue("display") == "none")
                        this.style.display = defaultDisplay(this.nodeName)
                })
            },
            replaceWith: function(newContent) {
                return this.before(newContent).remove()
            },
            wrap: function(structure) {
                var func = isFunction(structure)
                if (this[0] && !func)
                    var dom = $(structure).get(0),
                        clone = dom.parentNode || this.length > 1

                return this.each(function(index) {
                    $(this).wrapAll(
                        func ? structure.call(this, index) :
                        clone ? dom.cloneNode(true) : dom
                    )
                })
            },
            wrapAll: function(structure) {
                if (this[0]) {
                    $(this[0]).before(structure = $(structure))
                    var children
                        // drill down to the inmost element
                    while ((children = structure.children()).length) structure = children.first()
                    $(structure).append(this)
                }
                return this
            },
            wrapInner: function(structure) {
                var func = isFunction(structure)
                return this.each(function(index) {
                    var self = $(this),
                        contents = self.contents(),
                        dom = func ? structure.call(this, index) : structure
                    contents.length ? contents.wrapAll(dom) : self.append(dom)
                })
            },
            unwrap: function() {
                this.parent().each(function() {
                    $(this).replaceWith($(this).children())
                })
                return this
            },
            clone: function() {
                return this.map(function() {
                    return this.cloneNode(true)
                })
            },
            hide: function() {
                return this.css("display", "none")
            },
            toggle: function(setting) {
                return this.each(function() {
                    var el = $(this);
                    (setting === undefined ? el.css("display") == "none" : setting) ? el.show(): el.hide()
                })
            },
            prev: function(selector) {
                return $(this.pluck('previousElementSibling')).filter(selector || '*')
            },
            next: function(selector) {
                return $(this.pluck('nextElementSibling')).filter(selector || '*')
            },
            html: function(html) {
                return 0 in arguments ?
                    this.each(function(idx) {
                        var originHtml = this.innerHTML
                        $(this).empty().append(funcArg(this, html, idx, originHtml))
                    }) :
                    (0 in this ? this[0].innerHTML : null)
            },
            text: function(text) {
                return 0 in arguments ?
                    this.each(function(idx) {
                        var newText = funcArg(this, text, idx, this.textContent)
                        this.textContent = newText == null ? '' : '' + newText
                    }) :
                    (0 in this ? this[0].textContent : null)
            },
            attr: function(name, value) {
                var result
                return (typeof name == 'string' && !(1 in arguments)) ?
                    (!this.length || this[0].nodeType !== 1 ? undefined :
                        (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
                    ) :
                    this.each(function(idx) {
                        if (this.nodeType !== 1) return
                        if (isObject(name))
                            for (key in name) setAttribute(this, key, name[key])
                        else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
                    })
            },
            removeAttr: function(name) {
                return this.each(function() {
                    this.nodeType === 1 && name.split(' ').forEach(function(attribute) {
                        setAttribute(this, attribute)
                    }, this)
                })
            },
            prop: function(name, value) {
                name = propMap[name] || name
                return (1 in arguments) ?
                    this.each(function(idx) {
                        this[name] = funcArg(this, value, idx, this[name])
                    }) :
                    (this[0] && this[0][name])
            },
            data: function(name, value) {
                var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

                var data = (1 in arguments) ?
                    this.attr(attrName, value) :
                    this.attr(attrName)

                return data !== null ? deserializeValue(data) : undefined
            },
            val: function(value) {
                return 0 in arguments ?
                    this.each(function(idx) {
                        this.value = funcArg(this, value, idx, this.value)
                    }) :
                    (this[0] && (this[0].multiple ?
                        $(this[0]).find('option').filter(function() {
                            return this.selected
                        }).pluck('value') :
                        this[0].value))
            },
            offset: function(coordinates) {
                if (coordinates) return this.each(function(index) {
                    var $this = $(this),
                        coords = funcArg(this, coordinates, index, $this.offset()),
                        parentOffset = $this.offsetParent().offset(),
                        props = {
                            top: coords.top - parentOffset.top,
                            left: coords.left - parentOffset.left
                        }

                    if ($this.css('position') == 'static') props['position'] = 'relative'
                    $this.css(props)
                })
                if (!this.length) return null
                var obj = this[0].getBoundingClientRect()
                return {
                    left: obj.left + window.pageXOffset,
                    top: obj.top + window.pageYOffset,
                    width: Math.round(obj.width),
                    height: Math.round(obj.height)
                }
            },
            css: function(property, value) {
                if (arguments.length < 2) {
                    var computedStyle, element = this[0]
                    if (!element) return
                    computedStyle = getComputedStyle(element, '')
                    if (typeof property == 'string')
                        return element.style[camelize(property)] || computedStyle.getPropertyValue(property)
                    else if (isArray(property)) {
                        var props = {}
                        $.each(property, function(_, prop) {
                            props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
                        })
                        return props
                    }
                }

                var css = ''
                if (type(property) == 'string') {
                    if (!value && value !== 0)
                        this.each(function() {
                            this.style.removeProperty(dasherize(property))
                        })
                    else
                        css = dasherize(property) + ":" + maybeAddPx(property, value)
                } else {
                    for (key in property)
                        if (!property[key] && property[key] !== 0)
                            this.each(function() {
                                this.style.removeProperty(dasherize(key))
                            })
                        else
                            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
                }

                return this.each(function() {
                    this.style.cssText += ';' + css
                })
            },
            index: function(element) {
                return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
            },
            hasClass: function(name) {
                if (!name) return false
                return emptyArray.some.call(this, function(el) {
                    return this.test(className(el))
                }, classRE(name))
            },
            addClass: function(name) {
                if (!name) return this
                return this.each(function(idx) {
                    if (!('className' in this)) return
                    classList = []
                    var cls = className(this),
                        newName = funcArg(this, name, idx, cls)
                    newName.split(/\s+/g).forEach(function(klass) {
                        if (!$(this).hasClass(klass)) classList.push(klass)
                    }, this)
                    classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
                })
            },
            removeClass: function(name) {
                return this.each(function(idx) {
                    if (!('className' in this)) return
                    if (name === undefined) return className(this, '')
                    classList = className(this)
                    funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass) {
                        classList = classList.replace(classRE(klass), " ")
                    })
                    className(this, classList.trim())
                })
            },
            toggleClass: function(name, when) {
                if (!name) return this
                return this.each(function(idx) {
                    var $this = $(this),
                        names = funcArg(this, name, idx, className(this))
                    names.split(/\s+/g).forEach(function(klass) {
                        (when === undefined ? !$this.hasClass(klass) : when) ?
                        $this.addClass(klass): $this.removeClass(klass)
                    })
                })
            },
            scrollTop: function(value) {
                if (!this.length) return
                var hasScrollTop = 'scrollTop' in this[0]
                if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
                return this.each(hasScrollTop ?
                    function() {
                        this.scrollTop = value
                    } :
                    function() {
                        this.scrollTo(this.scrollX, value)
                    })
            },
            scrollLeft: function(value) {
                if (!this.length) return
                var hasScrollLeft = 'scrollLeft' in this[0]
                if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
                return this.each(hasScrollLeft ?
                    function() {
                        this.scrollLeft = value
                    } :
                    function() {
                        this.scrollTo(value, this.scrollY)
                    })
            },
            position: function() {
                if (!this.length) return

                var elem = this[0],
                    // Get *real* offsetParent
                    offsetParent = this.offsetParent(),
                    // Get correct offsets
                    offset = this.offset(),
                    parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? {
                        top: 0,
                        left: 0
                    } : offsetParent.offset()

                // Subtract element margins
                // note: when an element has margin: auto the offsetLeft and marginLeft
                // are the same in Safari causing offset.left to incorrectly be 0
                offset.top -= parseFloat($(elem).css('margin-top')) || 0
                offset.left -= parseFloat($(elem).css('margin-left')) || 0

                // Add offsetParent borders
                parentOffset.top += parseFloat($(offsetParent[0]).css('border-top-width')) || 0
                parentOffset.left += parseFloat($(offsetParent[0]).css('border-left-width')) || 0

                // Subtract the two offsets
                return {
                    top: offset.top - parentOffset.top,
                    left: offset.left - parentOffset.left
                }
            },
            offsetParent: function() {
                return this.map(function() {
                    var parent = this.offsetParent || document.body
                    while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
                        parent = parent.offsetParent
                    return parent
                })
            }
        }

        // for now
        $.fn.detach = $.fn.remove

        // Generate the `width` and `height` functions
        ;
        ['width', 'height'].forEach(function(dimension) {
            var dimensionProperty =
                dimension.replace(/./, function(m) {
                    return m[0].toUpperCase()
                })

            $.fn[dimension] = function(value) {
                var offset, el = this[0]
                if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
                    isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
                    (offset = this.offset()) && offset[dimension]
                else return this.each(function(idx) {
                    el = $(this)
                    el.css(dimension, funcArg(this, value, idx, el[dimension]()))
                })
            }
        })

        function traverseNode(node, fun) {
            fun(node)
            for (var i = 0, len = node.childNodes.length; i < len; i++)
                traverseNode(node.childNodes[i], fun)
        }

        // Generate the `after`, `prepend`, `before`, `append`,
        // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
        adjacencyOperators.forEach(function(operator, operatorIndex) {
            var inside = operatorIndex % 2 //=> prepend, append

            $.fn[operator] = function() {
                // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
                var argType, nodes = $.map(arguments, function(arg) {
                        argType = type(arg)
                        return argType == "object" || argType == "array" || arg == null ?
                            arg : zepto.fragment(arg)
                    }),
                    parent, copyByClone = this.length > 1
                if (nodes.length < 1) return this

                return this.each(function(_, target) {
                    parent = inside ? target : target.parentNode

                    // convert all methods to a "before" operation
                    target = operatorIndex == 0 ? target.nextSibling :
                        operatorIndex == 1 ? target.firstChild :
                        operatorIndex == 2 ? target :
                        null

                    var parentInDocument = $.contains(document.documentElement, parent)

                    nodes.forEach(function(node) {
                        if (copyByClone) node = node.cloneNode(true)
                        else if (!parent) return $(node).remove()

                        parent.insertBefore(node, target)
                        if (parentInDocument) traverseNode(node, function(el) {
                            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
                                (!el.type || el.type === 'text/javascript') && !el.src)
                                window['eval'].call(window, el.innerHTML)
                        })
                    })
                })
            }

            // after    => insertAfter
            // prepend  => prependTo
            // before   => insertBefore
            // append   => appendTo
            $.fn[inside ? operator + 'To' : 'insert' + (operatorIndex ? 'Before' : 'After')] = function(html) {
                $(html)[operator](this)
                return this
            }
        })

        zepto.Z.prototype = $.fn

        // Export internal API functions in the `$.zepto` namespace
        zepto.uniq = uniq
        zepto.deserializeValue = deserializeValue
        $.zepto = zepto

        return $
    })()

    window.Zepto = Zepto
    window.$ === undefined && (window.$ = Zepto)

    ;
    (function($) {
        var _zid = 1,
            undefined,
            slice = Array.prototype.slice,
            isFunction = $.isFunction,
            isString = function(obj) {
                return typeof obj == 'string'
            },
            handlers = {},
            specialEvents = {},
            focusinSupported = 'onfocusin' in window,
            focus = {
                focus: 'focusin',
                blur: 'focusout'
            },
            hover = {
                mouseenter: 'mouseover',
                mouseleave: 'mouseout'
            }

        specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

        function zid(element) {
            return element._zid || (element._zid = _zid++)
        }

        function findHandlers(element, event, fn, selector) {
            event = parse(event)
            if (event.ns) var matcher = matcherFor(event.ns)
            return (handlers[zid(element)] || []).filter(function(handler) {
                return handler && (!event.e || handler.e == event.e) && (!event.ns || matcher.test(handler.ns)) && (!fn || zid(handler.fn) === zid(fn)) && (!selector || handler.sel == selector)
            })
        }

        function parse(event) {
            var parts = ('' + event).split('.')
            return {
                e: parts[0],
                ns: parts.slice(1).sort().join(' ')
            }
        }

        function matcherFor(ns) {
            return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
        }

        function eventCapture(handler, captureSetting) {
            return handler.del &&
                (!focusinSupported && (handler.e in focus)) ||
                !!captureSetting
        }

        function realEvent(type) {
            return hover[type] || (focusinSupported && focus[type]) || type
        }

        function add(element, events, fn, data, selector, delegator, capture) {
            var id = zid(element),
                set = (handlers[id] || (handlers[id] = []))
            events.split(/\s/).forEach(function(event) {
                if (event == 'ready') return $(document).ready(fn)
                var handler = parse(event)
                handler.fn = fn
                handler.sel = selector
                    // emulate mouseenter, mouseleave
                if (handler.e in hover) fn = function(e) {
                    var related = e.relatedTarget
                    if (!related || (related !== this && !$.contains(this, related)))
                        return handler.fn.apply(this, arguments)
                }
                handler.del = delegator
                var callback = delegator || fn
                handler.proxy = function(e) {
                    e = compatible(e)
                    if (e.isImmediatePropagationStopped()) return
                    e.data = data
                    var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
                    if (result === false) e.preventDefault(), e.stopPropagation()
                    return result
                }
                handler.i = set.length
                set.push(handler)
                if ('addEventListener' in element)
                    element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
            })
        }

        function remove(element, events, fn, selector, capture) {
            var id = zid(element);
            (events || '').split(/\s/).forEach(function(event) {
                findHandlers(element, event, fn, selector).forEach(function(handler) {
                    delete handlers[id][handler.i]
                    if ('removeEventListener' in element)
                        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
                })
            })
        }

        $.event = {
            add: add,
            remove: remove
        }

        $.proxy = function(fn, context) {
            var args = (2 in arguments) && slice.call(arguments, 2)
            if (isFunction(fn)) {
                var proxyFn = function() {
                    return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments)
                }
                proxyFn._zid = zid(fn)
                return proxyFn
            } else if (isString(context)) {
                if (args) {
                    args.unshift(fn[context], fn)
                    return $.proxy.apply(null, args)
                } else {
                    return $.proxy(fn[context], fn)
                }
            } else {
                throw new TypeError("expected function")
            }
        }

        $.fn.bind = function(event, data, callback) {
            return this.on(event, data, callback)
        }
        $.fn.unbind = function(event, callback) {
            return this.off(event, callback)
        }
        $.fn.one = function(event, selector, data, callback) {
            return this.on(event, selector, data, callback, 1)
        }

        var returnTrue = function() {
                return true
            },
            returnFalse = function() {
                return false
            },
            ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$)/,
            eventMethods = {
                preventDefault: 'isDefaultPrevented',
                stopImmediatePropagation: 'isImmediatePropagationStopped',
                stopPropagation: 'isPropagationStopped'
            }

        function compatible(event, source) {
            if (source || !event.isDefaultPrevented) {
                source || (source = event)

                $.each(eventMethods, function(name, predicate) {
                    var sourceMethod = source[name]
                    event[name] = function() {
                        this[predicate] = returnTrue
                        return sourceMethod && sourceMethod.apply(source, arguments)
                    }
                    event[predicate] = returnFalse
                })

                if (source.defaultPrevented !== undefined ? source.defaultPrevented :
                    'returnValue' in source ? source.returnValue === false :
                    source.getPreventDefault && source.getPreventDefault())
                    event.isDefaultPrevented = returnTrue
            }
            return event
        }

        function createProxy(event) {
            var key, proxy = {
                originalEvent: event
            }
            for (key in event)
                if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

            return compatible(proxy, event)
        }

        $.fn.delegate = function(selector, event, callback) {
            return this.on(event, selector, callback)
        }
        $.fn.undelegate = function(selector, event, callback) {
            return this.off(event, selector, callback)
        }

        $.fn.live = function(event, callback) {
            $(document.body).delegate(this.selector, event, callback)
            return this
        }
        $.fn.die = function(event, callback) {
            $(document.body).undelegate(this.selector, event, callback)
            return this
        }

        $.fn.on = function(event, selector, data, callback, one) {
            var autoRemove, delegator, $this = this
            if (event && !isString(event)) {
                $.each(event, function(type, fn) {
                    $this.on(type, selector, data, fn, one)
                })
                return $this
            }

            if (!isString(selector) && !isFunction(callback) && callback !== false)
                callback = data, data = selector, selector = undefined
            if (isFunction(data) || data === false)
                callback = data, data = undefined

            if (callback === false) callback = returnFalse

            return $this.each(function(_, element) {
                if (one) autoRemove = function(e) {
                    remove(element, e.type, callback)
                    return callback.apply(this, arguments)
                }

                if (selector) delegator = function(e) {
                    var evt, match = $(e.target).closest(selector, element).get(0)
                    if (match && match !== element) {
                        evt = $.extend(createProxy(e), {
                            currentTarget: match,
                            liveFired: element
                        })
                        return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
                    }
                }

                add(element, event, callback, data, selector, delegator || autoRemove)
            })
        }
        $.fn.off = function(event, selector, callback) {
            var $this = this
            if (event && !isString(event)) {
                $.each(event, function(type, fn) {
                    $this.off(type, selector, fn)
                })
                return $this
            }

            if (!isString(selector) && !isFunction(callback) && callback !== false)
                callback = selector, selector = undefined

            if (callback === false) callback = returnFalse

            return $this.each(function() {
                remove(this, event, callback, selector)
            })
        }

        $.fn.trigger = function(event, args) {
            event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
            event._args = args
            return this.each(function() {
                // handle focus(), blur() by calling them directly
                if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
                    // items in the collection might not be DOM elements
                else if ('dispatchEvent' in this) this.dispatchEvent(event)
                else $(this).triggerHandler(event, args)
            })
        }

        // triggers event handlers on current element just as if an event occurred,
        // doesn't trigger an actual event, doesn't bubble
        $.fn.triggerHandler = function(event, args) {
            var e, result
            this.each(function(i, element) {
                e = createProxy(isString(event) ? $.Event(event) : event)
                e._args = args
                e.target = element
                $.each(findHandlers(element, event.type || event), function(i, handler) {
                    result = handler.proxy(e)
                    if (e.isImmediatePropagationStopped()) return false
                })
            })
            return result
        }

        // shortcut methods for `.bind(event, fn)` for each event type
        ;
        ('focusin focusout focus blur load resize scroll unload click dblclick ' +
            'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave ' +
            'change select keydown keypress keyup error').split(' ').forEach(function(event) {
            $.fn[event] = function(callback) {
                return (0 in arguments) ?
                    this.bind(event, callback) :
                    this.trigger(event)
            }
        })

        $.Event = function(type, props) {
            if (!isString(type)) props = type, type = props.type
            var event = document.createEvent(specialEvents[type] || 'Events'),
                bubbles = true
            if (props)
                for (var name in props)(name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
            event.initEvent(type, bubbles, true)
            return compatible(event)
        }

    })(Zepto)

    ;
    (function($) {
        var jsonpID = 0,
            document = window.document,
            key,
            name,
            rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            scriptTypeRE = /^(?:text|application)\/javascript/i,
            xmlTypeRE = /^(?:text|application)\/xml/i,
            jsonType = 'application/json',
            htmlType = 'text/html',
            blankRE = /^\s*$/,
            originAnchor = document.createElement('a')

        originAnchor.href = window.location.href

        // trigger a custom event and return false if it was cancelled
        function triggerAndReturn(context, eventName, data) {
            var event = $.Event(eventName)
            $(context).trigger(event, data)
            return !event.isDefaultPrevented()
        }

        // trigger an Ajax "global" event
        function triggerGlobal(settings, context, eventName, data) {
            if (settings.global) return triggerAndReturn(context || document, eventName, data)
        }

        // Number of active Ajax requests
        $.active = 0

        function ajaxStart(settings) {
            if (settings.global && $.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
        }

        function ajaxStop(settings) {
            if (settings.global && !(--$.active)) triggerGlobal(settings, null, 'ajaxStop')
        }

        // triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
        function ajaxBeforeSend(xhr, settings) {
            var context = settings.context
            if (settings.beforeSend.call(context, xhr, settings) === false ||
                triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
                return false

            triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
        }

        function ajaxSuccess(data, xhr, settings, deferred) {
                var context = settings.context,
                    status = 'success'
                settings.success.call(context, data, status, xhr)
                if (deferred) deferred.resolveWith(context, [data, status, xhr])
                triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
                ajaxComplete(status, xhr, settings)
            }
            // type: "timeout", "error", "abort", "parsererror"
        function ajaxError(error, type, xhr, settings, deferred) {
                var context = settings.context
                settings.error.call(context, xhr, type, error)
                if (deferred) deferred.rejectWith(context, [xhr, type, error])
                triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error || type])
                ajaxComplete(type, xhr, settings)
            }
            // status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
        function ajaxComplete(status, xhr, settings) {
            var context = settings.context
            settings.complete.call(context, xhr, status)
            triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
            ajaxStop(settings)
        }

        // Empty function, used as default callback
        function empty() {}

        $.ajaxJSONP = function(options, deferred) {
            if (!('type' in options)) return $.ajax(options)

            var _callbackName = options.jsonpCallback,
                callbackName = ($.isFunction(_callbackName) ?
                    _callbackName() : _callbackName) || ('jsonp' + (++jsonpID)),
                script = document.createElement('script'),
                originalCallback = window[callbackName],
                responseData,
                abort = function(errorType) {
                    $(script).triggerHandler('error', errorType || 'abort')
                },
                xhr = {
                    abort: abort
                },
                abortTimeout

            if (deferred) deferred.promise(xhr)

            $(script).on('load error', function(e, errorType) {
                clearTimeout(abortTimeout)
                $(script).off().remove()

                if (e.type == 'error' || !responseData) {
                    ajaxError(null, errorType || 'error', xhr, options, deferred)
                } else {
                    ajaxSuccess(responseData[0], xhr, options, deferred)
                }

                window[callbackName] = originalCallback
                if (responseData && $.isFunction(originalCallback))
                    originalCallback(responseData[0])

                originalCallback = responseData = undefined
            })

            if (ajaxBeforeSend(xhr, options) === false) {
                abort('abort')
                return xhr
            }

            window[callbackName] = function() {
                responseData = arguments
            }

            script.src = options.url.replace(/\?(.+)=\?/, '?$1=' + callbackName)
            document.head.appendChild(script)

            if (options.timeout > 0) abortTimeout = setTimeout(function() {
                abort('timeout')
            }, options.timeout)

            return xhr
        }

        $.ajaxSettings = {
            // Default type of request
            type: 'GET',
            // Callback that is executed before request
            beforeSend: empty,
            // Callback that is executed if the request succeeds
            success: empty,
            // Callback that is executed the the server drops error
            error: empty,
            // Callback that is executed on request complete (both: error and success)
            complete: empty,
            // The context for the callbacks
            context: null,
            // Whether to trigger "global" Ajax events
            global: true,
            // Transport
            xhr: function() {
                return new window.XMLHttpRequest()
            },
            // MIME types mapping
            // IIS returns Javascript as "application/x-javascript"
            accepts: {
                script: 'text/javascript, application/javascript, application/x-javascript',
                json: jsonType,
                xml: 'application/xml, text/xml',
                html: htmlType,
                text: 'text/plain'
            },
            // Whether the request is to another domain
            crossDomain: false,
            // Default timeout
            timeout: 0,
            // Whether data should be serialized to string
            processData: true,
            // Whether the browser should be allowed to cache GET responses
            cache: true
        }

        function mimeToDataType(mime) {
            if (mime) mime = mime.split(';', 2)[0]
            return mime && (mime == htmlType ? 'html' :
                mime == jsonType ? 'json' :
                scriptTypeRE.test(mime) ? 'script' :
                xmlTypeRE.test(mime) && 'xml') || 'text'
        }

        function appendQuery(url, query) {
            if (query == '') return url
            return (url + '&' + query).replace(/[&?]{1,2}/, '?')
        }

        // serialize payload and append it to the URL for GET requests
        function serializeData(options) {
            if (options.processData && options.data && $.type(options.data) != "string")
                options.data = $.param(options.data, options.traditional)
            if (options.data && (!options.type || options.type.toUpperCase() == 'GET'))
                options.url = appendQuery(options.url, options.data), options.data = undefined
        }

        $.ajax = function(options) {
            var settings = $.extend({}, options || {}),
                deferred = $.Deferred && $.Deferred(),
                urlAnchor
            for (key in $.ajaxSettings)
                if (settings[key] === undefined) settings[key] = $.ajaxSettings[key]

            ajaxStart(settings)

            if (!settings.crossDomain) {
                urlAnchor = document.createElement('a')
                urlAnchor.href = settings.url
                urlAnchor.href = urlAnchor.href
                settings.crossDomain = (originAnchor.protocol + '//' + originAnchor.host) !== (urlAnchor.protocol + '//' + urlAnchor.host)
            }

            if (!settings.url) settings.url = window.location.toString()
            serializeData(settings)

            var dataType = settings.dataType,
                hasPlaceholder = /\?.+=\?/.test(settings.url)
            if (hasPlaceholder) dataType = 'jsonp'

            if (settings.cache === false || (
                    (!options || options.cache !== true) &&
                    ('script' == dataType || 'jsonp' == dataType)
                ))
                settings.url = appendQuery(settings.url, '_=' + Date.now())

            if ('jsonp' == dataType) {
                if (!hasPlaceholder)
                    settings.url = appendQuery(settings.url,
                        settings.jsonp ? (settings.jsonp + '=?') : settings.jsonp === false ? '' : 'callback=?')
                return $.ajaxJSONP(settings, deferred)
            }

            var mime = settings.accepts[dataType],
                headers = {},
                setHeader = function(name, value) {
                    headers[name.toLowerCase()] = [name, value]
                },
                protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
                xhr = settings.xhr(),
                nativeSetHeader = xhr.setRequestHeader,
                abortTimeout

            if (deferred) deferred.promise(xhr)

            if (!settings.crossDomain) setHeader('X-Requested-With', 'XMLHttpRequest')
            setHeader('Accept', mime || '*/*')
            if (mime = settings.mimeType || mime) {
                if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
                xhr.overrideMimeType && xhr.overrideMimeType(mime)
            }
            if (settings.contentType || (settings.contentType !== false && settings.data && settings.type.toUpperCase() != 'GET'))
                setHeader('Content-Type', settings.contentType || 'application/x-www-form-urlencoded')

            if (settings.headers)
                for (name in settings.headers) setHeader(name, settings.headers[name])
            xhr.setRequestHeader = setHeader

            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4) {
                    xhr.onreadystatechange = empty
                    clearTimeout(abortTimeout)
                    var result, error = false
                    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
                        dataType = dataType || mimeToDataType(settings.mimeType || xhr.getResponseHeader('content-type'))
                        result = xhr.responseText

                        try {
                            // http://perfectionkills.com/global-eval-what-are-the-options/
                            if (dataType == 'script')(1, eval)(result)
                            else if (dataType == 'xml') result = xhr.responseXML
                            else if (dataType == 'json') result = blankRE.test(result) ? null : $.parseJSON(result)
                        } catch (e) {
                            error = e
                        }

                        if (error) ajaxError(error, 'parsererror', xhr, settings, deferred)
                        else ajaxSuccess(result, xhr, settings, deferred)
                    } else {
                        ajaxError(xhr.statusText || null, xhr.status ? 'error' : 'abort', xhr, settings, deferred)
                    }
                }
            }

            if (ajaxBeforeSend(xhr, settings) === false) {
                xhr.abort()
                ajaxError(null, 'abort', xhr, settings, deferred)
                return xhr
            }

            if (settings.xhrFields)
                for (name in settings.xhrFields) xhr[name] = settings.xhrFields[name]

            var async = 'async' in settings ? settings.async : true
            xhr.open(settings.type, settings.url, async, settings.username, settings.password)

            for (name in headers) nativeSetHeader.apply(xhr, headers[name])

            if (settings.timeout > 0) abortTimeout = setTimeout(function() {
                xhr.onreadystatechange = empty
                xhr.abort()
                ajaxError(null, 'timeout', xhr, settings, deferred)
            }, settings.timeout)

            // avoid sending empty string (#319)
            xhr.send(settings.data ? settings.data : null)
            return xhr
        }

        // handle optional data/success arguments
        function parseArguments(url, data, success, dataType) {
            if ($.isFunction(data)) dataType = success, success = data, data = undefined
            if (!$.isFunction(success)) dataType = success, success = undefined
            return {
                url: url,
                data: data,
                success: success,
                dataType: dataType
            }
        }

        $.get = function( /* url, data, success, dataType */ ) {
            return $.ajax(parseArguments.apply(null, arguments))
        }

        $.post = function( /* url, data, success, dataType */ ) {
            var options = parseArguments.apply(null, arguments)
            options.type = 'POST'
            return $.ajax(options)
        }

        $.getJSON = function( /* url, data, success */ ) {
            var options = parseArguments.apply(null, arguments)
            options.dataType = 'json'
            return $.ajax(options)
        }

        $.fn.load = function(url, data, success) {
            if (!this.length) return this
            var self = this,
                parts = url.split(/\s/),
                selector,
                options = parseArguments(url, data, success),
                callback = options.success
            if (parts.length > 1) options.url = parts[0], selector = parts[1]
            options.success = function(response) {
                self.html(selector ?
                    $('<div>').html(response.replace(rscript, "")).find(selector) : response)
                callback && callback.apply(self, arguments)
            }
            $.ajax(options)
            return this
        }

        var escape = encodeURIComponent

        function serialize(params, obj, traditional, scope) {
            var type, array = $.isArray(obj),
                hash = $.isPlainObject(obj)
            $.each(obj, function(key, value) {
                type = $.type(value)
                if (scope) key = traditional ? scope :
                    scope + '[' + (hash || type == 'object' || type == 'array' ? key : '') + ']'
                    // handle data in serializeArray() format
                if (!scope && array) params.add(value.name, value.value)
                    // recurse into nested objects
                else if (type == "array" || (!traditional && type == "object"))
                    serialize(params, value, traditional, key)
                else params.add(key, value)
            })
        }

        $.param = function(obj, traditional) {
            var params = []
            params.add = function(key, value) {
                if ($.isFunction(value)) value = value()
                if (value == null) value = ""
                this.push(escape(key) + '=' + escape(value))
            }
            serialize(params, obj, traditional)
            return params.join('&').replace(/%20/g, '+')
        }
    })(Zepto)

    ;
    (function($) {
        $.fn.serializeArray = function() {
            var name, type, result = [],
                add = function(value) {
                    if (value.forEach) return value.forEach(add)
                    result.push({
                        name: name,
                        value: value
                    })
                }
            if (this[0]) $.each(this[0].elements, function(_, field) {
                type = field.type, name = field.name
                if (name && field.nodeName.toLowerCase() != 'fieldset' &&
                    !field.disabled && type != 'submit' && type != 'reset' && type != 'button' && type != 'file' &&
                    ((type != 'radio' && type != 'checkbox') || field.checked))
                    add($(field).val())
            })
            return result
        }

        $.fn.serialize = function() {
            var result = []
            this.serializeArray().forEach(function(elm) {
                result.push(encodeURIComponent(elm.name) + '=' + encodeURIComponent(elm.value))
            })
            return result.join('&')
        }

        $.fn.submit = function(callback) {
            if (0 in arguments) this.bind('submit', callback)
            else if (this.length) {
                var event = $.Event('submit')
                this.eq(0).trigger(event)
                if (!event.isDefaultPrevented()) this.get(0).submit()
            }
            return this
        }

    })(Zepto)

    ;
    (function($) {
        // __proto__ doesn't exist on IE<11, so redefine
        // the Z function to use object extension instead
        if (!('__proto__' in {})) {
            $.extend($.zepto, {
                Z: function(dom, selector) {
                    dom = dom || []
                    $.extend(dom, $.fn)
                    dom.selector = selector || ''
                    dom.__Z = true
                    return dom
                },
                // this is a kludge but works
                isZ: function(object) {
                    return $.type(object) === 'array' && '__Z' in object
                }
            })
        }

        // getComputedStyle shouldn't freak out when called
        // without a valid element as argument
        try {
            getComputedStyle(undefined)
        } catch (e) {
            var nativeGetComputedStyle = getComputedStyle;
            window.getComputedStyle = function(element) {
                try {
                    return nativeGetComputedStyle(element)
                } catch (e) {
                    return null
                }
            }
        }
    })(Zepto);

    ;
    (function($) {
        var touch = {},
            touchTimeout, tapTimeout, swipeTimeout, longTapTimeout,
            longTapDelay = 750,
            gesture

        function swipeDirection(x1, x2, y1, y2) {
            return Math.abs(x1 - x2) >=
                Math.abs(y1 - y2) ? (x1 - x2 > 0 ? 'Left' : 'Right') : (y1 - y2 > 0 ? 'Up' : 'Down')
        }

        function longTap() {
            longTapTimeout = null
            if (touch.last) {
                touch.el.trigger('longTap')
                touch = {}
            }
        }

        function cancelLongTap() {
            if (longTapTimeout) clearTimeout(longTapTimeout)
            longTapTimeout = null
        }

        function cancelAll() {
            if (touchTimeout) clearTimeout(touchTimeout)
            if (tapTimeout) clearTimeout(tapTimeout)
            if (swipeTimeout) clearTimeout(swipeTimeout)
            if (longTapTimeout) clearTimeout(longTapTimeout)
            touchTimeout = tapTimeout = swipeTimeout = longTapTimeout = null
            touch = {}
        }

        function isPrimaryTouch(event) {
            return (event.pointerType == 'touch' ||
                event.pointerType == event.MSPOINTER_TYPE_TOUCH) && event.isPrimary
        }

        function isPointerEventType(e, type) {
            return (e.type == 'pointer' + type ||
                e.type.toLowerCase() == 'mspointer' + type)
        }

        $(document).ready(function() {
            var now, delta, deltaX = 0,
                deltaY = 0,
                firstTouch, _isPointerType

            if ('MSGesture' in window) {
                gesture = new MSGesture()
                gesture.target = document.body
            }

            $(document)
                .bind('MSGestureEnd', function(e) {
                    var swipeDirectionFromVelocity =
                        e.velocityX > 1 ? 'Right' : e.velocityX < -1 ? 'Left' : e.velocityY > 1 ? 'Down' : e.velocityY < -1 ? 'Up' : null;
                    if (swipeDirectionFromVelocity) {
                        touch.el.trigger('swipe')
                        touch.el.trigger('swipe' + swipeDirectionFromVelocity)
                    }
                })
                .on('touchstart MSPointerDown pointerdown', function(e) {
                    if ((_isPointerType = isPointerEventType(e, 'down')) &&
                        !isPrimaryTouch(e)) return
                    firstTouch = _isPointerType ? e : e.touches[0]
                    if (e.touches && e.touches.length === 1 && touch.x2) {
                        // Clear out touch movement data if we have it sticking around
                        // This can occur if touchcancel doesn't fire due to preventDefault, etc.
                        touch.x2 = undefined
                        touch.y2 = undefined
                    }
                    now = Date.now()
                    delta = now - (touch.last || now)
                    touch.el = $('tagName' in firstTouch.target ?
                        firstTouch.target : firstTouch.target.parentNode)
                    touchTimeout && clearTimeout(touchTimeout)
                    touch.x1 = firstTouch.pageX
                    touch.y1 = firstTouch.pageY
                    if (delta > 0 && delta <= 250) touch.isDoubleTap = true
                    touch.last = now
                    longTapTimeout = setTimeout(longTap, longTapDelay)
                        // adds the current touch contact for IE gesture recognition
                    if (gesture && _isPointerType) gesture.addPointer(e.pointerId);
                })
                .on('touchmove MSPointerMove pointermove', function(e) {
                    if ((_isPointerType = isPointerEventType(e, 'move')) &&
                        !isPrimaryTouch(e)) return
                    firstTouch = _isPointerType ? e : e.touches[0]
                    cancelLongTap()
                    touch.x2 = firstTouch.pageX
                    touch.y2 = firstTouch.pageY

                    deltaX += Math.abs(touch.x1 - touch.x2)
                    deltaY += Math.abs(touch.y1 - touch.y2)
                })
                .on('touchend MSPointerUp pointerup', function(e) {
                    if ((_isPointerType = isPointerEventType(e, 'up')) &&
                        !isPrimaryTouch(e)) return
                    cancelLongTap()

                    // swipe
                    if ((touch.x2 && Math.abs(touch.x1 - touch.x2) > 30) ||
                        (touch.y2 && Math.abs(touch.y1 - touch.y2) > 30))

                        swipeTimeout = setTimeout(function() {
                        touch.el.trigger('swipe')
                        touch.el.trigger('swipe' + (swipeDirection(touch.x1, touch.x2, touch.y1, touch.y2)))
                        touch = {}
                    }, 0)

                    // normal tap
                    else if ('last' in touch)
                    // don't fire tap when delta position changed by more than 30 pixels,
                    // for instance when moving to a point and back to origin
                        if (deltaX < 30 && deltaY < 30) {
                            // delay by one tick so we can cancel the "tap" event if 'scroll' fires
                            // ("tap" fires before 'scroll')
                            tapTimeout = setTimeout(function() {

                                // trigger universal "tap" with the option to cancelTouch()
                                // (cancelTouch cancels processing of single vs double taps for faster "tap" response)
                                var event = $.Event("tap");
                                //解决键盘挡住输入框报错信息看不到的问题 － 洪日
                                if (touch.el[0].tagName !== "INPUT") {
                                    $("input").trigger("blur");
                                }
                                event.cancelTouch = cancelAll
                                touch.el.trigger(event)

                                // trigger double tap immediately
                                if (touch.isDoubleTap) {
                                    if (touch.el) touch.el.trigger('doubleTap')
                                    touch = {}
                                }

                                // trigger single tap after 250ms of inactivity
                                else {
                                    touchTimeout = setTimeout(function() {
                                        touchTimeout = null
                                        if (touch.el) touch.el.trigger('singleTap')
                                        touch = {}
                                    }, 250)
                                }
                            }, 0)
                        } else {
                            touch = {}
                        }
                    deltaX = deltaY = 0

                })
                // when the browser window loses focus,
                // for example when a modal dialog is shown,
                // cancel all ongoing events
                .on('touchcancel MSPointerCancel pointercancel', cancelAll)

            // scrolling the window indicates intention of the user
            // to scroll, not tap or swipe, so cancel all ongoing events
            $(window).on('scroll', cancelAll)
        })

        ;
        ['swipe', 'swipeLeft', 'swipeRight', 'swipeUp', 'swipeDown',
            'doubleTap', "tap", 'singleTap', 'longTap'
        ].forEach(function(eventName) {
            $.fn[eventName] = function(callback) {
                return this.on(eventName, callback)
            }
        })
    })(Zepto);

    return Zepto;
});
/**
 * Created by amos on 14-8-18.
 */
MLBF.define('util.Attribute', function(require, exports, module){
    var extend = require('util.extend');

    var ATTR = '_ATTRIBUTES',
        VALIDATES = '_VALIDATES';

    /**
     * [mixable] Common attributes handler. Can be extended to any object that wants event handler.
     * @class Attribute
     * @namespace util
     * @example
     *      // mix in instance example
     *      // assume classInstance is instance of lang.Class or its sub class
     *
     *      // use class's mix method
     *      classInstance.mix(Event);
     *
     *      // watch events
     *      classInstance.bind('someEvent', function(){
     *          // do sth
     *      });
     *
     * @example
     *      // extend a sub class example
     *
     *      // use class's extend method
     *      var SubClass = Class.extend(Event, {
     *          // some other methods
     *          method1: function(){
     *          },
     *
     *          method2: function(){
     *          }
     *      });
     *
     *      // initialize an instance
     *      classInstance = new SubClass;
     *
     *      // watch events
     *      classInstance.bind('someEvent', function(){
     *          // do sth
     *      });
     */


    /**
     * Set an attribute
     * @method set
     * @param {String} attr Attribute name
     * @param {*} value
     * @param {Object} options Other options for setter
     * @param {Boolean} [options.silence=false] Silently set attribute without fire change event
     * @chainable
     */
    exports.set = function(attr, val, options){
        var attrs = this[ATTR];

        if(!attrs){
            attrs = this[ATTR] = {};
        }

        if(typeof attr !== 'object'){
            var oAttr = attrs[attr];
            attrs[attr] = val;

            // validate
            if(!this.validate(attrs)){
                // restore value
                attrs[attr] = oAttr;
            } else {
                // trigger event only when value is changed and is not a silent setting
                if(val !== oAttr && (!options || !options.silence) && this.trigger){
                    /**
                     * Fire when an attribute changed
                     * Fire once for each change and trigger method is needed
                     * @event change:attr
                     * @param {Event} JQuery event
                     * @param {Object} Current attributes
                     */
                    this.trigger('change:' + attr, [attrs[attr], oAttr]);

                    /**
                     * Fire when attribute changed
                     * Fire once for each change and trigger method is needed
                     * @event change
                     * @param {Event} JQuery event
                     * @param {Object} Current attributes
                     */
                    this.trigger('change', [attrs]);
                }
            }

            return this;
        }

        // set multiple attributes by passing in an object
        // the 2nd arg is options in this case
        options = val;

        // plain merge
        // so settings will only be merged plainly
        var obj = extend({}, attrs, attr);

        if(this.validate(obj)){
            this[ATTR] = obj;
            // change event
            if((!options || !options.silence) && this.trigger){
                var changedCount = 0;
                for(var i in attr){
                    // has property and property changed
                    if(attr.hasOwnProperty(i) && obj[i] !== attrs[i]){
                        changedCount++;
                        this.trigger('change:' + i, [obj[i], attrs[i]]);
                    }
                }

                // only any attribute is changed can trigger change event
                changedCount > 0 && this.trigger('change', [obj]);
            }
        }

        return this;
    };

    /**
     * Get attribute
     * @method get
     * @param {String} attr Attribute name
     * @return {*}
     */
    exports.get = function(attr){
        return !this[ATTR] ? null : this[ATTR][attr];
    };

    /**
     * Get all attributes.
     * Be sure it's ready-only cause it's not a copy!
     * @method attributes
     * @returns {Object} All attributes
     */
    exports.attributes = function(){
        return this[ATTR] || {};
    };

    /**
     * Add validate for attributes
     * @method addValidate
     * @param {Function} validate Validate function, return false when failed validation
     * @chainable
     * @example
     *      instance.addValidate(function(event, attrs){
     *          if(attrs.someAttr !== 1){
     *              return false; // return false when failed validation
     *          }
     *      });
     */
    exports.addValidate = function(validate){
        var validates = this[VALIDATES];

        if(!validates){
            validates = this[VALIDATES] = [];
        }

        // validates for all attributes
        validates.push(validate);

        return this;
    };

    /**
     * Remove a validate function
     * @method removeValidate
     * @param {Function} validate Validate function
     * @chainable
     * @example
     *      instance.removeValidate(someExistValidate);
     */
    exports.removeValidate = function(validate){
        // remove all validates
        if(!validate){
            this[VALIDATES] = null;
            return this;
        }

        var valArr = this[VALIDATES];

        for(var i= 0, len= valArr.length; i< len; i++){
            if(valArr[i] === validate){
                valArr.splice(i, 1);
                --i;
                --len;
            }
        }

        return this;
    };

    /**
     * Validate all attributes
     * @method validate
     * @return {Boolean} Validation result, return false when failed validation
     */
    exports.validate = function(attrs){
        var valArr = this[VALIDATES];
        if(!valArr){
            return true;
        }

        attrs = attrs || this[ATTR];
        for(var i= 0, len= valArr.length; i< len; i++){
            if(valArr[i].call(this, attrs) === false){
                return false;
            }
        }

        return true;
    };
});
/**
 * Created by amos on 14-8-18.
 */
MLBF.define('util.Callbacks', function(require, exports, module) {
    var extend = require('util.extend'),
        _ = require('util.underscore');

    var REG_NOT_WHITE = /\S+/g;

    // String to Object options format cache
    var optionsCache = {};

    // Convert String-formatted options into Object-formatted ones and store in cache
    var createOptions = function(options) {
        var object = optionsCache[options] = {};
        _.forEach(options.match(REG_NOT_WHITE) || [], function(flag) {
            object[flag] = true;
        });
        return object;
    };

    /**
     * Create a callback list (written in actory mode)
     * By default a callback list will act like an event callback list and can be
     * 'fired' multiple times.
     * Borrowed from jQuery.Callbacks
     * @class Callbacks
     * @namespace util
     * @constructor
     * @param {String|Object} options An optional list of space-separated options that will change how the callback list behaves or a more traditional option object
     * @param {Boolean} once Will ensure the callback list can only be fired once (like a Deferred)
     * @param {Boolean} memory Will keep track of previous values and will call any callback added after the list has been fired right away with the latest 'memorized' values (like a Deferred)
     * @param {Boolean} unique Will ensure a callback can only be added once (no duplicate in the list)
     * @param {Boolean} stopOnFalse Interrupt callings when a callback returns false
     * @example
     *  var list = Callbacks('once memory');
     */
    module.exports = function(options) {
        // Convert options from String-formatted to Object-formatted if needed
        // (we check in cache first)
        options = typeof options === 'string' ?
            (optionsCache[options] || createOptions(options)) :
            extend({}, options);

        var // Flag to know if list is currently firing
            firing,
            // Last fire value (for non-forgettable lists)
            memory,
            // Flag to know if list was already fired
            fired,
            // End of the loop when firing
            firingLength,
            // Index of currently firing callback (modified by remove if needed)
            firingIndex,
            // First callback to fire (used internally by add and fireWith)
            firingStart,
            // Actual callback list
            list = [],
            // Stack of fire calls for repeatable lists
            stack = !options.once && [],
            // Fire callbacks
            fire = function(data) {
                memory = options.memory && data;
                fired = true;
                firingIndex = firingStart || 0;
                firingStart = 0;
                firingLength = list.length;
                firing = true;
                for (; list && firingIndex < firingLength; firingIndex++) {
                    if (list[firingIndex].apply(data[0], data[1]) === false && options.stopOnFalse) {
                        memory = false; // To prevent further calls using add
                        break;
                    }
                }
                firing = false;
                if (list) {
                    if (stack) {
                        if (stack.length) {
                            fire(stack.shift());
                        }
                    } else if (memory) {
                        list = [];
                    } else {
                        self.disable();
                    }
                }
            },
            // Actual Callbacks object
            self = {
                /**
                 * Add a callback or a collection of callbacks to the list
                 * @method add
                 * @return {util.Callbacks}
                 */
                add: function() {
                    if (list) {
                        // First, we save the current length
                        var start = list.length;
                        (function add(args) {
                            _.forEach(args, function(arg) {
                                if (_.isFunction(arg)) {
                                    if (!options.unique || !self.has(arg)) {
                                        list.push(arg);
                                    }
                                } else if (arg && arg.length && _.isString(arg)) {
                                    // Inspect recursively
                                    add(arg);
                                }
                            });
                        })(arguments);
                        // Do we need to add the callbacks to the
                        // current firing batch?
                        if (firing) {
                            firingLength = list.length;
                            // With memory, if we're not firing then
                            // we should call right away
                        } else if (memory) {
                            firingStart = start;
                            fire(memory);
                        }
                    }
                    return this;
                },

                /**
                 * Remove a callback from the list
                 * @method remove
                 * @return {util.Callbacks}
                 */
                remove: function() {
                    if (list) {
                        _.forEach(arguments, function(arg) {
                            var index;
                            while ((index = _.indexOf(arg, list, index)) > -1) {
                                list.splice(index, 1);
                                // Handle firing indexes
                                if (firing) {
                                    if (index <= firingLength) {
                                        firingLength--;
                                    }
                                    if (index <= firingIndex) {
                                        firingIndex--;
                                    }
                                }
                            }
                        });
                    }
                    return this;
                },

                /**
                 * Check if a given callback is in the list.
                 * If no argument is given, return whether or not list has callbacks attached.
                 * @method has
                 * @return {util.Callbacks}
                 */
                has: function(fn) {
                    return fn ? _.indexOf(fn, list) > -1 : !!(list && list.length);
                },

                /**
                 * Remove all callbacks from the list
                 * @method empty
                 * @return {util.Callbacks}
                 */
                empty: function() {
                    list = [];
                    firingLength = 0;
                    return this;
                },

                /**
                 * Have the list do nothing anymore
                 * @method disable
                 * @return {util.Callbacks}
                 */
                disable: function() {
                    list = stack = memory = undefined;
                    return this;
                },

                /**
                 * Is it disabled?
                 * @method disabled
                 * @return {util.Callbacks}
                 */
                disabled: function() {
                    return !list;
                },

                /**
                 * Lock the list in its current state
                 * @method lock
                 * @return {util.Callbacks}
                 */
                lock: function() {
                    stack = undefined;
                    if (!memory) {
                        self.disable();
                    }
                    return this;
                },

                /**
                 * Is it locked?
                 * @method locked
                 * @return {Boolean}
                 */
                locked: function() {
                    return !stack;
                },

                /**
                 * Call all callbacks with the given context and arguments
                 * @method fireWith
                 * @return {util.Callbacks}
                 */
                fireWith: function(context, args) {
                    if (list && (!fired || stack)) {
                        args = args || [];
                        args = [context, args.slice ? args.slice() : args];
                        if (firing) {
                            stack.push(args);
                        } else {
                            fire(args);
                        }
                    }
                    return this;
                },

                /**
                 * Call all the callbacks with the given arguments
                 * @method fire
                 * @return {util.Callbacks}
                 */
                fire: function() {
                    self.fireWith(this, arguments);
                    return this;
                },

                /**
                 * To know if the callbacks have already been called at least once
                 * @method fired
                 * @return {util.Callbacks}
                 */
                fired: function() {
                    return !!fired;
                }
            };

        return self;
    };
});
/**
 * Created by amos on 14-8-18.
 */
MLBF.define('util.Class', function(require, exports, module){
    var _ = require('util.underscore'),
        extend = require('util.extend'),
        $ = require('lib.Zepto');

    /**
     * Base Class
     * @class Class
     * @namespace lang
     * @module lang
     * @constructor
     * @example
     *      // SubClass extends Class
     *      var SubClass = Class.extend({
     *          // overwritten constructor
     *          initialize: function(){
     *
     *          },
     *
     *          someMethod: function(){
     *          }
     *      });
     *
     *      // add static methods and attributes
     *      SubClass.include({
     *          staticMethod: function(){
     *          },
     *
     *          staticAttr: 'attrValue'
     *      });
     *
     *      // Extension is always available for sub class
     *      var SubSubClass = SubClass.extend({
     *          // methods to be extended
     *      });
     */
    module.exports = inherit.call(Function, {
        initialize: function(){},

        /**
         * Mix in methods and attributes. Instead of inherit from base class, mix provides a lighter way to extend object.
         * @method mixin
         * @since 0.5.2
         * @param {Object} [mixin]* The object to be mixed in
         * @chainable
         * @example
         *      var someInstance = new Class;
         *
         *      someInstance.mix({
         *          sayHello: function(){
         *              alert('hello');
         *          }
         *      });
         */
        mixin: include
    });

    function inherit(ext){
        // prepare extends
        var args = _.toArray(arguments);

        // constructor
        var Class = function(){
            // real constructor
            this.initialize.apply(this, arguments);
        };

        // copy Base.prototype
        var Base = function(){};
        Base.prototype = this.prototype;
        var proto = new Base();

        // correct constructor pointer
        /**
         * Instance's constructor, which initialized the instance
         * @property constructor
         * @for lang.Class
         * @type {lang.Class}
         */
        proto.constructor = Class;

        /**
         * Superclass of the instance
         * @property superclass
         * @type {lang.Class}
         */
        proto.superclass = this;

        // extends prototype
        args.unshift(proto);
        extend.apply(args, args);
        Class.prototype = proto;

        // add static methods
        extend(Class, {
            /**
             * Extend a sub Class
             * @method inherit
             * @static
             * @for lang.Class
             * @param {Object} [ext]* Prototype extension. Multiple exts are allow here.
             * @chainable
             * @example
             *     var SubClass = Class.extend(ext1);
             *
             * @example
             *      // multiple extensions are acceptable
             *      var SubClass = Class.extend(ext1, ext2, ...);
             */
            inherit: inherit,

            /**
             * Extend static attributes
             * @method include
             * @static
             * @for lang.Class
             * @param {Object} [included]* Static attributes to be extended
             * @chainable
             * @example
             *     Class.include(include1);
             *
             * @example
             *     // multiple includes are acceptable
             *     Class.include(include1, include2, ...);
             */
            include: include,

            /**
             * Inherit base class and add/overwritten some new methods or properties.
             * This is a deprecated method for it's easily misunderstood. It's just for backward compatible use and will be removed in the near future.
             * We recommend inherit for a replacement
             * @method extend
             * @static
             * @for lang.Class
             * @deprecated
             * @see inherit
             */
            extend: inherit,

            /**
             * Superclass the Class inherited from
             * @property superclass
             * @type {lang.Class}
             * @for lang.Class
             */
            superclass: this
        });

        return Class;
    };

    function include(included){
        var args = _.toArray(arguments);
        args.unshift(this);
        extend.apply(this, args);
        return this;
    }
});
/**
 * Created by amos on 14-8-18.
 */
MLBF.define('util.Event', function(require, exports) {
    var _ = require('util.underscore'),
        Callbacks = require('util.Callbacks');

    var ATTR = '_EVENTS';

    /**
     * [mixable] Common event handler. Can be extended to any object that wants event handler.
     * @class Event
     * @namespace util
     * @example
     *      // mix in instance example
     *      // assume classInstance is instance of lang.Class or its sub class
     *
     *      // use class's mix method
     *      classInstance.mix(Attribute);
     *
     *      // set your attributes
     *      classInstance.set('a', 1);
     *      classInstance.get('a') // returns 1
     *
     * @example
     *      // extend a sub class example
     *
     *      // use class's extend method
     *      var SubClass = Class.extend(Attribute, {
     *          // some other methods
     *          method1: function(){
     *          },
     *
     *          method2: function(){
     *          }
     *      });
     *
     *      // initialize an instance
     *      classInstance = new SubClass;
     *
     *      // set your attributes
     *      classInstance.set('a', 1);
     *      classInstance.get('a') // returns 1
     */

    /**
     * Bind events
     * @method on
     * @param {String} eventNames Event names that to be subscribed and can be separated by a blank space
     * @param {Function} callback Callback to be invoked when the subscribed events are published
     * @chainable
     */
    exports.on = function(type, handler, one) {
        var events = this[ATTR];

        if (!events) {
            events = this[ATTR] = {};
        }

        var callbacks = events[type] || (events[type] = Callbacks('stopOnFalse'));

        if (one === 1) {
            var origFn = handler,
                self = this;

            handler = function() {
                // Can use an empty set, since event contains the info
                self.off(type, handler);
                return origFn.apply(this, arguments);
            };
        }

        callbacks.add(handler);

        return this;
    }

    /**
     * Unbind events
     * @method off
     * @param {String} eventNames Event names that to be subscribed and can be separated by a blank space
     * @param {Function} [callback] Callback to be invoked when the subscribed events are published. Leave blank will unbind all callbacks on this event
     * @chainable
     */
    exports.off = function(type, handler) {
        if (!type) {
            this[ATTR] = {};
            return this;
        }

        var events = this[ATTR];
        if (!events || !events[type]) {
            return this;
        }

        if (!handler) {
            events[type].empty();
            return this;
        }

        events[type].remove(handler);

        return this;
    }

    /**
     * Publish an event
     * @method trigger
     * @param {String} eventName
     * @param arg* Arguments to be passed to callback function. No limit of arguments' length
     * @chainable
     */
    exports.trigger = function() {
        var args = _.toArray(arguments),
            type = args.shift(),
            events = this[ATTR];

        if (!events || !events[type]) {
            return this;
        }

        events[type].fireWith(this, args);

        return this;
    }

    /**
     * Bind event callback to be triggered only once
     * @method one
     * @param {String} eventNames Event names that to be subscribed and can be separated by a blank space
     * @param {Function} callback Callback to be invoked when the subscribed events are published. Leave blank will unbind all callbacks on this event
     * @chainable
     */
    exports.once = function(type, handler) {
        return this.on(type, handler, 1);
    }
});
MLBF.define('util.defaults', function( require ){

    /**
     * Merge options with defaults, support multiple defaults
     * @method defaults
     * @param {Boolean} [isRecursive=false] Should recursive merge or not
     * @param {Object} options Options to be merged to
     * @param {Object} defaults* Defaults for options
     * @return {Object} Options merged with defaults.
     * @example
     *  var ret = defaults( { a: 1 }, { a: 2, b: 2, c: 2 }, { c: 3, d: 4 } );
     *
     *  // defaults won't override options
     *  ret.a === 2;
     *
     *  // the attribute unset in options will be filled with value in defaults
     *  ret.b === 2;
     *
     *  // the latter defaults will override previous one
     *  ret.c === 3;
     */
    return function(){
        var args = [].slice.call( arguments ),
            optPos = typeof args[0] === 'boolean' ? 1 : 0,
            options = args.splice( optPos, 1 )[0];

        // add target options
        args.splice( optPos, 0, {} );

        // move original options to tail
        args.push( options );

        return $.extend.apply( this, args );
    };
});
/**
 * Created by amos on 14-8-7.
 */
MLBF.define('util.extend', function(require, exports, module){
    var isPlainObject = require('util.isPlainObject');

    /**
     * Extend(copy) attributes from an object to another
     * @class extend
     * @namespace lang
     * @constructor
     * @param {Boolean} [isRecursive=false] Recursively extend the object
     * @param {Object} base Base object to be extended into
     * @param {Object} ext* Object to extend base object
     * @example
     *      // plain extend
     *      // returns {a: 1, b:1}
     *      extend({a: 1}, {b: 1});
     *
     *      // recursive extend
     *      var b = { x: 1};
     *      var ret = extend(true, {}, { b: b});
     *      b.x = 2;
     *      b.x !== ret.b.x;
     */
    module.exports = function(isRecursive, base, ext){
        var args = [].slice.apply(arguments),
            o = args.shift(),
            extFn = plain;

        if(typeof o === 'boolean'){
            o = args.shift();
            o && (extFn = recursive);
        }

        for(var i= 0, len= args.length; i< len; i++){
            args[i] && extFn(o, args[i]);
        }

        return o;

        function plain(o, ext){
            for(var attr in ext){
                if(ext.hasOwnProperty(attr)){
                    o[attr] = ext[attr];
                }
            }
        }

        function recursive(o, ext){
            for(var attr in ext){
                if(ext.hasOwnProperty(attr)){
                    if(isPlainObject(ext[attr])){
                        o[attr] = o[attr] || {};
                        recursive(o[attr], ext[attr]);
                    } else{
                        o[attr] = ext[attr];
                    }
                }
            }
        }
    };
});
MLBF.define('util.isPlainObject', function(require, exports, module) {
    var _ = require('util.underscore'),
        isWindow = function(obj) {
            return obj && obj === obj.window;
        };

    /**
     * Whether the obj is a plain object, not array or regexp etc.
     * @method isPlainObject
     * @static
     * @param {*} obj
     * @return {Boolean}
     */
    module.exports = function(obj) {
        // Must be an Object.
        // Because of IE, we also have to check the presence of the constructor property.
        // Make sure that DOM nodes and window objects don't pass through, as well
        if (!obj || !_.isObject(obj) || obj.nodeType || isWindow(obj)) {
            return false;
        }

        var hasOwn = Object.prototype.hasOwnProperty;

        try {
            // Not own constructor property must be Object
            if (obj.constructor &&
                !hasOwn.call(obj, 'constructor') &&
                !hasOwn.call(obj.constructor.prototype, 'isPrototypeOf')) {
                return false;
            }
        } catch (e) {
            // IE8,9 Will throw exceptions on certain host objects #9897
            return false;
        }

        // Own properties are enumerated firstly, so to speed up,
        // if last one is own, then all properties are own.

        var key;
        for (key in obj) {}

        return key === undefined || hasOwn.call(obj, key);
    };
});
/******************************************************************************
 * MLBF MVC 0.0.1 2015-05-26 
 * author hongri
 ******************************************************************************/

/**
 * Art template, enhanced micro template. See 
 <a target="_blank" href="https://github.com/aui/artTemplate">template API doc</a>
 * @class template
 * @namespace util
 * @module util
 */
MLBF.define('util.template', function(require, exports, module) {
    /** @ignore */
    /*!
     * artTemplate - Template Engine
     * https://github.com/aui/artTemplate
     * Released under the MIT, BSD, and GPL Licenses
     * Email: 1987.tangbin@gmail.com
     */


    /**
     * 模板引擎路由函数
     * 若第二个参数类型为 Object 则执行 render 方法, 否则 compile 方法
     * @name    template
     * @param   {String}            模板ID (可选)
     * @param   {Object, String}    数据或者模板字符串
     * @return  {String, Function}  渲染好的HTML字符串或者渲染方法
     */
    var template = function(id, content) {
        return template[
            typeof content === 'object' ? 'render' : 'compile'
        ].apply(template, arguments);
    };




    (function(exports, global) {


        'use strict';
        exports.version = '2.0.0';
        exports.openTag = '<%'; // 设置逻辑语法开始标签
        exports.closeTag = '%>'; // 设置逻辑语法结束标签
        exports.isEscape = true; // HTML字符编码输出开关
        exports.isCompress = false; // 剔除渲染后HTML多余的空白开关
        exports.parser = null; // 自定义语法插件接口



        /**
         * 渲染模板
         * @name    template.render
         * @param   {String}    模板ID
         * @param   {Object}    数据
         * @return  {String}    渲染好的HTML字符串
         */
        exports.render = function(id, data) {

            var cache = _getCache(id);

            if (cache === undefined) {

                return _debug({
                    id: id,
                    name: 'Render Error',
                    message: 'No Template'
                });

            }

            return cache(data);
        };



        /**
         * 编译模板
         * 2012-6-6:
         * define 方法名改为 compile,
         * 与 Node Express 保持一致,
         * 感谢 TooBug 提供帮助!
         * @name    template.compile
         * @param   {String}    模板ID (可选)
         * @param   {String}    模板字符串
         * @return  {Function}  渲染方法
         */
        exports.compile = function(id, source) {

            var params = arguments;
            var isDebug = params[2];
            var anonymous = 'anonymous';

            if (typeof source !== 'string') {
                isDebug = params[1];
                source = params[0];
                id = anonymous;
            }


            try {

                var Render = _compile(source, isDebug);

            } catch (e) {

                e.id = id || source;
                e.name = 'Syntax Error';

                return _debug(e);

            }


            function render(data) {

                try {

                    return new Render(data) + '';

                } catch (e) {

                    if (!isDebug) {
                        return exports.compile(id, source, true)(data);
                    }

                    e.id = id || source;
                    e.name = 'Render Error';
                    e.source = source;

                    return _debug(e);

                };

            };


            render.prototype = Render.prototype;
            render.toString = function() {
                return Render.toString();
            };


            if (id !== anonymous) {
                _cache[id] = render;
            }


            return render;

        };




        /**
         * 添加模板辅助方法
         * @name    template.helper
         * @param   {String}    名称
         * @param   {Function}  方法
         */
        exports.helper = function(name, helper) {
            exports.prototype[name] = helper;
        };




        /**
         * 模板错误事件
         * @name    template.onerror
         * @event
         */
        exports.onerror = function(e) {
            var content = '[template]:\n' + e.id + '\n\n[name]:\n' + e.name;

            if (e.message) {
                content += '\n\n[message]:\n' + e.message;
            }

            if (e.line) {
                content += '\n\n[line]:\n' + e.line;
                content += '\n\n[source]:\n' + e.source.split(/\n/)[e.line - 1].replace(/^[\s\t]+/, '');
            }

            if (e.temp) {
                content += '\n\n[temp]:\n' + e.temp;
            }

            if (global.console) {
                console.error(content);
            }
        };



        // 编译好的函数缓存
        var _cache = {};



        // 获取模板缓存
        var _getCache = function(id) {

            var cache = _cache[id];

            if (cache === undefined && 'document' in global) {
                var elem = document.getElementById(id);

                if (elem) {
                    var source = elem.value || elem.innerHTML;
                    return exports.compile(id, source.replace(/^\s*|\s*$/g, ''));
                }

            } else if (_cache.hasOwnProperty(id)) {

                return cache;
            }
        };



        // 模板调试器
        var _debug = function(e) {

            exports.onerror(e);

            function error() {
                return error + '';
            };

            error.toString = function() {
                return '{Template Error}';
            };

            return error;
        };



        // 模板编译器
        var _compile = (function() {


            // 辅助方法集合
            exports.prototype = {
                $render: exports.render,
                $escapeHTML: function(content) {

                    return typeof content === 'string' ? content.replace(/&(?![\w#]+;)|[<>"']/g, function(s) {
                        return {
                            "<": "&#60;",
                            ">": "&#62;",
                            '"': "&#34;",
                            "'": "&#39;",
                            "&": "&#38;"
                        }[s];
                    }) : content;
                },
                $specialCharEscapeHTML: function(content) {

                    return typeof content === 'string' ? content.replace(/(['"\\\/])/g, '\\$1') : content;
                },
                $getValue: function(value) {

                    if (typeof value === 'string' || typeof value === 'number') {

                        return value;

                    } else if (typeof value === 'function') {

                        return value();

                    } else {

                        return '';

                    }

                }
            };


            var arrayforEach = Array.prototype.forEach || function(block, thisObject) {
                var len = this.length >>> 0;

                for (var i = 0; i < len; i++) {
                    if (i in this) {
                        block.call(thisObject, this[i], i, this);
                    }
                }

            };


            // 数组迭代
            var forEach = function(array, callback) {
                arrayforEach.call(array, callback);
            };


            var keyWords =
                // 关键字
                'break,case,catch,continue,debugger,default,delete,do,else,false,finally,for,function,if' + ',in,instanceof,new,null,return,switch,this,throw,true,try,typeof,var,void,while,with'

            // 保留字
            +',abstract,boolean,byte,char,class,const,double,enum,export,extends,final,float,goto' + ',implements,import,int,interface,long,native,package,private,protected,public,short' + ',static,super,synchronized,throws,transient,volatile'

            // ECMA 5 - use strict
            + ',arguments,let,yield'

            + ',undefined';

            var filter = new RegExp([

                // 注释
                "/\\*(.|\n)*?\\*/|//[^\n]*\n|//[^\n]*$",

                // 字符串
                "'[^']*'|\"[^\"]*\"",

                // 方法
                "\\.[\s\t\n]*[\\$\\w]+",

                // 关键字
                "\\b" + keyWords.replace(/,/g, '\\b|\\b') + "\\b"


            ].join('|'), 'g');



            // 提取js源码中所有变量
            var _getVariable = function(code) {

                code = code
                    .replace(filter, ',')
                    .replace(/[^\w\$]+/g, ',')
                    .replace(/^,|^\d+|,\d+|,$/g, '');

                return code ? code.split(',') : [];
            };


            return function(source, isDebug) {

                var openTag = exports.openTag;
                var closeTag = exports.closeTag;
                var parser = exports.parser;


                var code = source;
                var tempCode = '';
                var line = 1;
                var uniq = {
                    $data: true,
                    $helpers: true,
                    $out: true,
                    $line: true
                };
                var helpers = exports.prototype;
                var prototype = {};


                var variables = "var $helpers=this," + (isDebug ? "$line=0," : "");

                var isNewEngine = ''.trim; // '__proto__' in {}
                var replaces = isNewEngine ? ["$out='';", "$out+=", ";", "$out"] : ["$out=[];", "$out.push(", ");", "$out.join('')"];

                var concat = isNewEngine ? "if(content!==undefined){$out+=content;return content}" : "$out.push(content);";

                var print = "function(content){" + concat + "}";

                var include = "function(id,data){" + "if(data===undefined){data=$data}" + "var content=$helpers.$render(id,data);" + concat + "}";


                // html与逻辑语法分离
                forEach(code.split(openTag), function(code, i) {
                    code = code.split(closeTag);

                    var $0 = code[0];
                    var $1 = code[1];

                    // code: [html]
                    if (code.length === 1) {

                        tempCode += html($0);

                        // code: [logic, html]
                    } else {

                        tempCode += logic($0);

                        if ($1) {
                            tempCode += html($1);
                        }
                    }


                });



                code = tempCode;


                // 调试语句
                if (isDebug) {
                    code = 'try{' + code + '}catch(e){' + 'e.line=$line;' + 'throw e' + '}';
                }


                code = "'use strict';" + variables + replaces[0] + code + 'return new String(' + replaces[3] + ')';


                try {

                    var Render = new Function('$data', code);
                    Render.prototype = prototype;

                    return Render;

                } catch (e) {
                    e.temp = 'function anonymous($data) {' + code + '}';
                    throw e;
                };




                // 处理 HTML 语句
                function html(code) {

                    // 记录行号
                    line += code.split(/\n/).length - 1;

                    if (exports.isCompress) {
                        code = code.replace(/[\n\r\t\s]+/g, ' ');
                    }

                    code = code
                        // 单双引号与反斜杠转义
                        .replace(/('|"|\\)/g, '\\$1')
                        // 换行符转义(windows + linux)
                        .replace(/\r/g, '\\r')
                        .replace(/\n/g, '\\n');

                    code = replaces[1] + "'" + code + "'" + replaces[2];

                    return code + '\n';
                };


                // 处理逻辑语句
                function logic(code) {

                    var thisLine = line;

                    if (parser) {

                        // 语法转换插件钩子
                        code = parser(code);

                    } else if (isDebug) {

                        // 记录行号
                        code = code.replace(/\n/g, function() {
                            line++;
                            return '$line=' + line + ';';
                        });

                    }


                    // 输出语句. 转义: <%=value%> 不转义:<%==value%>
                    if (code.indexOf('=') === 0) {

                        var isEscape = code.indexOf('==') !== 0;

                        var isSpecialCharEscape = code.indexOf('#=') === 0;

                        code = code.replace(/^=*|[\s;]*$/g, '');

                        if ((isEscape || isSpecialCharEscape) && exports.isEscape) {

                            // 转义处理，但排除辅助方法
                            var name = code.replace(/\s*\([^\)]+\)/, '');
                            if (!helpers.hasOwnProperty(name) && !/^(include|print)$/.test(name)) {
                                code = (isSpecialCharEscape ? '$specialCharEscapeHTML' : '$escapeHTML') + '($getValue(' + code + '))';
                            }

                        } else {
                            code = '$getValue(' + code + ')';
                        }


                        code = replaces[1] + code + replaces[2];

                    }

                    if (isDebug) {
                        code = '$line=' + thisLine + ';' + code;
                    }

                    getKey(code);

                    return code + '\n';
                };


                // 提取模板中的变量名
                function getKey(code) {

                    code = _getVariable(code);

                    // 分词
                    forEach(code, function(name) {

                        // 除重
                        if (!uniq.hasOwnProperty(name)) {
                            setValue(name);
                            uniq[name] = true;
                        }

                    });

                };


                // 声明模板变量
                // 赋值优先级:
                // 内置特权方法(include, print) > 私有模板辅助方法 > 数据 > 公用模板辅助方法
                function setValue(name) {

                    var value;

                    if (name === 'print') {

                        value = print;

                    } else if (name === 'include') {

                        prototype['$render'] = helpers['$render'];
                        value = include;

                    } else {

                        value = '$data.' + name;

                        if (helpers.hasOwnProperty(name)) {

                            prototype[name] = helpers[name];

                            if (name.indexOf('$') === 0) {
                                value = '$helpers.' + name;
                            } else {
                                value = value + '===undefined?$helpers.' + name + ':' + value;
                            }
                        }


                    }

                    variables += name + '=' + value + ',';
                };


            };
        })();




    })(template, window);


    if (typeof module !== 'undefined' && module.exports) {
        module.exports = template;
    }
});
/******************************************************************************
 * MLBF Node 0.0.1 2015-05-26 
 * is only core function of underscore
 ******************************************************************************/

/** @ignore */
MLBF.define('util.underscore', function(require, exports, module) {

    // Baseline setup
    // --------------

    // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
    // We use `self` instead of `window` for `WebWorker` support.
    var root = typeof self === 'object' && self.self === self && self ||
        typeof global === 'object' && global.global === global && global;

    // Save the previous value of the `_` variable.
    var previousUnderscore = root._;

    // Save bytes in the minified (but not gzipped) version:
    var ArrayProto = Array.prototype,
        ObjProto = Object.prototype,
        FuncProto = Function.prototype;

    // Create quick reference variables for speed access to core prototypes.
    var
        push = ArrayProto.push,
        slice = ArrayProto.slice,
        toString = ObjProto.toString,
        hasOwnProperty = ObjProto.hasOwnProperty;

    // All **ECMAScript 5** native function implementations that we hope to use
    // are declared here.
    var
        nativeIsArray = Array.isArray,
        nativeKeys = Object.keys,
        nativeBind = FuncProto.bind,
        nativeCreate = Object.create;

    // Naked function reference for surrogate-prototype-swapping.
    var Ctor = function() {};

    // Create a safe reference to the Underscore object for use below.
    var _ = function(obj) {
        if (obj instanceof _) return obj;
        if (!(this instanceof _)) return new _(obj);
        this._wrapped = obj;
    };

    // Export the Underscore object for **Node.js**, with
    // backwards-compatibility for their old module API. If we're in
    // the browser, add `_` as a global object.
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = _;
        }
        exports._ = _;
    } else {
        root._ = _;
    }

    // Current version.
    _.VERSION = '1.8.3';

    // Internal function that returns an efficient (for current engines) version
    // of the passed-in callback, to be repeatedly applied in other Underscore
    // functions.
    var optimizeCb = function(func, context, argCount) {
        if (context === void 0) return func;
        switch (argCount == null ? 3 : argCount) {
            case 1:
                return function(value) {
                    return func.call(context, value);
                };
            case 2:
                return function(value, other) {
                    return func.call(context, value, other);
                };
            case 3:
                return function(value, index, collection) {
                    return func.call(context, value, index, collection);
                };
            case 4:
                return function(accumulator, value, index, collection) {
                    return func.call(context, accumulator, value, index, collection);
                };
        }
        return function() {
            return func.apply(context, arguments);
        };
    };

    // A mostly-internal function to generate callbacks that can be applied
    // to each element in a collection, returning the desired result — either
    // identity, an arbitrary callback, a property matcher, or a property accessor.
    var cb = function(value, context, argCount) {
        if (value == null) return _.identity;
        if (_.isFunction(value)) return optimizeCb(value, context, argCount);
        if (_.isObject(value)) return _.matcher(value);
        return _.property(value);
    };
    _.iteratee = function(value, context) {
        return cb(value, context, Infinity);
    };

    // Similar to ES6's rest param (http://ariya.ofilabs.com/2013/03/es6-and-rest-parameter.html)
    // This accumulates the arguments passed into an array, after a given index.
    var restArgs = function(func, startIndex) {
        startIndex = startIndex == null ? func.length - 1 : +startIndex;
        return function() {
            var length = Math.max(arguments.length - startIndex, 0);
            var rest = Array(length);
            var index;
            for (index = 0; index < length; index++) {
                rest[index] = arguments[index + startIndex];
            }
            switch (startIndex) {
                case 0:
                    return func.call(this, rest);
                case 1:
                    return func.call(this, arguments[0], rest);
                case 2:
                    return func.call(this, arguments[0], arguments[1], rest);
            }
            var args = Array(startIndex + 1);
            for (index = 0; index < startIndex; index++) {
                args[index] = arguments[index];
            }
            args[startIndex] = rest;
            return func.apply(this, args);
        };
    };

    // An internal function for creating a new object that inherits from another.
    var baseCreate = function(prototype) {
        if (!_.isObject(prototype)) return {};
        if (nativeCreate) return nativeCreate(prototype);
        Ctor.prototype = prototype;
        var result = new Ctor;
        Ctor.prototype = null;
        return result;
    };

    var property = function(key) {
        return function(obj) {
            return obj == null ? void 0 : obj[key];
        };
    };

    // Helper for collection methods to determine whether a collection
    // should be iterated as an array or as an object
    // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
    // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
    var getLength = property('length');
    var isArrayLike = function(collection) {
        var length = getLength(collection);
        return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
    };

    // Collection Functions
    // --------------------

    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles raw objects in addition to array-likes. Treats all
    // sparse array-likes as if they were dense.
    _.each = _.forEach = function(obj, iteratee, context) {
        iteratee = optimizeCb(iteratee, context);
        var i, length;
        if (isArrayLike(obj)) {
            for (i = 0, length = obj.length; i < length; i++) {
                iteratee(obj[i], i, obj);
            }
        } else {
            var keys = _.keys(obj);
            for (i = 0, length = keys.length; i < length; i++) {
                iteratee(obj[keys[i]], keys[i], obj);
            }
        }
        return obj;
    };

    // Return the results of applying the iteratee to each element.
    _.map = _.collect = function(obj, iteratee, context) {
        iteratee = cb(iteratee, context);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length,
            results = Array(length);
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            results[index] = iteratee(obj[currentKey], currentKey, obj);
        }
        return results;
    };

    // Create a reducing function iterating left or right.
    var createReduce = function(dir) {
        // Optimized iterator function as using arguments.length
        // in the main function will deoptimize the, see #1991.
        var reducer = function(obj, iteratee, memo, initial) {
            var keys = !isArrayLike(obj) && _.keys(obj),
                length = (keys || obj).length,
                index = dir > 0 ? 0 : length - 1;
            if (!initial) {
                memo = obj[keys ? keys[index] : index];
                index += dir;
            }
            for (; index >= 0 && index < length; index += dir) {
                var currentKey = keys ? keys[index] : index;
                memo = iteratee(memo, obj[currentKey], currentKey, obj);
            }
            return memo;
        };

        return function(obj, iteratee, memo, context) {
            var initial = arguments.length >= 3;
            return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
        };
    };

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`.
    _.reduce = _.foldl = _.inject = createReduce(1);

    // The right-associative version of reduce, also known as `foldr`.
    _.reduceRight = _.foldr = createReduce(-1);

    // Return the first value which passes a truth test. Aliased as `detect`.
    _.find = _.detect = function(obj, predicate, context) {
        var key;
        if (isArrayLike(obj)) {
            key = _.findIndex(obj, predicate, context);
        } else {
            key = _.findKey(obj, predicate, context);
        }
        if (key !== void 0 && key !== -1) return obj[key];
    };

    // Return all the elements that pass a truth test.
    // Aliased as `select`.
    _.filter = _.select = function(obj, predicate, context) {
        var results = [];
        predicate = cb(predicate, context);
        _.each(obj, function(value, index, list) {
            if (predicate(value, index, list)) results.push(value);
        });
        return results;
    };

    // Return all the elements for which a truth test fails.
    _.reject = function(obj, predicate, context) {
        return _.filter(obj, _.negate(cb(predicate)), context);
    };

    // Determine whether all of the elements match a truth test.
    // Aliased as `all`.
    _.every = _.all = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length;
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            if (!predicate(obj[currentKey], currentKey, obj)) return false;
        }
        return true;
    };

    // Determine if at least one element in the object matches a truth test.
    // Aliased as `any`.
    _.some = _.any = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length;
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            if (predicate(obj[currentKey], currentKey, obj)) return true;
        }
        return false;
    };

    // Determine if the array or object contains a given item (using `===`).
    // Aliased as `includes` and `include`.
    _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
        if (!isArrayLike(obj)) obj = _.values(obj);
        if (typeof fromIndex != 'number' || guard) fromIndex = 0;
        return _.indexOf(obj, item, fromIndex) >= 0;
    };

    // Invoke a method (with arguments) on every item in a collection.
    _.invoke = restArgs(function(obj, method, args) {
        var isFunc = _.isFunction(method);
        return _.map(obj, function(value) {
            var func = isFunc ? method : value[method];
            return func == null ? func : func.apply(value, args);
        });
    });

    // Convenience version of a common use case of `map`: fetching a property.
    _.pluck = function(obj, key) {
        return _.map(obj, _.property(key));
    };

    // Convenience version of a common use case of `filter`: selecting only objects
    // containing specific `key:value` pairs.
    _.where = function(obj, attrs) {
        return _.filter(obj, _.matcher(attrs));
    };

    // Convenience version of a common use case of `find`: getting the first object
    // containing specific `key:value` pairs.
    _.findWhere = function(obj, attrs) {
        return _.find(obj, _.matcher(attrs));
    };

    // Return the maximum element (or element-based computation).
    _.max = function(obj, iteratee, context) {
        var result = -Infinity,
            lastComputed = -Infinity,
            value, computed;
        if (iteratee == null && obj != null) {
            obj = isArrayLike(obj) ? obj : _.values(obj);
            for (var i = 0, length = obj.length; i < length; i++) {
                value = obj[i];
                if (value > result) {
                    result = value;
                }
            }
        } else {
            iteratee = cb(iteratee, context);
            _.each(obj, function(v, index, list) {
                computed = iteratee(v, index, list);
                if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
                    result = v;
                    lastComputed = computed;
                }
            });
        }
        return result;
    };

    // Return the minimum element (or element-based computation).
    _.min = function(obj, iteratee, context) {
        var result = Infinity,
            lastComputed = Infinity,
            value, computed;
        if (iteratee == null && obj != null) {
            obj = isArrayLike(obj) ? obj : _.values(obj);
            for (var i = 0, length = obj.length; i < length; i++) {
                value = obj[i];
                if (value < result) {
                    result = value;
                }
            }
        } else {
            iteratee = cb(iteratee, context);
            _.each(obj, function(v, index, list) {
                computed = iteratee(v, index, list);
                if (computed < lastComputed || computed === Infinity && result === Infinity) {
                    result = v;
                    lastComputed = computed;
                }
            });
        }
        return result;
    };

    // Shuffle a collection.
    _.shuffle = function(obj) {
        return _.sample(obj, Infinity);
    };

    // Sample **n** random values from a collection using the modern version of the
    // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
    // If **n** is not specified, returns a single random element.
    // The internal `guard` argument allows it to work with `map`.
    _.sample = function(obj, n, guard) {
        if (n == null || guard) {
            if (!isArrayLike(obj)) obj = _.values(obj);
            return obj[_.random(obj.length - 1)];
        }
        var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
        var length = getLength(sample);
        n = Math.max(Math.min(n, length), 0);
        var last = length - 1;
        for (var index = 0; index < n; index++) {
            var rand = _.random(index, last);
            var temp = sample[index];
            sample[index] = sample[rand];
            sample[rand] = temp;
        }
        return sample.slice(0, n);
    };

    // Sort the object's values by a criterion produced by an iteratee.
    _.sortBy = function(obj, iteratee, context) {
        iteratee = cb(iteratee, context);
        return _.pluck(_.map(obj, function(value, index, list) {
            return {
                value: value,
                index: index,
                criteria: iteratee(value, index, list)
            };
        }).sort(function(left, right) {
            var a = left.criteria;
            var b = right.criteria;
            if (a !== b) {
                if (a > b || a === void 0) return 1;
                if (a < b || b === void 0) return -1;
            }
            return left.index - right.index;
        }), 'value');
    };

    // An internal function used for aggregate "group by" operations.
    var group = function(behavior, partition) {
        return function(obj, iteratee, context) {
            var result = partition ? [
                [],
                []
            ] : {};
            iteratee = cb(iteratee, context);
            _.each(obj, function(value, index) {
                var key = iteratee(value, index, obj);
                behavior(result, value, key);
            });
            return result;
        };
    };

    // Groups the object's values by a criterion. Pass either a string attribute
    // to group by, or a function that returns the criterion.
    _.groupBy = group(function(result, value, key) {
        if (_.has(result, key)) result[key].push(value);
        else result[key] = [value];
    });

    // Indexes the object's values by a criterion, similar to `groupBy`, but for
    // when you know that your index values will be unique.
    _.indexBy = group(function(result, value, key) {
        result[key] = value;
    });

    // Counts instances of an object that group by a certain criterion. Pass
    // either a string attribute to count by, or a function that returns the
    // criterion.
    _.countBy = group(function(result, value, key) {
        if (_.has(result, key)) result[key]++;
        else result[key] = 1;
    });

    // Safely create a real, live array from anything iterable.
    _.toArray = function(obj) {
        if (!obj) return [];
        if (_.isArray(obj)) return slice.call(obj);
        if (isArrayLike(obj)) return _.map(obj, _.identity);
        return _.values(obj);
    };

    // Return the number of elements in an object.
    _.size = function(obj) {
        if (obj == null) return 0;
        return isArrayLike(obj) ? obj.length : _.keys(obj).length;
    };

    // Split a collection into two arrays: one whose elements all satisfy the given
    // predicate, and one whose elements all do not satisfy the predicate.
    _.partition = group(function(result, value, pass) {
        result[pass ? 0 : 1].push(value);
    }, true);

    // Array Functions
    // ---------------

    // Get the first element of an array. Passing **n** will return the first N
    // values in the array. Aliased as `head` and `take`. The **guard** check
    // allows it to work with `_.map`.
    _.first = _.head = _.take = function(array, n, guard) {
        if (array == null) return void 0;
        if (n == null || guard) return array[0];
        return _.initial(array, array.length - n);
    };

    // Returns everything but the last entry of the array. Especially useful on
    // the arguments object. Passing **n** will return all the values in
    // the array, excluding the last N.
    _.initial = function(array, n, guard) {
        return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
    };

    // Get the last element of an array. Passing **n** will return the last N
    // values in the array.
    _.last = function(array, n, guard) {
        if (array == null) return void 0;
        if (n == null || guard) return array[array.length - 1];
        return _.rest(array, Math.max(0, array.length - n));
    };

    // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
    // Especially useful on the arguments object. Passing an **n** will return
    // the rest N values in the array.
    _.rest = _.tail = _.drop = function(array, n, guard) {
        return slice.call(array, n == null || guard ? 1 : n);
    };

    // Trim out all falsy values from an array.
    _.compact = function(array) {
        return _.filter(array, _.identity);
    };

    // Internal implementation of a recursive `flatten` function.
    var flatten = function(input, shallow, strict) {
        var output = [],
            idx = 0;
        for (var i = 0, length = getLength(input); i < length; i++) {
            var value = input[i];
            if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
                //flatten current level of array or arguments object
                if (!shallow) value = flatten(value, shallow, strict);
                var j = 0,
                    len = value.length;
                output.length += len;
                while (j < len) {
                    output[idx++] = value[j++];
                }
            } else if (!strict) {
                output[idx++] = value;
            }
        }
        return output;
    };

    // Flatten out an array, either recursively (by default), or just one level.
    _.flatten = function(array, shallow) {
        return flatten(array, shallow, false);
    };

    // Return a version of the array that does not contain the specified value(s).
    _.without = restArgs(function(array, otherArrays) {
        return _.difference(array, otherArrays);
    });

    // Produce a duplicate-free version of the array. If the array has already
    // been sorted, you have the option of using a faster algorithm.
    // Aliased as `unique`.
    _.uniq = _.unique = function(array, isSorted, iteratee, context) {
        if (!_.isBoolean(isSorted)) {
            context = iteratee;
            iteratee = isSorted;
            isSorted = false;
        }
        if (iteratee != null) iteratee = cb(iteratee, context);
        var result = [];
        var seen = [];
        for (var i = 0, length = getLength(array); i < length; i++) {
            var value = array[i],
                computed = iteratee ? iteratee(value, i, array) : value;
            if (isSorted) {
                if (!i || seen !== computed) result.push(value);
                seen = computed;
            } else if (iteratee) {
                if (!_.contains(seen, computed)) {
                    seen.push(computed);
                    result.push(value);
                }
            } else if (!_.contains(result, value)) {
                result.push(value);
            }
        }
        return result;
    };

    // Produce an array that contains the union: each distinct element from all of
    // the passed-in arrays.
    _.union = restArgs(function(arrays) {
        return _.uniq(flatten(arrays, true, true));
    });

    // Produce an array that contains every item shared between all the
    // passed-in arrays.
    _.intersection = function(array) {
        var result = [];
        var argsLength = arguments.length;
        for (var i = 0, length = getLength(array); i < length; i++) {
            var item = array[i];
            if (_.contains(result, item)) continue;
            var j;
            for (j = 1; j < argsLength; j++) {
                if (!_.contains(arguments[j], item)) break;
            }
            if (j === argsLength) result.push(item);
        }
        return result;
    };

    // Take the difference between one array and a number of other arrays.
    // Only the elements present in just the first array will remain.
    _.difference = restArgs(function(array, rest) {
        rest = flatten(rest, true, true);
        return _.filter(array, function(value) {
            return !_.contains(rest, value);
        });
    });

    // Complement of _.zip. Unzip accepts an array of arrays and groups
    // each array's elements on shared indices
    _.unzip = function(array) {
        var length = array && _.max(array, getLength).length || 0;
        var result = Array(length);

        for (var index = 0; index < length; index++) {
            result[index] = _.pluck(array, index);
        }
        return result;
    };

    // Zip together multiple lists into a single array -- elements that share
    // an index go together.
    _.zip = restArgs(_.unzip);

    // Converts lists into objects. Pass either a single array of `[key, value]`
    // pairs, or two parallel arrays of the same length -- one of keys, and one of
    // the corresponding values.
    _.object = function(list, values) {
        var result = {};
        for (var i = 0, length = getLength(list); i < length; i++) {
            if (values) {
                result[list[i]] = values[i];
            } else {
                result[list[i][0]] = list[i][1];
            }
        }
        return result;
    };

    // Generator function to create the findIndex and findLastIndex functions
    var createPredicateIndexFinder = function(dir) {
        return function(array, predicate, context) {
            predicate = cb(predicate, context);
            var length = getLength(array);
            var index = dir > 0 ? 0 : length - 1;
            for (; index >= 0 && index < length; index += dir) {
                if (predicate(array[index], index, array)) return index;
            }
            return -1;
        };
    };

    // Returns the first index on an array-like that passes a predicate test
    _.findIndex = createPredicateIndexFinder(1);
    _.findLastIndex = createPredicateIndexFinder(-1);

    // Use a comparator function to figure out the smallest index at which
    // an object should be inserted so as to maintain order. Uses binary search.
    _.sortedIndex = function(array, obj, iteratee, context) {
        iteratee = cb(iteratee, context, 1);
        var value = iteratee(obj);
        var low = 0,
            high = getLength(array);
        while (low < high) {
            var mid = Math.floor((low + high) / 2);
            if (iteratee(array[mid]) < value) low = mid + 1;
            else high = mid;
        }
        return low;
    };

    // Generator function to create the indexOf and lastIndexOf functions
    var createIndexFinder = function(dir, predicateFind, sortedIndex) {
        return function(array, item, idx) {
            var i = 0,
                length = getLength(array);
            if (typeof idx == 'number') {
                if (dir > 0) {
                    i = idx >= 0 ? idx : Math.max(idx + length, i);
                } else {
                    length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
                }
            } else if (sortedIndex && idx && length) {
                idx = sortedIndex(array, item);
                return array[idx] === item ? idx : -1;
            }
            if (item !== item) {
                idx = predicateFind(slice.call(array, i, length), _.isNaN);
                return idx >= 0 ? idx + i : -1;
            }
            for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
                if (array[idx] === item) return idx;
            }
            return -1;
        };
    };

    // Return the position of the first occurrence of an item in an array,
    // or -1 if the item is not included in the array.
    // If the array is large and already in sort order, pass `true`
    // for **isSorted** to use binary search.
    _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
    _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

    // Generate an integer Array containing an arithmetic progression. A port of
    // the native Python `range()` function. See
    // [the Python documentation](http://docs.python.org/library/functions.html#range).
    _.range = function(start, stop, step) {
        if (stop == null) {
            stop = start || 0;
            start = 0;
        }
        step = step || 1;

        var length = Math.max(Math.ceil((stop - start) / step), 0);
        var range = Array(length);

        for (var idx = 0; idx < length; idx++, start += step) {
            range[idx] = start;
        }

        return range;
    };

    // Function (ahem) Functions
    // ------------------

    // Determines whether to execute a function as a constructor
    // or a normal function with the provided arguments
    var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
        if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
        var self = baseCreate(sourceFunc.prototype);
        var result = sourceFunc.apply(self, args);
        if (_.isObject(result)) return result;
        return self;
    };

    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    _.bind = function(func, context) {
        if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
        if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
        var args = slice.call(arguments, 2);
        var bound = restArgs(function(callArgs) {
            return executeBound(func, bound, context, this, args.concat(callArgs));
        });
        return bound;
    };

    // Partially apply a function by creating a version that has had some of its
    // arguments pre-filled, without changing its dynamic `this` context. _ acts
    // as a placeholder by default, allowing any combination of arguments to be
    // pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
    _.partial = restArgs(function(func, boundArgs) {
        var placeholder = _.partial.placeholder;
        var bound = function() {
            var position = 0,
                length = boundArgs.length;
            var args = Array(length);
            for (var i = 0; i < length; i++) {
                args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
            }
            while (position < arguments.length) args.push(arguments[position++]);
            return executeBound(func, bound, this, this, args);
        };
        return bound;
    });

    _.partial.placeholder = _;

    // Bind a number of an object's methods to that object. Remaining arguments
    // are the method names to be bound. Useful for ensuring that all callbacks
    // defined on an object belong to it.
    _.bindAll = restArgs(function(obj, keys) {
        keys = flatten(keys, false, false);
        var index = keys.length;
        if (index < 1) throw new Error('bindAll must be passed function names');
        while (index--) {
            var key = keys[index];
            obj[key] = _.bind(obj[key], obj);
        }
    });

    // Memoize an expensive function by storing its results.
    _.memoize = function(func, hasher) {
        var memoize = function(key) {
            var cache = memoize.cache;
            var address = '' + (hasher ? hasher.apply(this, arguments) : key);
            if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
            return cache[address];
        };
        memoize.cache = {};
        return memoize;
    };

    // Delays a function for the given number of milliseconds, and then calls
    // it with the arguments supplied.
    _.delay = restArgs(function(func, wait, args) {
        return setTimeout(function() {
            return func.apply(null, args);
        }, wait);
    });

    // Defers a function, scheduling it to run after the current call stack has
    // cleared.
    _.defer = _.partial(_.delay, _, 1);

    // Returns a function, that, when invoked, will only be triggered at most once
    // during a given window of time. Normally, the throttled function will run
    // as much as it can, without ever going more than once per `wait` duration;
    // but if you'd like to disable the execution on the leading edge, pass
    // `{leading: false}`. To disable execution on the trailing edge, ditto.
    _.throttle = function(func, wait, options) {
        var context, args, result;
        var timeout = null;
        var previous = 0;
        if (!options) options = {};
        var later = function() {
            previous = options.leading === false ? 0 : _.now();
            timeout = null;
            result = func.apply(context, args);
            if (!timeout) context = args = null;
        };
        return function() {
            var now = _.now();
            if (!previous && options.leading === false) previous = now;
            var remaining = wait - (now - previous);
            context = this;
            args = arguments;
            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                previous = now;
                result = func.apply(context, args);
                if (!timeout) context = args = null;
            } else if (!timeout && options.trailing !== false) {
                timeout = setTimeout(later, remaining);
            }
            return result;
        };
    };

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    _.debounce = function(func, wait, immediate) {
        var timeout, args, context, timestamp, result;

        var later = function() {
            var last = _.now() - timestamp;

            if (last < wait && last >= 0) {
                timeout = setTimeout(later, wait - last);
            } else {
                timeout = null;
                if (!immediate) {
                    result = func.apply(context, args);
                    if (!timeout) context = args = null;
                }
            }
        };

        return function() {
            context = this;
            args = arguments;
            timestamp = _.now();
            var callNow = immediate && !timeout;
            if (!timeout) timeout = setTimeout(later, wait);
            if (callNow) {
                result = func.apply(context, args);
                context = args = null;
            }

            return result;
        };
    };

    // Returns the first function passed as an argument to the second,
    // allowing you to adjust arguments, run code before and after, and
    // conditionally execute the original function.
    _.wrap = function(func, wrapper) {
        return _.partial(wrapper, func);
    };

    // Returns a negated version of the passed-in predicate.
    _.negate = function(predicate) {
        return function() {
            return !predicate.apply(this, arguments);
        };
    };

    // Returns a function that is the composition of a list of functions, each
    // consuming the return value of the function that follows.
    _.compose = function() {
        var args = arguments;
        var start = args.length - 1;
        return function() {
            var i = start;
            var result = args[start].apply(this, arguments);
            while (i--) result = args[i].call(this, result);
            return result;
        };
    };

    // Returns a function that will only be executed on and after the Nth call.
    _.after = function(times, func) {
        return function() {
            if (--times < 1) {
                return func.apply(this, arguments);
            }
        };
    };

    // Returns a function that will only be executed up to (but not including) the Nth call.
    _.before = function(times, func) {
        var memo;
        return function() {
            if (--times > 0) {
                memo = func.apply(this, arguments);
            }
            if (times <= 1) func = null;
            return memo;
        };
    };

    // Returns a function that will be executed at most one time, no matter how
    // often you call it. Useful for lazy initialization.
    _.once = _.partial(_.before, 2);

    _.restArgs = restArgs;

    // Object Functions
    // ----------------

    // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
    var hasEnumBug = !{
        toString: null
    }.propertyIsEnumerable('toString');
    var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
        'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'
    ];

    var collectNonEnumProps = function(obj, keys) {
        var nonEnumIdx = nonEnumerableProps.length;
        var constructor = obj.constructor;
        var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

        // Constructor is a special case.
        var prop = 'constructor';
        if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

        while (nonEnumIdx--) {
            prop = nonEnumerableProps[nonEnumIdx];
            if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
                keys.push(prop);
            }
        }
    };

    // Retrieve the names of an object's own properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`
    _.keys = function(obj) {
        if (!_.isObject(obj)) return [];
        if (nativeKeys) return nativeKeys(obj);
        var keys = [];
        for (var key in obj)
            if (_.has(obj, key)) keys.push(key);
            // Ahem, IE < 9.
        if (hasEnumBug) collectNonEnumProps(obj, keys);
        return keys;
    };

    // Retrieve all the property names of an object.
    _.allKeys = function(obj) {
        if (!_.isObject(obj)) return [];
        var keys = [];
        for (var key in obj) keys.push(key);
        // Ahem, IE < 9.
        if (hasEnumBug) collectNonEnumProps(obj, keys);
        return keys;
    };

    // Retrieve the values of an object's properties.
    _.values = function(obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var values = Array(length);
        for (var i = 0; i < length; i++) {
            values[i] = obj[keys[i]];
        }
        return values;
    };

    // Returns the results of applying the iteratee to each element of the object
    // In contrast to _.map it returns an object
    _.mapObject = function(obj, iteratee, context) {
        iteratee = cb(iteratee, context);
        var keys = _.keys(obj),
            length = keys.length,
            results = {};
        for (var index = 0; index < length; index++) {
            var currentKey = keys[index];
            results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
        }
        return results;
    };

    // Convert an object into a list of `[key, value]` pairs.
    _.pairs = function(obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var pairs = Array(length);
        for (var i = 0; i < length; i++) {
            pairs[i] = [keys[i], obj[keys[i]]];
        }
        return pairs;
    };

    // Invert the keys and values of an object. The values must be serializable.
    _.invert = function(obj) {
        var result = {};
        var keys = _.keys(obj);
        for (var i = 0, length = keys.length; i < length; i++) {
            result[obj[keys[i]]] = keys[i];
        }
        return result;
    };

    // Return a sorted list of the function names available on the object.
    // Aliased as `methods`
    _.functions = _.methods = function(obj) {
        var names = [];
        for (var key in obj) {
            if (_.isFunction(obj[key])) names.push(key);
        }
        return names.sort();
    };

    // An internal function for creating assigner functions.
    var createAssigner = function(keysFunc, undefinedOnly) {
        return function(obj) {
            var length = arguments.length;
            if (length < 2 || obj == null) return obj;
            for (var index = 1; index < length; index++) {
                var source = arguments[index],
                    keys = keysFunc(source),
                    l = keys.length;
                for (var i = 0; i < l; i++) {
                    var key = keys[i];
                    if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
                }
            }
            return obj;
        };
    };

    // Extend a given object with all the properties in passed-in object(s).
    _.extend = createAssigner(_.allKeys);

    // Assigns a given object with all the own properties in the passed-in object(s)
    // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
    _.extendOwn = _.assign = createAssigner(_.keys);

    // Returns the first key on an object that passes a predicate test
    _.findKey = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = _.keys(obj),
            key;
        for (var i = 0, length = keys.length; i < length; i++) {
            key = keys[i];
            if (predicate(obj[key], key, obj)) return key;
        }
    };

    // Internal pick helper function to determine if `obj` has key `key`.
    var keyInObj = function(value, key, obj) {
        return key in obj;
    };

    // Return a copy of the object only containing the whitelisted properties.
    _.pick = restArgs(function(obj, keys) {
        var result = {},
            iteratee = keys[0];
        if (obj == null) return result;
        if (_.isFunction(iteratee)) {
            if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
            keys = _.allKeys(obj);
        } else {
            iteratee = keyInObj;
            keys = flatten(keys, false, false);
            obj = Object(obj);
        }
        for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i];
            var value = obj[key];
            if (iteratee(value, key, obj)) result[key] = value;
        }
        return result;
    });

    // Return a copy of the object without the blacklisted properties.
    _.omit = restArgs(function(obj, keys) {
        var iteratee = keys[0],
            context;
        if (_.isFunction(iteratee)) {
            iteratee = _.negate(iteratee);
            if (keys.length > 1) context = keys[1];
        } else {
            keys = _.map(flatten(keys, false, false), String);
            iteratee = function(value, key) {
                return !_.contains(keys, key);
            };
        }
        return _.pick(obj, iteratee, context);
    });

    // Fill in a given object with default properties.
    _.defaults = createAssigner(_.allKeys, true);

    // Creates an object that inherits from the given prototype object.
    // If additional properties are provided then they will be added to the
    // created object.
    _.create = function(prototype, props) {
        var result = baseCreate(prototype);
        if (props) _.extendOwn(result, props);
        return result;
    };

    // Create a (shallow-cloned) duplicate of an object.
    _.clone = function(obj) {
        if (!_.isObject(obj)) return obj;
        return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
    };

    // Invokes interceptor with the obj, and then returns obj.
    // The primary purpose of this method is to "tap into" a method chain, in
    // order to perform operations on intermediate results within the chain.
    _.tap = function(obj, interceptor) {
        interceptor(obj);
        return obj;
    };

    // Returns whether an object has a given set of `key:value` pairs.
    _.isMatch = function(object, attrs) {
        var keys = _.keys(attrs),
            length = keys.length;
        if (object == null) return !length;
        var obj = Object(object);
        for (var i = 0; i < length; i++) {
            var key = keys[i];
            if (attrs[key] !== obj[key] || !(key in obj)) return false;
        }
        return true;
    };


    // Internal recursive comparison function for `isEqual`.
    var eq, deepEq;
    eq = function(a, b, aStack, bStack) {
        // Identical objects are equal. `0 === -0`, but they aren't identical.
        // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
        if (a === b) return a !== 0 || 1 / a === 1 / b;
        // A strict comparison is necessary because `null == undefined`.
        if (a == null || b == null) return a === b;
        // `NaN`s are equivalent, but non-reflexive.
        if (a !== a) return b !== b;
        // Exhaust primitive checks
        var type = typeof a;
        if (type !== 'function' && type !== 'object' && typeof b !== 'object') return false;
        return deepEq(a, b, aStack, bStack);
    };

    // Internal recursive comparison function for `isEqual`.
    deepEq = function(a, b, aStack, bStack) {
        // Unwrap any wrapped objects.
        if (a instanceof _) a = a._wrapped;
        if (b instanceof _) b = b._wrapped;
        // Compare `[[Class]]` names.
        var className = toString.call(a);
        if (className !== toString.call(b)) return false;
        switch (className) {
            // Strings, numbers, regular expressions, dates, and booleans are compared by value.
            case '[object RegExp]':
                // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
            case '[object String]':
                // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
                // equivalent to `new String("5")`.
                return '' + a === '' + b;
            case '[object Number]':
                // `NaN`s are equivalent, but non-reflexive.
                // Object(NaN) is equivalent to NaN
                if (+a !== +a) return +b !== +b;
                // An `egal` comparison is performed for other numeric values.
                return +a === 0 ? 1 / +a === 1 / b : +a === +b;
            case '[object Date]':
            case '[object Boolean]':
                // Coerce dates and booleans to numeric primitive values. Dates are compared by their
                // millisecond representations. Note that invalid dates with millisecond representations
                // of `NaN` are not equivalent.
                return +a === +b;
        }

        var areArrays = className === '[object Array]';
        if (!areArrays) {
            if (typeof a != 'object' || typeof b != 'object') return false;

            // Objects with different constructors are not equivalent, but `Object`s or `Array`s
            // from different frames are.
            var aCtor = a.constructor,
                bCtor = b.constructor;
            if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                    _.isFunction(bCtor) && bCtor instanceof bCtor) && ('constructor' in a && 'constructor' in b)) {
                return false;
            }
        }
        // Assume equality for cyclic structures. The algorithm for detecting cyclic
        // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

        // Initializing stack of traversed objects.
        // It's done here since we only need them for objects and arrays comparison.
        aStack = aStack || [];
        bStack = bStack || [];
        var length = aStack.length;
        while (length--) {
            // Linear search. Performance is inversely proportional to the number of
            // unique nested structures.
            if (aStack[length] === a) return bStack[length] === b;
        }

        // Add the first object to the stack of traversed objects.
        aStack.push(a);
        bStack.push(b);

        // Recursively compare objects and arrays.
        if (areArrays) {
            // Compare array lengths to determine if a deep comparison is necessary.
            length = a.length;
            if (length !== b.length) return false;
            // Deep compare the contents, ignoring non-numeric properties.
            while (length--) {
                if (!eq(a[length], b[length], aStack, bStack)) return false;
            }
        } else {
            // Deep compare objects.
            var keys = _.keys(a),
                key;
            length = keys.length;
            // Ensure that both objects contain the same number of properties before comparing deep equality.
            if (_.keys(b).length !== length) return false;
            while (length--) {
                // Deep compare each member
                key = keys[length];
                if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
            }
        }
        // Remove the first object from the stack of traversed objects.
        aStack.pop();
        bStack.pop();
        return true;
    };

    // Perform a deep comparison to check if two objects are equal.
    _.isEqual = function(a, b) {
        return eq(a, b);
    };

    // Is a given array, string, or object empty?
    // An "empty" object has no enumerable own-properties.
    _.isEmpty = function(obj) {
        if (obj == null) return true;
        if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
        return _.keys(obj).length === 0;
    };

    // Is a given value a DOM element?
    _.isElement = function(obj) {
        return !!(obj && obj.nodeType === 1);
    };

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    _.isArray = nativeIsArray || function(obj) {
        return toString.call(obj) === '[object Array]';
    };

    // Is a given variable an object?
    _.isObject = function(obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };

    // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
    _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
        _['is' + name] = function(obj) {
            return toString.call(obj) === '[object ' + name + ']';
        };
    });

    // Define a fallback version of the method in browsers (ahem, IE < 9), where
    // there isn't any inspectable "Arguments" type.
    if (!_.isArguments(arguments)) {
        _.isArguments = function(obj) {
            return _.has(obj, 'callee');
        };
    }

    // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
    // IE 11 (#1621), and in Safari 8 (#1929).
    if (typeof /./ != 'function' && typeof Int8Array != 'object') {
        _.isFunction = function(obj) {
            return typeof obj == 'function' || false;
        };
    }

    // Is a given object a finite number?
    _.isFinite = function(obj) {
        return isFinite(obj) && !isNaN(parseFloat(obj));
    };

    // Is the given value `NaN`? (NaN is the only number which does not equal itself).
    _.isNaN = function(obj) {
        return _.isNumber(obj) && obj !== +obj;
    };

    // Is a given value a boolean?
    _.isBoolean = function(obj) {
        return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
    };

    // Is a given value equal to null?
    _.isNull = function(obj) {
        return obj === null;
    };

    // Is a given variable undefined?
    _.isUndefined = function(obj) {
        return obj === void 0;
    };

    // Shortcut function for checking if an object has a given property directly
    // on itself (in other words, not on a prototype).
    _.has = function(obj, key) {
        return obj != null && hasOwnProperty.call(obj, key);
    };

    // Utility Functions
    // -----------------

    // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
    // previous owner. Returns a reference to the Underscore object.
    _.noConflict = function() {
        root._ = previousUnderscore;
        return this;
    };

    // Keep the identity function around for default iteratees.
    _.identity = function(value) {
        return value;
    };

    // Predicate-generating functions. Often useful outside of Underscore.
    _.constant = function(value) {
        return function() {
            return value;
        };
    };

    _.noop = function() {};

    _.property = property;

    // Generates a function for a given object that returns a given property.
    _.propertyOf = function(obj) {
        return obj == null ? function() {} : function(key) {
            return obj[key];
        };
    };

    // Returns a predicate for checking whether an object has a given set of
    // `key:value` pairs.
    _.matcher = _.matches = function(attrs) {
        attrs = _.extendOwn({}, attrs);
        return function(obj) {
            return _.isMatch(obj, attrs);
        };
    };

    // Run a function **n** times.
    _.times = function(n, iteratee, context) {
        var accum = Array(Math.max(0, n));
        iteratee = optimizeCb(iteratee, context, 1);
        for (var i = 0; i < n; i++) accum[i] = iteratee(i);
        return accum;
    };

    // Return a random integer between min and max (inclusive).
    _.random = function(min, max) {
        if (max == null) {
            max = min;
            min = 0;
        }
        return min + Math.floor(Math.random() * (max - min + 1));
    };

    // A (possibly faster) way to get the current timestamp as an integer.
    _.now = Date.now || function() {
        return new Date().getTime();
    };

    // List of HTML entities for escaping.
    var escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '`': '&#x60;'
    };
    var unescapeMap = _.invert(escapeMap);

    // Functions for escaping and unescaping strings to/from HTML interpolation.
    var createEscaper = function(map) {
        var escaper = function(match) {
            return map[match];
        };
        // Regexes for identifying a key that needs to be escaped
        var source = '(?:' + _.keys(map).join('|') + ')';
        var testRegexp = RegExp(source);
        var replaceRegexp = RegExp(source, 'g');
        return function(string) {
            string = string == null ? '' : '' + string;
            return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
        };
    };
    _.escape = createEscaper(escapeMap);
    _.unescape = createEscaper(unescapeMap);

    // If the value of the named `property` is a function then invoke it with the
    // `object` as context; otherwise, return it.
    _.result = function(object, prop, fallback) {
        var value = object == null ? void 0 : object[prop];
        if (value === void 0) {
            value = fallback;
        }
        return _.isFunction(value) ? value.call(object) : value;
    };

    // Generate a unique integer id (unique within the entire client session).
    // Useful for temporary DOM ids.
    var idCounter = 0;
    _.uniqueId = function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
    };

    // Add a "chain" function. Start chaining a wrapped Underscore object.
    _.chain = function(obj) {
        var instance = _(obj);
        instance._chain = true;
        return instance;
    };

    // OOP
    // ---------------
    // If Underscore is called as a function, it returns a wrapped object that
    // can be used OO-style. This wrapper holds altered versions of all the
    // underscore functions. Wrapped objects may be chained.

    // Helper function to continue chaining intermediate results.
    var chainResult = function(instance, obj) {
        return instance._chain ? _(obj).chain() : obj;
    };

    // Add your own custom functions to the Underscore object.
    _.mixin = function(obj) {
        _.each(_.functions(obj), function(name) {
            var func = _[name] = obj[name];
            _.prototype[name] = function() {
                var args = [this._wrapped];
                push.apply(args, arguments);
                return chainResult(this, func.apply(_, args));
            };
        });
    };

    // Add all of the Underscore functions to the wrapper object.
    _.mixin(_);

    // Add all mutator Array functions to the wrapper.
    _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
            var obj = this._wrapped;
            method.apply(obj, arguments);
            if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
            return chainResult(this, obj);
        };
    });

    // Add all accessor Array functions to the wrapper.
    _.each(['concat', 'join', 'slice'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
            return chainResult(this, method.apply(this._wrapped, arguments));
        };
    });

    // Extracts the result from a wrapped and chained object.
    _.prototype.value = function() {
        return this._wrapped;
    };

    // Provide unwrapping proxy for some methods used in engine operations
    // such as arithmetic and JSON stringification.
    _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

    _.prototype.toString = function() {
        return '' + this._wrapped;
    };

    return root._;

});