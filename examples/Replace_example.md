# `replace` Example

```javascript
var hotpushes = HotPush.sync({
  src: 'http://myserver/hot/',
  versionFileName: 'version.json',
  type: 'replace',
  archiveURL: 'http://myserver/hot/assets.zip'
});

hotpushes.loadAllLocalFiles() // load local files

hotpushes.check(); // check for update

hotpushes.on('updateFound', function() {
  hotpushes.udpate();
});

hotpushes.on('updateComplete', function() {
  location.reload();
});

```

On `http://myserver/hot/`, there should be 2 files :

- version.json
- assets.zip

In the `bundle` of the app, there should be 1 file + the files listed in `version.json` :

- version.json

### Example
```
www/
    version.json
	libs.js
	app.js
	
	styles/
		app.css
		libs.css
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
