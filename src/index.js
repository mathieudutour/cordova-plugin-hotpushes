/* **********************
*
* PROMISE POLYFILL
*
***********************/

/* eslint-disable */
(function e(t, n, r) {
  function s(o, u) {
    if (!n[o]) {
      if (!t[o]) {
        var a = typeof require == "function" && require;
        if (!u && a) return a(o, !0);
        if (i) return i(o, !0);
        var f = new Error("Cannot find module '" + o + "'");
        throw f.code = "MODULE_NOT_FOUND", f;
      }
      var l = n[o] = {
        exports: {}
      };
      t[o][0].call(l.exports, function(e) {
        var n = t[o][1][e];
        return s(n ? n : e);
      }, l, l.exports, e, t, n, r);
    }
    return n[o].exports;
  }
  var i = typeof require == "function" && require;
  for (var o = 0; o < r.length; o++) s(r[o]);
  return s;
})({
  1: [ function(require, module, exports) {
    var process = module.exports = {};
    process.nextTick = function() {
      var canSetImmediate = typeof window !== "undefined" && window.setImmediate;
      var canPost = typeof window !== "undefined" && window.postMessage && window.addEventListener;
      if (canSetImmediate) {
        return function(f) {
          return window.setImmediate(f);
        };
      }
      if (canPost) {
        var queue = [];
        window.addEventListener("message", function(ev) {
          var source = ev.source;
          if ((source === window || source === null) && ev.data === "process-tick") {
            ev.stopPropagation();
            if (queue.length > 0) {
              var fn = queue.shift();
              fn();
            }
          }
        }, true);
        return function nextTick(fn) {
          queue.push(fn);
          window.postMessage("process-tick", "*");
        };
      }
      return function nextTick(fn) {
        setTimeout(fn, 0);
      };
    }();
    process.title = "browser";
    process.browser = true;
    process.env = {};
    process.argv = [];
    function noop() {}
    process.on = noop;
    process.addListener = noop;
    process.once = noop;
    process.off = noop;
    process.removeListener = noop;
    process.removeAllListeners = noop;
    process.emit = noop;
    process.binding = function(name) {
      throw new Error("process.binding is not supported");
    };
    process.cwd = function() {
      return "/";
    };
    process.chdir = function(dir) {
      throw new Error("process.chdir is not supported");
    };
  }, {} ],
  2: [ function(require, module, exports) {
    "use strict";
    var asap = require("asap");
    module.exports = Promise;
    function Promise(fn) {
      if (typeof this !== "object") throw new TypeError("Promises must be constructed via new");
      if (typeof fn !== "function") throw new TypeError("not a function");
      var state = null;
      var value = null;
      var deferreds = [];
      var self = this;
      this.then = function(onFulfilled, onRejected) {
        return new self.constructor(function(resolve, reject) {
          handle(new Handler(onFulfilled, onRejected, resolve, reject));
        });
      };
      function handle(deferred) {
        if (state === null) {
          deferreds.push(deferred);
          return;
        }
        asap(function() {
          var cb = state ? deferred.onFulfilled : deferred.onRejected;
          if (cb === null) {
            (state ? deferred.resolve : deferred.reject)(value);
            return;
          }
          var ret;
          try {
            ret = cb(value);
          } catch (e) {
            deferred.reject(e);
            return;
          }
          deferred.resolve(ret);
        });
      }
      function resolve(newValue) {
        try {
          if (newValue === self) throw new TypeError("A promise cannot be resolved with itself.");
          if (newValue && (typeof newValue === "object" || typeof newValue === "function")) {
            var then = newValue.then;
            if (typeof then === "function") {
              doResolve(then.bind(newValue), resolve, reject);
              return;
            }
          }
          state = true;
          value = newValue;
          finale();
        } catch (e) {
          reject(e);
        }
      }
      function reject(newValue) {
        state = false;
        value = newValue;
        finale();
      }
      function finale() {
        for (var i = 0, len = deferreds.length; i < len; i++) handle(deferreds[i]);
        deferreds = null;
      }
      doResolve(fn, resolve, reject);
    }
    function Handler(onFulfilled, onRejected, resolve, reject) {
      this.onFulfilled = typeof onFulfilled === "function" ? onFulfilled : null;
      this.onRejected = typeof onRejected === "function" ? onRejected : null;
      this.resolve = resolve;
      this.reject = reject;
    }
    function doResolve(fn, onFulfilled, onRejected) {
      var done = false;
      try {
        fn(function(value) {
          if (done) return;
          done = true;
          onFulfilled(value);
        }, function(reason) {
          if (done) return;
          done = true;
          onRejected(reason);
        });
      } catch (ex) {
        if (done) return;
        done = true;
        onRejected(ex);
      }
    }
  }, {
    asap: 4
  } ],
  3: [ function(require, module, exports) {
    "use strict";
    var Promise = require("./core.js");
    var asap = require("asap");
    module.exports = Promise;
    function ValuePromise(value) {
      this.then = function(onFulfilled) {
        if (typeof onFulfilled !== "function") return this;
        return new Promise(function(resolve, reject) {
          asap(function() {
            try {
              resolve(onFulfilled(value));
            } catch (ex) {
              reject(ex);
            }
          });
        });
      };
    }
    ValuePromise.prototype = Promise.prototype;
    var TRUE = new ValuePromise(true);
    var FALSE = new ValuePromise(false);
    var NULL = new ValuePromise(null);
    var UNDEFINED = new ValuePromise(undefined);
    var ZERO = new ValuePromise(0);
    var EMPTYSTRING = new ValuePromise("");
    Promise.resolve = function(value) {
      if (value instanceof Promise) return value;
      if (value === null) return NULL;
      if (value === undefined) return UNDEFINED;
      if (value === true) return TRUE;
      if (value === false) return FALSE;
      if (value === 0) return ZERO;
      if (value === "") return EMPTYSTRING;
      if (typeof value === "object" || typeof value === "function") {
        try {
          var then = value.then;
          if (typeof then === "function") {
            return new Promise(then.bind(value));
          }
        } catch (ex) {
          return new Promise(function(resolve, reject) {
            reject(ex);
          });
        }
      }
      return new ValuePromise(value);
    };
    Promise.all = function(arr) {
      var args = Array.prototype.slice.call(arr);
      return new Promise(function(resolve, reject) {
        if (args.length === 0) return resolve([]);
        var remaining = args.length;
        function res(i, val) {
          try {
            if (val && (typeof val === "object" || typeof val === "function")) {
              var then = val.then;
              if (typeof then === "function") {
                then.call(val, function(val) {
                  res(i, val);
                }, reject);
                return;
              }
            }
            args[i] = val;
            if (--remaining === 0) {
              resolve(args);
            }
          } catch (ex) {
            reject(ex);
          }
        }
        for (var i = 0; i < args.length; i++) {
          res(i, args[i]);
        }
      });
    };
    Promise.reject = function(value) {
      return new Promise(function(resolve, reject) {
        reject(value);
      });
    };
    Promise.race = function(values) {
      return new Promise(function(resolve, reject) {
        values.forEach(function(value) {
          Promise.resolve(value).then(resolve, reject);
        });
      });
    };
    Promise.prototype["catch"] = function(onRejected) {
      return this.then(null, onRejected);
    };
  }, {
    "./core.js": 2,
    asap: 4
  } ],
  4: [ function(require, module, exports) {
    (function(process) {
      var head = {
        task: void 0,
        next: null
      };
      var tail = head;
      var flushing = false;
      var requestFlush = void 0;
      function flush() {
        while (head.next) {
          head = head.next;
          var task = head.task;
          head.task = void 0;
          var domain = head.domain;
          if (domain) {
            head.domain = void 0;
            domain.enter();
          }
          try {
            task();
          } catch (e) {
            setTimeout(function() {
              throw e;
            }, 0);
          }
          if (domain) {
            domain.exit();
          }
        }
        flushing = false;
      }
      if (typeof setImmediate === "function") {
        if (typeof window !== "undefined") {
          requestFlush = setImmediate.bind(window, flush);
        } else {
          requestFlush = function() {
            setImmediate(flush);
          };
        }
      } else if (typeof MessageChannel !== "undefined") {
        var channel = new MessageChannel();
        channel.port1.onmessage = flush;
        requestFlush = function() {
          channel.port2.postMessage(0);
        };
      } else {
        requestFlush = function() {
          setTimeout(flush, 0);
        };
      }
      function asap(task) {
        tail = tail.next = {
          task: task,
          domain: false,
          next: null
        };
        if (!flushing) {
          flushing = true;
          requestFlush();
        }
      }
      module.exports = asap;
    }).call(this, require("_process"));
  }, {
    _process: 1
  } ],
  6: [ function(require, module, exports) {
    var asap = require("asap");
    if (typeof Promise === "undefined") {
      Promise = require("./lib/core.js");
      require("./lib/es6-extensions.js");
    }
  }, {
    "./lib/core.js": 2,
    "./lib/es6-extensions.js": 3,
    asap: 4
  } ]
}, {}, [ 6 ]);

