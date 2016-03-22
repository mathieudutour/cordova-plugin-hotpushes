#cordova-plugin-hotpushes

> Download and cache remotely hosted content.

_This plugin is a work in progress and it is not production ready. PR welcome._

# Installation

```
cordova plugin add cordova-plugin-hotpushes
```

# Supported Platforms

- Android
- iOS
- WP8


# Examples
- [Replace example](./examples/Replace_example.md)
- [Merge example](./examples/Merge_example.md)

# API

## new HotPush(options)

Parameter | Description
--------- | ------------
`options.src` | `String` URL to hot push endpoint
`options.versionFileName` | `String` Name of the json file containing the version information
`options.type` | `String` _(Optional)_ Defines the hot push strategy applied to the content.<br/>The type `HotPush.HOTPUSH_TYPE.REPLACE` is the default behaviour that completely removes existing content then copies new content from a zip file.<br/> The type `HotPush.HOTPUSH_TYPE.MERGE` will download and replace only content which has changed.
`options.headers` | `Object` _(Optional)_ Set of headers to use when requesting the remote content from `options.src`.
`options.archiveURL` | `String` _(Mandatory if `options.type === Hotpush.HOTPUSH_TYPE.REPLACE`)_ URL of the zip containing the files to hot push.
`options.documentsPath` | `Object` _(Optional)_ Path to the Documents folder (useful for [WKWebView](https://github.com/Telerik-Verified-Plugins/WKWebView))
`options.checkType` | `String` _(Optional)_ Set to `Hotpush.HOTPUSH_CHECK_TYPE.VERSION` if you want to use the version number in your version.json instead of timestamp
`options.debug` | `Boolean` _(Optional)_ Print debug information in the console

### Returns

- Instance of `HotPush`.

### Example

```javascript
var hotpushes = new HotPush({
  src: 'http://myserver/hot/',
  versionFileName: 'version.json',
  type: HotPush.HOTPUSH_TYPE.REPLACE,
  archiveURL: 'http://myserver/hot/assets.zip'
});
```

## hotpushes.loadWaitingLocalFiles()

Load the local files at position `-1` (see version.json). Return a promise.

Parameter | Description
--------- | ------------
`no parameters` |

### Example

```javascript
hotpushes.loadWaitingLocalFiles()
  .then((result) => console.log('waiting'))
  .catch((err) => console.log(err));
```

## hotpushes.loadLocalFiles()

Load the local files at position >= 0. Return a promise.

Parameter | Description
--------- | ------------
`no parameters` |

### Example

```javascript
hotpushes.loadLocalFiles()
  .then((result) => console.log('all good'))
  .catch((err) => console.log(err));
```

## hotpushes.check()

Check if there is a new version available on the server. Return a promise which resolve with either `HotPush.UPDATE.FOUND` or `HotPush.UPDATE.NOT_FOUND`.

Parameter | Description
--------- | ------------
`no parameters` |

### Example

```javascript
hotpushes.check()
  .then((result) => {
    if (result === HotPush.UPDATE.FOUND) {
      // do something. Maybe hotpushes.update() or show a popup ?
    }
  })
  .catch((err) => console.log(err));
```

## hotpushes.update()

Download the files on the server. Return a promise.

Parameter | Description
--------- | ------------
`no parameters` |

### Example

```javascript
hotpushes.update()
  .then(() => {
    location.reload();
  })
  .catch((err) => console.log(err));
```

## hotpushes.on('progress', callback)

The event `progress` will be triggered on each update as the native platform downloads and caches the content.

Callback Parameter | Description
------------------ | -----------
`data.progress` | `Integer` Progress percentage between `0 - 100`. The progress includes all actions required to cache the remote content locally. This is different on each platform, but often includes requesting, downloading, and extracting the cached content along with any system cleanup tasks.
`data.status` | `Integer` Enumeration of `PROGRESS_STATE` to describe the current progress state.

### Example

```javascript
hotpushes.on('progress', function(data) {
    // data.progress
    // data.status
});
```

## hotpushes.cancel()

Cancels the content sync operation.

## hotpushes.lastCheck

Timestamp of the last check

## hotpushes.lastUpdate

Timestamp of the last update


## HotPush.PROGRESS_STATE

An enumeration that describes the current progress state.

Integer | Description
------- | -----------
`0`     | `STOPPED`
`1`     | `DOWNLOADING`
`2`     | `EXTRACTING`
`3`     | `COMPLETE`

## HotPush.HOTPUSH_TYPE

An enumeration that describes the type of hotpush to perform.

String    | Description
-------   | -----------
`merge`   | `MERGE`
`replace` | `REPLACE`

## HotPush.HOTPUSH_CHECK_TYPE

An enumeration that describes the field to look at in the `version.json` file.

String      | Description
-------     | -----------
`version`   | `VERSION`
`timestamp` | `TIMESTAMP`

## HotPush.UPDATE

String      | Description
-------     | -----------
`NOT_FOUND` | `NOT_FOUND`
`FOUND`     | `FOUND`
