/* global cordova:false */

/*!
 * Module dependencies.
 */

var ContentSync = cordova.require('com.adobe.phonegap.contentsync.ContentSync');

/**
 * HotPush constructor.
 *
 * @param {Object} options to initiate a new content synchronization.
 *   @param {String} src is a URL to hot push endpoint
 *   @param {String} versionFileName is the name of the json file containing the version information
 *   @param {Object} type defines the hot push strategy applied to the content.
 *     @param {String} replace completely removes existing content then copies new content from a zip file.
 *     @param {String} merge   download and replace only content which has changed
 *   @param {String} archiveURL is the url of the zip containing the files to hot push (if type === replace)
 *   @param {Object} headers are used to set the headers for when we send a request to the src URL
 *   @param {String} documentsPath is the path to the Documents folder
 * @return {HotPush} instance that can be monitored and cancelled.
 */

var HotPush = function(options) {
  this._handlers = {
    'noUpdateFound': [],
    'updateFound': [],
    'progress': [],
    'cancel': [],
    'error': [],
    'updateComplete': []
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
  //     replace: This is the normal behavior. completely removes existing
  //              content then copies new content from a zip file.
  //     merge:   Download and replace only content which has changed
  //
  if (typeof options.type === 'undefined') {
    options.type = 'replace';
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

  // store the options to this object instance
  this.options = options;

  this.localVersion = null;
  this.remoteVersion = null;
  this._syncs = [];

};

/**
* Check if there is a new version available
*/
HotPush.prototype.check = function() {
  // fetch localVersion
  this._loadLocalVersion(function() {
    // fetch remoteVersion
    var remoteRequest = new XMLHttpRequest();
    remoteRequest.open('GET', this.options.src + this.options.versionFileName, true);

    remoteRequest.onload = function() {
      if (remoteRequest.status >= 200 && remoteRequest.status < 400) {
        // Success!
        this.remoteVersion = JSON.parse(remoteRequest.responseText);
        this._verifyVersions();
      } else {
        console.log('nothing on the remote');
        this.emit('noUpdateFound');
      }
    }.bind(this);

    remoteRequest.onerror = function(err) {
      console.log(err);
      this.emit('error', err);
    }.bind(this);

    remoteRequest.send();
  }.bind(this));
};

/**
* Load all local files
*/
HotPush.prototype.loadAllLocalFiles = function() {
  if (this.localVersion) {
    this._currentPosition = 0;
    this._loadLocalFilesAtCurrentPosition();
  } else {
    this._loadLocalVersion(this.loadAllLocalFiles.bind(this));
  }
};

/**
* Load local files of position
*/
HotPush.prototype._loadLocalFilesAtCurrentPosition = function() {
  var files = this.localVersion.files;
  this._nbScriptToLoadForTheCurrentPosition = files.reduce(function(a, file) {
    return a + file.position === this._currentPosition &&
      file.name.split('.js').length > 1 ? 1 : 0;
  }.bind(this), 0);
  for(var i = 0; i < files.length; i++) {
    if (files[i].position === this._currentPosition) {
      this._loadLocalFile(files[i].name);
    }
  }
};

/**
* Load local files of position
*/
HotPush.prototype._hasloadedLocalFile = function() {
  this._nbScriptToLoadForTheCurrentPosition--;
  if (!this._nbScriptToLoadForTheCurrentPosition) {
    this._currentPosition++;
    this._loadLocalFilesAtCurrentPosition();
  }
};

/**
* Fetch the local version of the version file
*/
HotPush.prototype.update = function() {
  var self = this;
  if (this.options.type === 'replace') {
    //this._syncs = [ContentSync.sync({ src: this.options.archiveURL, id: 'assets', headers: this.options.headers})];
    this._syncs = [ContentSync.download( this.options.archiveURL, this.options.headers, function(response) {
      console.log("ContentSync Download Callback");
      if(response.progress) {
        console.log(response);
      }
      if(response.archiveURL) {
        var archiveURL = response.archiveURL;
        Zip.unzip(archiveURL, "file://data/data/de.mobilexag.mip.cordovareact/android_asset/www", function(response) {
          console.log(response);
        })
      }
    })];

    this._syncs[0].on('progress', function(data) {
      self.emit('progress', data);
    });

    this._syncs[0].on('complete', function(data) {
      self.remoteVersion.location = 'documents';
      localStorage.setItem("hotpushes_localVersion", JSON.stringify(self.remoteVersion));
      console.log('downloaded file:');
      console.log(data.localPath);
      //ContentSync.unzip("/data/data/de.mobilexag.mip.cordovareact/files/files/assets", "/data/data/de.mobilexag.mip.cordovareact/android_asset/www")
      //this._extract(data.localPath);
      self.emit('updateComplete');
    });

    this._syncs[0].on('error', function(e) {
      self.emit('error', e);
    });

  } else if (this.options.type === 'merge') {
    this.emit('error', new Error('not implemented yet'));
  }
};

HotPush.prototype._extract = function(zipPath) {
  var self = this;
  ContentSync.unzip(zipPath)
  self.emit('updateComplete');
}

/**
* Get the path to a local file
*/

HotPush.prototype._getLocalPath = function(filename) {
  if (this.localVersion.location === 'bundle') {
    return '/' + filename;
  } else {
    return this.options.documentsPath + filename;
  }
};

/**
* Fetch the local version of the version file
*/

HotPush.prototype._loadLocalVersion = function(callback) {
  this.localVersion = this.localVersion || JSON.parse(localStorage.getItem("hotpushes_localVersion"));

  if (this.localVersion) {
    return callback();
  } else {
    var self = this;

    // fetch bundleVersion
    var request = new XMLHttpRequest();
    request.open('GET', this.options.versionFileName, true);

    request.onload = function() {
      if (request.status >= 200 && request.status < 400) {
        // Success!
        self.localVersion = JSON.parse(request.responseText);
        self.localVersion.location = 'bundle';
        localStorage.setItem("hotpushes_localVersion", JSON.stringify(self.localVersion));
        callback();
      } else {
        console.log('nothing on the bundle');
        self.emit('error', new Error('now version.json in the bundle'));
      }
    };

    request.onerror = function(err) {
      console.log(err);
      self.emit('error', err);
    };

    request.send();
  }
};

/**
* Callback for async call to version files
*/
HotPush.prototype._verifyVersions = function() {
  if (this.localVersion.timestamp !== this.remoteVersion.timestamp) {
    console.log('Not the last version, ' + this.localVersion.timestamp +' !== ' + this.remoteVersion.timestamp);
    this.emit('updateFound');
  } else {
    console.log('All good, last version running');
    this.emit('noUpdateFound');
  }
};

HotPush.prototype._loadLocalFile = function(filename) {
/*  var head = document.getElementsByTagName("head")[0];
  var domEl;
  var time = new Date().getTime();
  if (filename.split('.css').length > 1) {
    domEl = document.createElement("link");
    domEl.setAttribute("rel", "stylesheet");
    domEl.setAttribute("type", "text/css");
    domEl.setAttribute("href", this._getLocalPath(filename) + '?' + time);
  } else if (filename.split('.js').length > 1) {
    domEl = document.createElement('script');
    domEl.setAttribute("type", "text/javascript");
    domEl.setAttribute("src", this._getLocalPath(filename) + '?' + time);
    domEl.onload = function() {
      this._hasloadedLocalFile();
    }.bind(this);
    domEl.onerror = function() {
      this._hasloadedLocalFile();
    }.bind(this);
  }
  head.appendChild(domEl);*/
  console.log('file:');
  console.log(filename);
};

/**
* Cancel the Hot Push
*
* After successfully canceling the hot push process, the `cancel` event
* will be emitted.
*/

HotPush.prototype.cancel = function() {
  this.countForCallback = 100;
  this._syncs.forEach(function(sync) {
    sync.cancel();
  });
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
      this._handlers[eventName][i].apply(undefined,args);
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

  /**
   * PROGRESS_STATE enumeration.
   *
   * Maps to the `progress` event's `status` object.
   * The plugin user can customize the enumeration's mapped string
   * to a value that's appropriate for their app.
   */

  PROGRESS_STATE: {
      0: 'STOPPED',
      1: 'DOWNLOADING',
      2: 'EXTRACTING',
      3: 'COMPLETE'
  }
};