/* eslint-enable */

/* global cordova, localStorage, XMLHttpRequest */

const ContentSync = cordova.require('phonegap-plugin-contentsync.ContentSync')

const HOTPUSH_TYPE = {
  'MERGE': 'merge',
  'REPLACE': 'replace'
}

const HOTPUSH_CHECK_TYPE = {
  'VERSION': 'version',
  'TIMESTAMP': 'timestamp'
}

const PROGRESS_STATE = {
  0: 'STOPPED',
  1: 'DOWNLOADING',
  2: 'EXTRACTING',
  3: 'COMPLETE'
}

const ERROR_STATE = {
  1: 'INVALID_URL_ERR',
  2: 'CONNECTION_ERR',
  3: 'UNZIP_ERR'
}

const UPDATE = {
  NOT_FOUND: 'NOT_FOUND',
  FOUND: 'FOUND'
}

/**
 * HotPush constructor.
 *
 * @param {Object} options to initiate a new content synchronization.
 *   @param {String} src is a URL to hot push endpoint
 *   @param {String} versionFileName is the name of the json file containing the version information
 *   @param {String} type defines the hot push strategy applied to the content.
 *        HOTPUSH_TYPE.REPLACE completely removes existing content then copies new content from a zip file.
 *        HOTPUSH_TYPE.MERGE download and replace only content which has changed
 *   @param {String} archiveURL is the url of the zip containing the files to hot push (if type === replace)
 *   @param {Object} headers are used to set the headers for when we send a request to the src URL
 *   @param {Boolean} copyCordovaAssets Copy the cordova assets
 *   @param {String} documentsPath is the path to the Documents folder
 *   @param {String} checkType defines the type of check to do to see if we have the last version
 *        HOTPUSH_CHECK_TYPE.VERSION
 *        HOTPUSH_CHECK_TYPE.TIMESTAMP
 * @return {HotPush} instance that can be monitored and cancelled.
 */

