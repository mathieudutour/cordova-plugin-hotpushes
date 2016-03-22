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
    this.logs.push({args})
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
    .then(this._loadLocalFilesFromPosition)
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
    }.bind(this)).then(this._loadLocalFilesFromPosition)
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
