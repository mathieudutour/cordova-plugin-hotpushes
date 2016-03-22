'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var HOTPUSH_TYPE = exports.HOTPUSH_TYPE = {
  'MERGE': 'merge',
  'REPLACE': 'replace'
};

var HOTPUSH_CHECK_TYPE = exports.HOTPUSH_CHECK_TYPE = {
  'VERSION': 'version',
  'TIMESTAMP': 'timestamp'
};

var PROGRESS_STATE = exports.PROGRESS_STATE = {
  0: 'STOPPED',
  1: 'DOWNLOADING',
  2: 'EXTRACTING',
  3: 'COMPLETE'
};

var ERROR_STATE = exports.ERROR_STATE = {
  1: 'INVALID_URL_ERR',
  2: 'CONNECTION_ERR',
  3: 'UNZIP_ERR'
};

var UPDATE = exports.UPDATE = {
  NOT_FOUND: 'NOT_FOUND',
  FOUND: 'FOUND'
};
'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _constants = require('./constants');

/* global cordova, localStorage, XMLHttpRequest */

var ContentSync = cordova.require('phonegap-plugin-contentsync.ContentSync');

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

var HotPush = function contructor(options) {
  this._handlers = {
    'progress': []
  };

  // require options parameter
  if (typeof options === 'undefined') {
    throw new Error('The options argument is required.');
  }

  // require options.src parameter
  if (typeof options.src === 'undefined') {
    throw new Error('The options.src argument is required.');
  }

  // require options.versionJSONFileName parameter
  if (typeof options.versionFileName === 'undefined') {
    throw new Error('The options.versionFileName argument is required.');
  }

  // define synchronization strategy
  //
  //     HOTPUSH_TYPE.REPLACE: This is the normal behavior. completely removes existing
  //              content then copies new content from a zip file.
  //     HOTPUSH_TYPE.MERGE:   Download and replace only content which has changed
  //
  if (typeof options.type === 'undefined') {
    options.type = _constants.HOTPUSH_TYPE.REPLACE;
  }

  if (options.type === 'replace' && typeof options.archiveURL === 'undefined') {
    throw new Error('The options.archiveURL argument is required when type === replace.');
  }

  if (options.type === _constants.HOTPUSH_TYPE.MERGE) {
    throw new Error('not implemented yet, PR welcome https://github.com/mathieudutour/cordova-plugin-hotpushes');
  } else if (options.type !== _constants.HOTPUSH_TYPE.REPLACE) {
    throw new Error('unknown hotpush type');
  }

  if (typeof options.headers === 'undefined') {
    options.headers = null;
  }

  if (typeof options.documentsPath === 'undefined') {
    options.documentsPath = 'cdvfile://localhost/persistent/';
  }

  if (typeof options.copyCordovaAssets === 'undefined') {
    options.copyCordovaAssets = true;
  }

  // optional version type for update checks
  // default check method uses timestamp
  // 'version' option will use the version number in your package.json
  if (typeof options.checkType === 'undefined') {
    options.checkType = _constants.HOTPUSH_CHECK_TYPE.TIMESTAMP;
  }
  if (options.checkType !== _constants.HOTPUSH_CHECK_TYPE.TIMESTAMP && options.checkType !== _constants.HOTPUSH_CHECK_TYPE.VERSION) {
    throw new Error('unknown hotpush check type');
  }

  // store the options to this object instance
  this.options = options;

  this.localVersion = null;
  this.remoteVersion = null;

  this.lastUpdate = localStorage.hotpushes_lastUpdate;
  this.lastCheck = localStorage.hotpushes_lastCheck;

  this._syncs = [];
  this.logs = [];
};

/**
* Load all local files
*/
HotPush.prototype.debug = function () {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  if (this.options.debug) {
    var _console;

    this.logs.push({ args: args });
    (_console = console).log.apply(_console, ['[hotpushes] '].concat(args));
  }
};

/**
* Check if there is a new version available
*/
HotPush.prototype.check = function () {
  var _this = this;

  return new Promise(function (resolve, reject) {
    _this._getLocalVersion().then(function (localVersion) {
      try {
        (function () {
          var remoteRequest = new XMLHttpRequest();
          var url = _this.options.src + _this.options.versionFileName + '?v=' + _this.localVersion.version;
          _this.debug('fetch remote version at ' + url);
          // fetch remoteVersion
          remoteRequest.open('GET', url, true);

          remoteRequest.onload = function () {
            if (remoteRequest.status >= 200 && remoteRequest.status < 400) {
              // Success!
              var remoteVersion = JSON.parse(remoteRequest.responseText);
              _this.remoteVersion = JSON.parse(remoteRequest.responseText);
              _this.debug('found remote version', _this.remoteVersion);
              resolve(_this._verifyVersions(localVersion, remoteVersion));
            } else {
              _this.debug('nothing on the remote');
              resolve(_constants.UPDATE.NOT_FOUND);
            }
          };

          remoteRequest.onerror = function (err) {
            _this.debug(err);
            reject(err);
          };

          remoteRequest.send();
        })();
      } catch (err) {
        _this.debug(err);
        reject(err);
      }
    }).catch(reject);
  });
};