const HotPush = function contructor (options) {
  this._handlers = {
    'progress': []
  }

  // require options parameter
  if (typeof options === 'undefined') {
    throw new Error('The options argument is required.')
  }

  // require options.src parameter
  if (typeof options.src === 'undefined') {
    throw new Error('The options.src argument is required.')
  }

  // require options.versionJSONFileName parameter
  if (typeof options.versionFileName === 'undefined') {
    throw new Error('The options.versionFileName argument is required.')
  }

  // define synchronization strategy
  //
  //     HOTPUSH_TYPE.REPLACE: This is the normal behavior. completely removes existing
  //              content then copies new content from a zip file.
  //     HOTPUSH_TYPE.MERGE:   Download and replace only content which has changed
  //
  if (typeof options.type === 'undefined') {
    options.type = HOTPUSH_TYPE.REPLACE
  }

  if (options.type === 'replace' && typeof options.archiveURL === 'undefined') {
    throw new Error('The options.archiveURL argument is required when type === replace.')
  }

  if (options.type === HOTPUSH_TYPE.MERGE) {
    throw new Error('not implemented yet, PR welcome https://github.com/mathieudutour/cordova-plugin-hotpushes')
  } else if (options.type !== HOTPUSH_TYPE.REPLACE) {
    throw new Error('unknown hotpush type')
  }

  if (typeof options.headers === 'undefined') {
    options.headers = null
  }

  if (typeof options.documentsPath === 'undefined') {
    options.documentsPath = 'cdvfile://localhost/persistent/'
  }

  if (typeof options.copyCordovaAssets === 'undefined') {
    options.copyCordovaAssets = true
  }

  // optional version type for update checks
  // default check method uses timestamp
  // 'version' option will use the version number in your package.json
  if (typeof options.checkType === 'undefined') {
    options.checkType = HOTPUSH_CHECK_TYPE.TIMESTAMP
  }
  if (options.checkType !== HOTPUSH_CHECK_TYPE.TIMESTAMP &&
      options.checkType !== HOTPUSH_CHECK_TYPE.VERSION) {
    throw new Error('unknown hotpush check type')
  }

  // store the options to this object instance
  this.options = options

  this.localVersion = null
  this.remoteVersion = null

  this.lastUpdate = localStorage.hotpushes_lastUpdate
  this.lastCheck = localStorage.hotpushes_lastCheck

  this._syncs = []
  this.logs = []
}

