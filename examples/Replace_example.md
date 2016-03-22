# `replace` Example

```javascript
var hotpushes = new HotPush({
  src: 'http://myserver/hot/',
  versionFileName: 'version.json',
  type: HOTPUSH_TYPE.REPLACE,
  archiveURL: 'http://myserver/hot/assets.zip'
});

hotpushes.loadWaitingLocalFiles()
  .then(hotpushes.check)
  .then((result) => {
    if (result === HotPush.UPDATE.FOUND) {
      hotpushes.udpate().then(() => location.reload())
        .catch(hotpushes.loadLocalFiles)
    } else {
      hotpushes.loadLocalFiles()
    }
  })
  .catch(hotpushes.loadLocalFiles)

```

On `http://myserver/hot/`, there should be 2 files :

- version.json
- assets.zip

In the `bundle` of the app, there should be 1 file + the files listed in `version.json` :

- version.json

### Example
```
http://myserver/hot/
	version.json
	assets.zip
```

## version.json
This file contains a timestamp of its creation and a array describing files to load.

### Schema
```
{
	timestamp: {
		type: String,
		required: true
	}
	files: [
		{
			name: {
				type: String,
				required: true
			},
			position: {
				type: Number
			},
			hash: {
				type: String
			}
		}
	]
}
```

### Example
```
{
	timestamp: "1234567890123",
	files: [
		{
			name: "styles/app.css",
			position: 0
		},
		{
			name: "styles/libs.css",
			position: 0
		},
		{
			name: "libs.js",
			position: 0
		},
		{
			name: "app.js",
			position: 1
		}
	]
}
```

## assets.zip
This file contains the files listed in `version.json`.

### Example
```
/
	libs.js
	app.js

	styles/
		app.css
		libs.css
```
