## node-sybase

A simple node.js wrapper around a golang application that provides easy access to Sybase databases. The main goal is to allow easy installation without the requirements of installing and configuring odbc or freetds and no need to install other applications.

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
## Development

### Requeriments

    - go 1.11+ for the repl
    - nodejs 10+

### Build

This project has two parts to be build the node part and the golang repl part

To build the node part just run 
```npm run build```
and the compiled code will be inside folder dist

To build the golang part inside the folder run 
``` go build -o dist/{filename} ```
where {filename} need be the filename to desired OS 

- gorepl-linux to linux
- gorepl-darwin to macos
- gorepl-win.exe to windows

eg: to build to windows the command will be ``` go build -o dist/gorepl-win.exe ```

### Tests

Create the env variables to configure test db:

DB_TEST_HOST
DB_TEST_PORT
DB_TEST_USER
DB_TEST_PASSWORD
DB_TEST_NAME

and run

``` npm run test ```