/* global cordova:false */

/*!
 * Module dependencies.
 */

var ContentSync = cordova.require('phonegap-plugin-contentsync.ContentSync');

var HOTPUSH_TYPE = {
  'MERGE': 'merge',
  'REPLACE': 'replace',
};
var HOTPUSH_CHECK_TYPE = {
  'VERSION': 'version',
  'TIMESTAMP': 'timestamp',
};

var PROGRESS_STATE = {
  0: 'STOPPED',
  1: 'DOWNLOADING',
  2: 'EXTRACTING',
  3: 'COMPLETE',
};

var ERROR_STATE = {
  1: 'INVALID_URL_ERR',
  2: 'CONNECTION_ERR',
  3: 'UNZIP_ERR',
};

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
    'noUpdateFound': [],
    'updateFound': [],
    'progress': [],
    'cancel': [],
    'error': [],
    'updateComplete': [],
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
    options.type = HOTPUSH_TYPE.REPLACE;
  }

  if (options.type === 'replace' && typeof options.archiveURL === 'undefined') {
    throw new Error('The options.archiveURL argument is required when type === replace.');
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
    options.checkType = HOTPUSH_CHECK_TYPE.TIMESTAMP;
  }

  // store the options to this object instance
  this.options = options;

  this.localVersion = null;
  this.remoteVersion = null;
  this._syncs = [];
  this.logs = [];
};

/**
* Load all local files
*/
HotPush.prototype.debug = function debug(info, type) {
  var _type = type || 'log';
  if (this.options.debug) {
    this.logs.push({type: _type, info: info});
    console[_type]('[hotpushes] ', info);
  }
};

/**
* Check if there is a new version available
*/
HotPush.prototype.check = function check() {
  if (!this.localVersion) {
    this.debug('fetch localVersion');
    this._loadLocalVersion(this.check.bind(this));
    return;
  }
  // fetch localVersion
  try {
    var remoteRequest = new XMLHttpRequest();
    this.debug('fetch remoteVersion');
    // fetch remoteVersion
    remoteRequest.open('GET', this.options.src + this.options.versionFileName + '?v=' + this.localVersion.version, true);

    remoteRequest.onload = function onRemoteVersionLoad() {
      if (remoteRequest.status >= 200 && remoteRequest.status < 400) {
        // Success!
        this.remoteVersion = JSON.parse(remoteRequest.responseText);
        this.debug('found remote version - ' + JSON.stringify(this.remoteVersion));
        this._verifyVersions();
      } else {
        this.debug('nothing on the remote', 'warn');
        this.emit('noUpdateFound');
      }
    }.bind(this);

    remoteRequest.onerror = function onRemoteVersionError(err) {
      this.debug(err, 'error');
      this.emit('error', err);
    }.bind(this);

    remoteRequest.send();
  } catch (err) {
    this.debug(err, 'error');
    this.emit('error', err);
  }
};

HotPush.prototype._loadLocalFilesAtPosition = function _loadLocalFilesAtPosition(files, position) {
  files.forEach(function loadFile(file) {
    if (file.position === position) {
      this._loadLocalFile(file.name);
    }
  });
};

/**
* Load waiting local files
*/
HotPush.prototype.loadWaitingLocalFiles = function loadWaitingLocalFiles() {
  if (!this.localVersion) {
    this.debug('fetch localVersion');
    this._loadLocalVersion(this.loadWaitingLocalFiles.bind(this));
    return;
  }
  this.debug('load waiting local files');
  this._currentPosition = -1;
  this._loadLocalFilesAtCurrentPosition(Infinity);
};

/**
* Load all local files
*/
HotPush.prototype.loadAllLocalFiles = function loadAllLocalFiles() {
  if (!this.localVersion) {
    this.debug('fetch localVersion');
    this._loadLocalVersion(this.loadAllLocalFiles.bind(this));
    return;
  }
  this.debug('load all local files');
  this._currentPosition = 0;
  this._loadLocalFilesAtCurrentPosition();
};

