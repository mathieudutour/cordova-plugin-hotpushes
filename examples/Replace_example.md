# `replace` Example

```javascript
var hotpushes = HotPush.sync({
  src: 'http://myserver/hot/',
  versionJSONPFileName: 'version.jsonp',
  versionJSONFileName: 'version.json',
  type: 'replace',
  archiveURL: 'http://myserver/hot/assets.zip'
});


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
This file contains the files listed in `version.json` as well as the file `version.jsonp`.

### Example
```
/
	version.jsonp
	libs.js
	app.js
	
	styles/
		app.css
		libs.css
```

## version.jsonp
This file contains the same content as `version.json` wrapped inside the `hotPushJSONP` callback.

### Example
```
hotPushJSONP({...});
```