/**
* Load waiting local files
*/
HotPush.prototype.loadWaitingLocalFiles = function () {
  var _this2 = this;

  return new Promise(function (resolve, reject) {
    _this2._getLocalVersion().then(function (localVersion) {
      _this2.debug('load waiting local files');
      _this2._currentPosition = -1;
      return [localVersion, -1, false];
    }).then(_this2._loadLocalFilesFromPosition).then(resolve).catch(reject);
  });
};

/**
* Load all local files
*/
HotPush.prototype.loadLocalFiles = function () {
  var _this3 = this;

  return new Promise(function (resolve, reject) {
    _this3._getLocalVersion().then(function (localVersion) {
      _this3.debug('load all local files');
      _this3._currentPosition = 0;
      return [localVersion, 0];
    }).then(_this3._loadLocalFilesFromPosition).then(resolve).catch(reject);
  });
};

/**
* Load local files at position
*/
HotPush.prototype._loadLocalFilesFromPosition = function (_ref) {
  var _this4 = this;

  var _ref2 = _slicedToArray(_ref, 3);

  var files = _ref2[0].files;
  var position = _ref2[1];
  var _ref2$ = _ref2[2];
  var continueToNextPosition = _ref2$ === undefined ? true : _ref2$;

  return new Promise(function (resolve, reject) {
    var nbScript = files.filter(function (file) {
      return file.position === position && file.name.split('.js').length > 1;
    }).length;

    _this4.debug('load local files at position ' + position + ' (' + nbScript + ' left) ...');

    function callback() {
      nbScript--;
      this.debug('finish loading a file at position ' + position + ' (' + (nbScript === -1 ? 'none' : nbScript) + ' left)');
      if (!nbScript) {
        if (continueToNextPosition) {
          this._loadLocalFilesFromPosition([{ files: files }, ++position, continueToNextPosition]).then(resolve).catch(reject);
        } else {
          resolve('done');
        }
      }
    }

    if (!files.filter(function (file) {
      return file.position === position;
    }).length) {
      return resolve('nothing to do');
    }

    files.forEach(function (file) {
      if (file.position === _this4._currentPosition) {
        _this4._loadLocalFile(file.name, callback);
      }
    });
  });
};

/**
* Start the update
*/
HotPush.prototype.update = function () {
  var _this5 = this;

  return new Promise(function (resolve, reject) {
    if (_this5.options.type === _constants.HOTPUSH_TYPE.REPLACE) {
      _this5._syncs = [ContentSync.sync({
        src: _this5.options.archiveURL + '?v=' + _this5.localVersion.version,
        id: 'assets',
        copyCordovaAssets: _this5.options.copyCordovaAssets,
        headers: _this5.options.headers
      })];

      _this5.debug('Start the update...');

      _this5._syncs[0].on('progress', function (data) {
        _this5.debug('progress: ' + _constants.PROGRESS_STATE[data.status] + ' - ' + data.progress);
        _this5.emit('progress', data);
      });

      _this5._syncs[0].on('complete', function (data) {
        _this5.remoteVersion.location = 'documents';
        _this5.remoteVersion.path = data.localPath;
        localStorage.hotpushes_localVersion = JSON.stringify(_this5.remoteVersion);
        _this5.localVersion = _this5.remoteVersion;
        _this5.lastUpdate = Date.now();
        localStorage.hotpushes_lastUpdate = _this5.lastUpdate;
        _this5.debug('update complete', data);
        _this5.debug('new localVersion', _this5.localVersion);
        resolve(data.localPath);
      });

      _this5._syncs[0].on('error', function (err) {
        var error = new Error(_constants.ERROR_STATE[err]);
        _this5.debug(error);
        reject(error);
      });
    } else if (_this5.options.type === _constants.HOTPUSH_TYPE.MERGE) {
      var error = new Error('unknown hotpush type');
      _this5.debug(error);
      reject(error);
    }
  });
};

/**
* Get the path to a local file
*/
HotPush.prototype._getLocalPath = function (filename) {
  if (this.localVersion.location === 'bundle') {
    return filename;
  }
  return this.options.documentsPath + filename;
};