/**
* Load local files at position
*/
HotPush.prototype._loadLocalFilesAtCurrentPosition = function(scriptToLoad) {
  try {
    var files = this.localVersion.files;
    this._nbScriptToLoadForTheCurrentPosition = scriptToLoad || files.reduce(function(a, file) {
      return a + file.position === this._currentPosition &&
        file.name.split('.js').length > 1 ? 1 : 0;
    }.bind(this), 0);
    this.debug('load local files at position ' +
                  this._currentPosition + '(' + this._nbScriptToLoadForTheCurrentPosition + ') ...');
    for (var i = 0; i < files.length; i++) {
      if (files[i].position === this._currentPosition) {
        this._loadLocalFile(files[i].name);
      }
    }
  } catch (err) {
    this.debug(err, 'error');
    this.emit('error', err);
  }
};

/**
* Called when a file has finished loading
*/
HotPush.prototype._hasloadedLocalFile = function() {
  this._nbScriptToLoadForTheCurrentPosition--;
  this.debug('finish loading a file at position ' +
                this._currentPosition + '( ' +
                (this._nbScriptToLoadForTheCurrentPosition === -1 ? 'none' :
                this._nbScriptToLoadForTheCurrentPosition) + ' left)');
  if (!this._nbScriptToLoadForTheCurrentPosition) {
    this._currentPosition++;
    this._loadLocalFilesAtCurrentPosition();
  }
};

/**
* Start the update
*/
HotPush.prototype.update = function() {
  if (this.options.type === HOTPUSH_TYPE.REPLACE) {
    this._syncs = [ContentSync.sync({ src: this.options.archiveURL + '?v=' + this.localVersion.version, id: 'assets', copyCordovaAssets: this.options.copyCordovaAssets, headers: this.options.headers})];

    this.debug('Start the update...');

    this._syncs[0].on('progress', function(data) {
      this.debug('progress: ' + PROGRESS_STATE[data.status] + ' - ' + data.progress);
      this.emit('progress', data);
    }.bind(this));

    this._syncs[0].on('complete', function(data) {
      this.remoteVersion.location = 'documents';
      localStorage.setItem('hotpushes_localVersion', JSON.stringify(this.remoteVersion));
      localStorage.setItem('hotpushes_lastUpdate', new Date().toString());
      this.debug('update complete');
      this.debug('new localVersion - ' + JSON.stringify(this.remoteVersion));
      this.emit('updateComplete', data.localPath);
    }.bind(this));

    this._syncs[0].on('error', function(err) {
      this.debug(ERROR_STATE[err], 'error');
      this.emit('error', err);
    }.bind(this));
  } else if (this.options.type === HOTPUSH_TYPE.MERGE) {
    this.debug(new Error('not implemented yet'), 'error');
    this.emit('error', new Error('not implemented yet'));
  } else {
    this.debug(new Error('unknown hotpush type'), 'error');
    this.emit('error', new Error('unknown hotpush type'));
  }
};

/**
* Get the path to a local file
*/
HotPush.prototype._getLocalPath = function(filename) {
  if (this.localVersion.location === 'bundle') {
    return '/' + filename;
  }
  return this.options.documentsPath + filename;
};

/**
* Fetch the local version of the version file
*/
HotPush.prototype._loadLocalVersion = function(callback) {
  if (this.localVersion) {
    this.debug('already loaded localVersion - ' + JSON.stringify(this.localVersion));
    callback();
    return;
  }
  var previousVersionOfBundle = localStorage.getItem('hotpushes_bundleVersion');

  this.localVersion = JSON.parse(localStorage.getItem('hotpushes_localVersion'));
  this.debug('Previous version of bundle - ' + previousVersionOfBundle);
  this.debug('fetch localVersion from bundle...');

  // fetch bundleVersion
  var request = new XMLHttpRequest();
  request.open('GET', this.options.versionFileName, true);

  request.onload = function() {
    try {
      if (request.status === 0 || request.status >= 200 && request.status < 400) {
        // Success!
        var currentVersionOfBundle = request.responseText;

        if (currentVersionOfBundle !== previousVersionOfBundle) { // if we have a new version in the bundle, use it
          localStorage.setItem('hotpushes_bundleVersion', currentVersionOfBundle);
          this.localVersion = JSON.parse(currentVersionOfBundle);
          this.localVersion.location = 'bundle';
          localStorage.setItem('hotpushes_localVersion', JSON.stringify(this.localVersion));
          this.debug('Found the a new version in the bundle. Using - ' + JSON.stringify(this.localVersion));
          callback();
        } else { // use the version we already had (maybe hotpushed)
          this.debug('Version of the bundle hasn\'t changed');
          this.debug('Using localVersion - ' + JSON.stringify(this.localVersion));
          callback();
        }
      } else {
        this.debug('nothing on the bundle', 'error');
        this.emit('error', new Error('no version.json in the bundle'));
      }
    } catch (err) {
      this.debug(err, 'error');
      if (this.localVersion) {
        return callback();
      }
      this.emit('error', err);
    }
  }.bind(this);

  request.onerror = function(err) {
    this.debug(err, 'error');
    if (this.localVersion) {
      return callback();
    }
    this.emit('error', err);
  }.bind(this);

  request.send();
};

