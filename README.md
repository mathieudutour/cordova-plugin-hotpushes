#cordova-plugin-hotpushes

> Download and cache remotely hosted content.

_This plugin is a work in progress and it is not production ready._

## Installation

```
cordova plugin add https://github.com/mathieudutour/cordova-plugin-hotpushes
```

## Supported Platforms

- Android
- iOS
- WP8


## Quick Example

```javascript
var hotpushes = HotPush.sync({
  src: 'http://myserver/hot/',
  versionJSONPFileName: 'version.jsonp',
  versionJSONFileName: 'version.json',
  type: 'replace',
  archiveURL: 'http://myserver/hot/assets.zip'
});

hotpushes.loadFromLocal(); // first call to load from local (either bundle or Documents, depending if there is something in Documents

hotpushes.check(); // check for update

```

## API

### HotPush.sync(options)

Parameter | Description
--------- | ------------
`options.src` | `String` URL to hot push endpoint
`options.versionJSONPFileName` | `String` Name of the jsonp file containing the version information.
`options.versionJSONFileName` | `String` Name of the json file containing the version information
`options.type` | `String` _(Optional)_ Defines the hot push strategy applied to the content.<br/>The type `replace` is the default behaviour that completely removes existing content then copies new content from a zip file.<br/> The type `merge` will download and replace only content which has changed.
`options.headers` | `Object` _(Optional)_ Set of headers to use when requesting the remote content from `options.src`.
`options.archiveURL` | `String` _(Mandatory if `options.type === 'replace'`)_ URL of the zip containing the files to hot push
`options.bundlePath` | `Object` _(Optional)_ Set of headers to use when requesting the remote content from `options.src`.
`options.documentsPath` | `Object` _(Optional)_ Path to the Documents folder (useful for [WKWebView](https://github.com/etiennea/WKWebView))

#### Returns

- Instance of `HotPush`.

#### Example

```javascript
var hotpushes = HotPush.sync({
  src: 'http://myserver/hot/',
  versionJSONPFileName: 'version.jsonp',
  versionJSONFileName: 'version.json',
  type: 'replace',
  archiveURL: 'http://myserver/hot/assets.zip'
});
```

### hotpushes.on(event, callback)

Parameter | Description
--------- | ------------
`event` | `String` Name of the event to listen to. See below for all the event names.
`callback` | `Function` is called when the event is triggered.

#### hotpushes.on('progress', callback)

The event `progress` will be triggered on each update as the native platform downloads and caches the content.

Callback Parameter | Description
------------------ | -----------
`data.progress` | `Integer` Progress percentage between `0 - 100`. The progress includes all actions required to cache the remote content locally. This is different on each platform, but often includes requesting, downloading, and extracting the cached content along with any system cleanup tasks.
`data.status` | `Integer` Enumeration of `PROGRESS_STATE` to describe the current progress state.

##### Example

```javascript
hotpushes.on('progress', function(data) {
    // data.progress
    // data.status
});
```

#### hotpushes.on('complete', callback)

The event `complete` will be triggered when the content has been successfully cached onto the device.

Callback Parameter | Description
------------------ | -----------
`data.localPath` | `String` The file path to the cached content. The file path will be different on each platform and may be relative or absolute. However, it is guaraneteed to be a compatible reference in the browser.
`data.cached` | `Boolean` Set to `true` if options.type is set to `local` and cached content exists. Set to `false` otherwise.

##### Example

```javascript
hotpushes.on('complete', function(data) {
    // data.localPath
    // data.cached
});
```

#### hotpushes.on('error', callback)

The event `error` will trigger when an internal error occurs and the cache is aborted.

Callback Parameter | Description
------------------ | -----------
`e` | `Error` Standard JavaScript error object that describes the error.

##### Example

```javascript
hotpushes.on('error', function(e) {
    // e.message
});
```

#### hotpushes.on('cancel', callback)

The event `cancel` will trigger when `sync.cancel` is called.

Callback Parameter | Description
------------------ | -----------
`no parameters` |

##### Example

```javascript
hotpushes.on('cancel', function() {
    // user cancelled the sync operation
});
```

### hotpushes.cancel()

Cancels the content sync operation and triggers the cancel callback.

#### Example
```javascript
var hotpushes = HotPush.sync({ src: 'http://myserver/app/1', id: 'app-1' });

hotpushes.on('cancel', function() {
    console.log('content sync was cancelled');
});

hotpushes.cancel();
```

### HotPush.PROGRESS_STATE

An enumeration that describes the current progress state. The mapped `String`
values can be customized for the user's app.

Integer | Description
------- | -----------
`0`     | `STOPPED`
`1`     | `DOWNLOADING`
`2`     | `EXTRACTING`
`3`     | `COMPLETE`