/**
* Load all local files
*/
HotPush.prototype.debug = function (...args) {
  if (this.options.debug) {
    this.logs.push([args])
    console.log('[hotpushes] ', ...args)
  }
}

/**
* Check if there is a new version available
*/
HotPush.prototype.check = function () {
  return new Promise(function (resolve, reject) {
    this._getLocalVersion().then(function (localVersion) {
      try {
        const remoteRequest = new XMLHttpRequest()
        const url = this.options.src + this.options.versionFileName + '?v=' + this.localVersion.version
        this.debug('fetch remote version at ' + url)
        // fetch remoteVersion
        remoteRequest.open('GET', url, true)

        remoteRequest.onload = function () {
          if (remoteRequest.status >= 200 && remoteRequest.status < 400) {
            // Success!
            const remoteVersion = JSON.parse(remoteRequest.responseText)
            this.remoteVersion = JSON.parse(remoteRequest.responseText)
            this.debug('found remote version', this.remoteVersion)
            resolve(this._verifyVersions(localVersion, remoteVersion))
          } else {
            this.debug('nothing on the remote')
            resolve(UPDATE.NOT_FOUND)
          }
        }.bind(this)

        remoteRequest.onerror = function (err) {
          this.debug(err)
          reject(err)
        }.bind(this)

        remoteRequest.send()
      } catch (err) {
        this.debug(err)
        reject(err)
      }
    }.bind(this)).catch(reject)
  }.bind(this))
}

/**
* Load waiting local files
*/
HotPush.prototype.loadWaitingLocalFiles = function () {
  return new Promise(function (resolve, reject) {
    this._getLocalVersion().then(function (localVersion) {
      this.debug('load waiting local files')
      this._currentPosition = -1
      return [localVersion, -1, false]
    }.bind(this))
    .then(this._loadLocalFilesFromPosition.bind(this))
    .then(resolve)
    .catch(reject)
  }.bind(this))
}

/**
* Load all local files
*/
HotPush.prototype.loadLocalFiles = function () {
  return new Promise(function (resolve, reject) {
    this._getLocalVersion().then(function (localVersion) {
      this.debug('load all local files')
      this._currentPosition = 0
      return [localVersion, 0]
    }.bind(this)).then(this._loadLocalFilesFromPosition.bind(this))
    .then(resolve)
    .catch(reject)
  }.bind(this))
}

/**
* Load local files at position
*/
HotPush.prototype._loadLocalFilesFromPosition = function ([{files}, position, continueToNextPosition = true]) {
  return new Promise(function (resolve, reject) {
    let nbScript = files.filter((file) => {
      return file.position === position &&
        file.name.split('.js').length > 1
    }).length

    this.debug(`load local files at position ${position} (${nbScript} left) ...`)

    function callback () {
      nbScript--
      this.debug(`finish loading a file at position ${position} (${nbScript === -1 ? 'none' : nbScript} left)`)
      if (!nbScript) {
        if (continueToNextPosition) {
          this._loadLocalFilesFromPosition([{files}, ++position, continueToNextPosition])
            .then(resolve)
            .catch(reject)
        } else {
          resolve('done')
        }
      }
    }

    if (!files.filter((file) => file.position === position).length) {
      return resolve('nothing to do')
    }

    files.forEach(function (file) {
      if (file.position === position) {
        this._loadLocalFile(file.name, callback.bind(this))
      }
    }.bind(this))
  }.bind(this))
}

