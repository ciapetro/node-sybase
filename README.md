## node-sybase

A simple node.js wrapper around a Java application that provides easy access to Sybase databases via jconn4. The main goal is to allow easy installation without the requirements of installing and configuring odbc or freetds. You do however have to have java 13 or newer installed.

## requirements

-   java 13+

## install

### git

```bash
git clone git://github.com/ciapetro/node-sybase.git
cd node-sybase
node-gyp configure build
```

### npm

```bash
npm install ciapetro-sybase
```

## Examples

### Connect

```javascript
const Sybase = require('ciapetro-sybase'),
    db = new Sybase('host', port, 'dbName', 'username', 'pw');

try {
    await db.connect();
} catch (error) {
    console.error(error);
}
```

### Disconnect

```javascript
const Sybase = require('ciapetro-sybase'),
    db = new Sybase('host', port, 'dbName', 'username', 'pw', 'pathToJavaBridge (optional)', logQuerys);

try {
    await db.connect();
    db.disconnect();
} catch (error) {
    console.error(error);
}
```

### Query Async

```javascript
const Sybase = require('ciapetro-sybase'),
    db = new Sybase('host', port, 'dbName', 'username', 'pw');

try {
    await db.connect();
    const users = await db.queryAsync('select * from user where user_id = 42');
    // You can pass a timeout in miliseconds to query be executed if timeout is expired will throw a error
    const users2 = await db.queryAsync('select * from user where user_id = 42', 1000);
} catch (error) {
    console.error(error);
}
```

### Query Callback

```javascript
const Sybase = require('sybase'),
    db = new Sybase('host', port, 'dbName', 'username', 'pw');

try {
    await db.connect();
    db.query('select * from user where user_id = 42', function (err, data) {
        if (err) console.log(err);

        console.log(data);

        db.disconnect();
    });
    // You can pass timeout too
    db.query(
        'select * from user where user_id = 42',
        function (err, data) {
            if (err) console.log(err);

            console.log(data);

            db.disconnect();
        },
        1000,
    );
} catch (error) {
    console.error(error);
}
```

### Check Connected

```javascript
const Sybase = require('sybase'),
    db = new Sybase('host', port, 'dbName', 'username', 'pw');

try {
    console.log(db.isConnected); // false
    await db.connect();
    console.log(db.isConnected); // true
} catch (error) {
    console.error(error);
}
```

## api

The api is super simple. It makes use of standard node callbacks or promises. The only thing not covered in the example above is the option to print some timing stats to the console as well as to specify the location of the Java application bridge, which shouldn't need to change.

```javascirpt
const logTiming = true,
	javaJarPath = './JavaSybaseLink/dist/JavaSybaseLink.jar',
	db = new Sybase('host', port, 'dbName', 'username', 'pw', logTiming, javaJarPath);
```

The java Bridge now optionally looks for a "sybaseConfig.properties" file in which you can configure jconnect properties to be included in the connection. This should allow setting properties like:

```properties
ENCRYPT_PASSWORD=true
```
