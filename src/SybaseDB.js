const spawn = require('child_process').spawn;
const JSONStream = require('JSONStream');
const path = require("path");

function Sybase(host, port, dbname, username, password, logTiming, pathToJavaBridge, logQuery) {
    this.connected = false;
    this.host = host;
    this.port = port;
    this.dbname = dbname;
    this.username = username;
    this.password = password;
    this.logTiming = (logTiming == true);
    this.logQuery = logQuery;
    this.pathToJavaBridge = pathToJavaBridge;
    if (this.pathToJavaBridge === undefined) {
        this.pathToJavaBridge = path.resolve(__dirname, "..", "JavaSybaseLink", "dist", "JavaSybaseLink.jar");
    }

    this.queryCount = 0;
    this.currentMessages = {}; // look up msgId to message sent and call back details.

    this.jsonParser = JSONStream.parse();
}

Sybase.prototype.connect = function (callback) {
    const that = this;
    this.javaDB = spawn('java', ["-jar", this.pathToJavaBridge, this.host, this.port, this.dbname, this.username, this.password]);

    this.javaDB.stdout.once("data", function (data) {
        if ((data + "").trim() != "connected") {
            callback(new Error("Error connecting " + data));
            return;
        }

        that.javaDB.stderr.removeAllListeners("data");
        that.connected = true;

        // set up normal listeners.		
        that.javaDB.stdout.setEncoding('utf8').pipe(that.jsonParser).on("data", function (jsonMsg) { that.onSQLResponse.call(that, jsonMsg); });
        that.javaDB.stderr.on("data", function (err) { that.onSQLError.call(that, err); });

        callback(null, data);
    });

    // handle connection issues.
    this.javaDB.stderr.once("data", function (data) {
        that.javaDB.stdout.removeAllListeners("data");
        that.javaDB.kill();
        callback(new Error(data));
    });
};

Sybase.prototype.disconnect = function () {
    this.javaDB.kill();
    this.connected = false;
}

Sybase.prototype.isConnected = function () {
    return this.connected;
};

Sybase.prototype.query = function (sql, callback, timeout) {
    if (this.isConnected === false) {
        callback(new Error("database isn't connected."));
        return;
    }
    const hrstart = process.hrtime();
    this.queryCount++;

    const msg = {};
    msg.msgId = this.queryCount;
    msg.sql = sql;
    msg.sentTime = (new Date()).getTime();
    msg.timeout = timeout ? timeout : 0
    const strMsg = JSON.stringify(msg).replace(/[\n]/g, '\\n');
    msg.callback = callback;
    msg.hrstart = hrstart;

    this.currentMessages[msg.msgId] = msg;

    this.javaDB.stdin.write(strMsg + "\n");
    if (this.logQuery) {
        console.log("this: " + this + " currentMessages: " + this.currentMessages + " this.queryCount: " + this.queryCount);
        console.log("sql request written: " + strMsg);
    }

};


Sybase.prototype.onSQLResponse = function (jsonMsg) {
    let err = null;
    const request = this.currentMessages[jsonMsg.msgId];
    delete this.currentMessages[jsonMsg.msgId];

    let result = jsonMsg.result;
    if (result && result.length === 1)
        result = result[0]; //if there is only one just return the first RS not a set of RS's

    const currentTime = (new Date()).getTime();
    const sendTimeMS = currentTime - jsonMsg.javaEndTime;
    const hrend = process.hrtime(request.hrstart);
    const javaDuration = (jsonMsg.javaEndTime - jsonMsg.javaStartTime);

    if (jsonMsg.error !== undefined)
        err = new Error(jsonMsg.error);


    if (this.logTiming)
        console.log("Execution time (hr): %ds %dms dbTime: %dms dbSendTime: %d sql=%s", hrend[0], hrend[1] / 1000000, javaDuration, sendTimeMS, request.sql);
    request.callback(err, result);
};

Sybase.prototype.onSQLError = function (data) {
    const error = new Error(data);

    const callBackFuncitons = [];
    for (const k in this.currentMessages) {
        if (this.currentMessages.hasOwnProperty(k)) {
            callBackFuncitons.push(this.currentMessages[k].callback);
        }
    }

    // clear the current messages before calling back with the error.
    this.currentMessages = [];
    callBackFuncitons.forEach(function (cb) {
        cb(error);
    });
};

module.exports = Sybase;