/**
* Start the update
*/
HotPush.prototype.update = function () {
  return new Promise(function (resolve, reject) {
    if (this.options.type === HOTPUSH_TYPE.REPLACE) {
      this._syncs = [ContentSync.sync({
        src: this.options.archiveURL + '?v=' + this.localVersion.version,
        id: 'assets',
        copyCordovaAssets: this.options.copyCordovaAssets,
        headers: this.options.headers
      })]

      this.debug('Start the update...')

      this._syncs[0].on('progress', function (data) {
        this.debug('progress: ' + PROGRESS_STATE[data.status] + ' - ' + data.progress)
        this.emit('progress', data)
      }.bind(this))

      this._syncs[0].on('complete', function (data) {
        this.remoteVersion.location = 'documents'
        this.remoteVersion.path = data.localPath
        localStorage.hotpushes_localVersion = JSON.stringify(this.remoteVersion)
        this.localVersion = this.remoteVersion
        this.lastUpdate = Date.now()
        localStorage.hotpushes_lastUpdate = this.lastUpdate
        this.debug('update complete', data)
        this.debug('new localVersion', this.localVersion)
        resolve(data.localPath)
      }.bind(this))

      this._syncs[0].on('error', function (err) {
        const error = new Error(ERROR_STATE[err])
        this.debug(error)
        reject(error)
      }.bind(this))
    } else if (this.options.type === HOTPUSH_TYPE.MERGE) {
      const error = new Error('unknown hotpush type')
      this.debug(error)
      reject(error)
    }
  }.bind(this))
}

/**
* Get the path to a local file
*/
HotPush.prototype._getLocalPath = function (filename) {
  if (this.localVersion.location === 'bundle') {
    return filename
  }
  return this.options.documentsPath + filename
}

/**
* Fetch the local version of the version file
*/
HotPush.prototype._getLocalVersion = function () {
  return new Promise(function (resolve, reject) {
    function checkIfAlreadyThere () {
      if (this.localVersion) {
        resolve(this.localVersion)
        return true
      }

      if (this._alreadyLookingForLocalVersion) { // come back in 15ms
        setTimeout(checkIfAlreadyThere.bind(this), 15)
        return true
      }
    }
    if (checkIfAlreadyThere.call(this)) { return }

    this._alreadyLookingForLocalVersion = true

    const previousVersionOfBundle = localStorage.hotpushes_bundleVersion

    this.debug('Previous version of bundle - ' + previousVersionOfBundle)
    this.debug('fetch localVersion from bundle...')

    // fetch bundleVersion
    const request = new XMLHttpRequest()
    request.open('GET', this.options.versionFileName, true)

    request.onload = function () {
      try {
        if (request.status === 0 || request.status >= 200 && request.status < 400) {
          // Success!
          var currentVersionOfBundle = request.responseText

          if (currentVersionOfBundle !== previousVersionOfBundle) { // if we have a new version in the bundle, use it
            localStorage.hotpushes_bundleVersion = currentVersionOfBundle
            this.localVersion = JSON.parse(currentVersionOfBundle)
            this.localVersion.location = 'bundle'
            localStorage.hotpushes_localVersion = JSON.stringify(this.localVersion)
            this.debug('Found a new version in the bundle', this.localVersion)
            this._alreadyLookingForLocalVersion = false
            resolve(this.localVersion)
          } else { // use the version we already had (maybe hotpushed)
            this.debug('Version of the bundle hasn\'t changed')
            this.localVersion = JSON.parse(localStorage.hotpushes_localVersion)
            this.debug('Using localVersion', this.localVersion)
            this._alreadyLookingForLocalVersion = false
            resolve(this.localVersion)
          }
        } else {
          const error = new Error('no version.json in the bundle')
          this._alreadyLookingForLocalVersion = false
          this.debug(error)
          reject(error)
        }
      } catch (err) {
        this.debug(err)
        try { // fallback to localStorage
          this.localVersion = JSON.parse(localStorage.hotpushes_localVersion)
          this._alreadyLookingForLocalVersion = false
          resolve(this.localVersion)
        } catch (e) {
          this._alreadyLookingForLocalVersion = false
          reject(e)
        }
      }
    }.bind(this)

    request.onerror = function (err) {
      this._alreadyLookingForLocalVersion = false
      this.debug(err)
      reject(err)
    }.bind(this)

    request.send()
  }.bind(this))
}