/**
* Callback for async call to version files
*/
HotPush.prototype._verifyVersions = function() {
  if (this.options.checkType === HOTPUSH_CHECK_TYPE.VERSION &&
      this.localVersion.version !== this.remoteVersion.version) {
    this.debug('Found a different version, ' + this.localVersion.version + ' !== ' + this.remoteVersion.version);
    this.emit('updateFound');
  } else if (this.options.checkType === HOTPUSH_CHECK_TYPE.TIMESTAMP &&
      this.localVersion.timestamp !== this.remoteVersion.timestamp) {
    this.debug('Found a different version, ' + this.localVersion.timestamp + ' !== ' + this.remoteVersion.timestamp);
    this.emit('updateFound');
  } else if (this.options.checkType !== HOTPUSH_CHECK_TYPE.TIMESTAMP &&
      this.options.checkType !== HOTPUSH_CHECK_TYPE.VERSION) {
    this.debug('unknown hotpush check type', 'error');
    this.emit('error', new Error('unknown hotpush check type'));
  } else {
    this.debug('All good, last version running');
    this.emit('noUpdateFound');
  }
};

HotPush.prototype._loadLocalFile = function(filename) {
  try {
    this.debug('loading file ' + filename);
    var head = document.getElementsByTagName('head')[0];
    var domEl;
    var time = new Date().getTime();
    if (filename.split('.css').length > 1) {
      domEl = document.createElement('link');
      domEl.setAttribute('rel', 'stylesheet');
      domEl.setAttribute('type', 'text/css');
      domEl.setAttribute('href', this._getLocalPath(filename) + '?' + time);
    } else if (filename.split('.js').length > 1) {
      domEl = document.createElement('script');
      domEl.setAttribute('type', 'text/javascript');
      domEl.setAttribute('src', this._getLocalPath(filename) + '?' + time);
      domEl.onload = function() {
        this._hasloadedLocalFile();
      }.bind(this);
      domEl.onerror = function() {
        this._hasloadedLocalFile();
      }.bind(this);
    }
    head.appendChild(domEl);
  } catch (err) {
    this.debug(err, 'error');
    this.emit('error', err);
  }
};

/**
* Cancel the Hot Push
*
* After successfully canceling the hot push process, the `cancel` event
* will be emitted.
*/

HotPush.prototype.cancel = function() {
  this._syncs.forEach(function(sync) {
    sync.cancel();
  });
  this.debug('cancel', 'warn');
  this.emit('cancel');
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

HotPush.prototype.on = function(eventName, callback) {
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

HotPush.prototype.emit = function() {
  var args = Array.prototype.slice.call(arguments);
  var eventName = args.shift();

  if (!this._handlers.hasOwnProperty(eventName)) {
    return false;
  }

  for (var i = 0, length = this._handlers[eventName].length; i < length; i++) {
    this._handlers[eventName][i].apply(undefined, args);
  }

  return true;
};

/*!
* Hot Pushes Plugin.
*/

module.exports = {
  /**
   * Synchronize the content.
   *
   * This method will instantiate a new copy of the HotPush object
   * and start synchronizing.
   *
   * @param {Object} options
   * @return {HotPush} instance
   */

  sync: function(options) {
    return new HotPush(options);
  },

  HotPush: HotPush,

  PROGRESS_STATE: PROGRESS_STATE,
  ERROR_STATE: ERROR_STATE,

  HOTPUSH_TYPE: HOTPUSH_TYPE,
  HOTPUSH_CHECK_TYPE: HOTPUSH_CHECK_TYPE,
};
