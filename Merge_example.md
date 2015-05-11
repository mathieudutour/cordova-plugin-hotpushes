# `replace` Example

```javascript
var hotpushes = HotPush.sync({
  src: 'http://myserver/hot/',
  versionJSONPFileName: 'version.jsonp',
  versionJSONFileName: 'version.json',
  type: 'merge'
});


hotpushes.check(); // check for update

hotpushes.on('updateFound', function() {
  hotpushes.udpate();
});

hotpushes.on('updateComplete', function() {
  location.reload();
});

```

On `http://myserver/hot/`, there should be 2 files + the files listed in `version.json` :

- version.json
- version.jsonp

### Example
```
http://myserver/hot/
    version.json
	version.jsonp
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
			position: 0,
            hash: "abcfde12412564271263"
		},
		{
			name: "styles/libs.css",
			position: 0,
            hash: "abcfde12412564271263"
		},
		{
			name: "libs.js",
			position: 0,
            hash: "abcfde12412564271263"
		},
		{
			name: "app.js",
			position: 1,
            hash: "abcfde12412564271263"
		}
	]
}
```

## version.jsonp
This file contains the same content as `version.json` wrapped inside the `hotPushJSONP` callback.

### Example
```
hotPushJSONP({...});
```