/**
* Callback for async call to version files
*/
HotPush.prototype._verifyVersions = function (localVersion, remoteVersion) {
  this.lastCheck = Date.now()
  localStorage.hotpushes_lastCheck = this.lastCheck
  if (this.options.checkType === HOTPUSH_CHECK_TYPE.VERSION &&
      localVersion.version !== remoteVersion.version) {
    this.debug('Found a different version, ' + localVersion.version + ' !== ' + remoteVersion.version)
    return UPDATE.FOUND
  } else if (this.options.checkType === HOTPUSH_CHECK_TYPE.TIMESTAMP &&
      localVersion.timestamp !== remoteVersion.timestamp) {
    this.debug('Found a different version, ' + localVersion.timestamp + ' !== ' + remoteVersion.timestamp)
    return UPDATE.FOUND
  }
  this.debug('All good, last version running')
  return UPDATE.NOT_FOUND
}

HotPush.prototype._loadLocalFile = function (filename, callback) {
  try {
    this.debug('loading file ' + filename)
    const head = document.getElementsByTagName('head')[0]
    let domEl
    if (filename.split('.css').length > 1) {
      domEl = document.createElement('link')
      domEl.setAttribute('rel', 'stylesheet')
      domEl.setAttribute('type', 'text/css')
      domEl.setAttribute('href', this._getLocalPath(filename))
    } else if (filename.split('.js').length > 1) {
      domEl = document.createElement('script')
      domEl.setAttribute('type', 'text/javascript')
      domEl.setAttribute('src', this._getLocalPath(filename))
      domEl.onload = callback
      domEl.onerror = callback
    }
    head.appendChild(domEl)
  } catch (err) {
    this.debug(err)
    callback(err)
  }
}

/**
* Cancel the Hot Push
*
* After successfully canceling the hot push process, the `cancel` event
* will be emitted.
*/

HotPush.prototype.cancel = function () {
  return new Promise(function (resolve, reject) {
    this._syncs.forEach((sync) => sync.cancel())
    this.debug('cancel')
    resolve('canceled')
  }.bind(this))
}

/**
* Listen for an event.
*
* The following events are supported:
*
*   - noUpdateFound
*   - updateFound
*   - progress
*   - cancel
*   - error
*   - updateComplete
*
* @param {String} eventName to subscribe to.
* @param {Function} callback triggered on the event.
*/

HotPush.prototype.on = function (eventName, callback) {
  if (this._handlers.hasOwnProperty(eventName)) {
    this._handlers[eventName].push(callback)
  }
}

/**
* Emit an event.
*
* This is intended for internal use only.
*
* @param {String} eventName is the event to trigger.
* @param {*} all arguments are passed to the event listeners.
*
* @return {Boolean} is true when the event is triggered otherwise false.
*/

HotPush.prototype.emit = function (...args) {
  var eventName = args.shift()

  if (!this._handlers.hasOwnProperty(eventName)) {
    return false
  }

  this._handlers[eventName].forEach((handler) => handler(...args))

  return true
}

HotPush.PROGRESS_STATE = PROGRESS_STATE
HotPush.ERROR_STATE = ERROR_STATE

HotPush.HOTPUSH_TYPE = HOTPUSH_TYPE
HotPush.HOTPUSH_CHECK_TYPE = HOTPUSH_CHECK_TYPE
HotPush.UPDATE = UPDATE

module.exports = HotPush