/**
* Fetch the local version of the version file
*/
HotPush.prototype._getLocalVersion = function () {
  var _this6 = this;

  return new Promise(function (resolve, reject) {
    function checkIfAlreadyThere() {
      if (this.localVersion) {
        resolve(this.localVersion);
        return true;
      }

      if (this._alreadyLookingForLocalVersion) {
        // come back in 15ms
        setTimeout(checkIfAlreadyThere, 15);
        return true;
      }
    }
    if (checkIfAlreadyThere()) {
      return;
    }

    _this6._alreadyLookingForLocalVersion = true;

    var previousVersionOfBundle = localStorage.hotpushes_bundleVersion;

    _this6.debug('Previous version of bundle - ' + previousVersionOfBundle);
    _this6.debug('fetch localVersion from bundle...');

    // fetch bundleVersion
    var request = new XMLHttpRequest();
    request.open('GET', _this6.options.versionFileName, true);

    request.onload = function () {
      try {
        if (request.status === 0 || request.status >= 200 && request.status < 400) {
          // Success!
          var currentVersionOfBundle = request.responseText;

          if (currentVersionOfBundle !== previousVersionOfBundle) {
            // if we have a new version in the bundle, use it
            localStorage.hotpushes_bundleVersion = currentVersionOfBundle;
            _this6.localVersion = JSON.parse(currentVersionOfBundle);
            _this6.localVersion.location = 'bundle';
            localStorage.hotpushes_localVersion = JSON.stringify(_this6.localVersion);
            _this6.debug('Found a new version in the bundle', _this6.localVersion);
            resolve(_this6.localVersion);
          } else {
            // use the version we already had (maybe hotpushed)
            _this6.debug('Version of the bundle hasn\'t changed');
            _this6.localVersion = JSON.parse(localStorage.hotpushes_localVersion);
            _this6.debug('Using localVersion', _this6.localVersion);
            resolve(_this6.localVersion);
          }
        } else {
          var error = new Error('no version.json in the bundle');
          _this6.debug(error);
          reject(error);
        }
      } catch (err) {
        _this6.debug(err);
        try {
          // fallback to localStorage
          _this6.localVersion = JSON.parse(localStorage.hotpushes_localVersion);
          resolve(_this6.localVersion);
        } catch (e) {
          reject(e);
        }
      }
    };
  });
};

/**
* Callback for async call to version files
*/
HotPush.prototype._verifyVersions = function (localVersion, remoteVersion) {
  this.lastCheck = Date.now();
  localStorage.hotpushes_lastCheck = this.lastCheck;
  if (this.options.checkType === _constants.HOTPUSH_CHECK_TYPE.VERSION && localVersion.version !== remoteVersion.version) {
    this.debug('Found a different version, ' + localVersion.version + ' !== ' + remoteVersion.version);
    return _constants.UPDATE.FOUND;
  } else if (this.options.checkType === _constants.HOTPUSH_CHECK_TYPE.TIMESTAMP && localVersion.timestamp !== remoteVersion.timestamp) {
    this.debug('Found a different version, ' + localVersion.timestamp + ' !== ' + remoteVersion.timestamp);
    return _constants.UPDATE.FOUND;
  }
  this.debug('All good, last version running');
  return _constants.UPDATE.NOT_FOUND;
};

HotPush.prototype._loadLocalFile = function (filename, callback) {
  try {
    this.debug('loading file ' + filename);
    var head = document.getElementsByTagName('head')[0];
    var domEl = void 0;
    if (filename.split('.css').length > 1) {
      domEl = document.createElement('link');
      domEl.setAttribute('rel', 'stylesheet');
      domEl.setAttribute('type', 'text/css');
      domEl.setAttribute('href', this._getLocalPath(filename));
    } else if (filename.split('.js').length > 1) {
      domEl = document.createElement('script');
      domEl.setAttribute('type', 'text/javascript');
      domEl.setAttribute('src', this._getLocalPath(filename));
      domEl.onload = callback;
      domEl.onerror = callback;
    }
    head.appendChild(domEl);
  } catch (err) {
    this.debug(err);
    callback(err);
  }
};

/**
* Cancel the Hot Push
*
* After successfully canceling the hot push process, the `cancel` event
* will be emitted.
*/

HotPush.prototype.cancel = function () {
  var _this7 = this;

  return new Promise(function (resolve, reject) {
    _this7._syncs.forEach(function (sync) {
      return sync.cancel();
    });
    _this7.debug('cancel');
    resolve('canceled');
  });
};

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
    this._handlers[eventName].push(callback);
  }
};

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

HotPush.prototype.emit = function () {
  for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  var eventName = args.shift();

  if (!this._handlers.hasOwnProperty(eventName)) {
    return false;
  }

  this._handlers[eventName].forEach(function (handler) {
    return handler.apply(undefined, args);
  });

  return true;
};

HotPush.prototype.PROGRESS_STATE = _constants.PROGRESS_STATE;
HotPush.prototype.ERROR_STATE = _constants.ERROR_STATE;

HotPush.prototype.HOTPUSH_TYPE = _constants.HOTPUSH_TYPE;
HotPush.prototype.HOTPUSH_CHECK_TYPE = _constants.HOTPUSH_CHECK_TYPE;

module.exports = HotPush;
