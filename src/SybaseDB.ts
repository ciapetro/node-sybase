import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import JSONStream from 'JSONStream';
import path from 'path';

type Message = {
    msgId: number;
    sql: string;
    sentTime: number;
    timeout: number | null;
    callback?: Function;
    hrstart?: [number, number];
};

type ResponseMessage = {
    msgId: number;
    result: any[] | any;
    javaEndTime: number;
    javaStartTime: number;
    error: string;
};

export default class Sybase {
    private connected = false;
    private host: string;
    private port: number;
    private dbname: string;
    private username: string;
    private password: string;
    private logTiming: boolean;
    private logQuery: boolean;
    private pathToJavaBridge: undefined | string;
    private queryCount = 0;
    private currentMessages = {}; // look up msgId to message sent and call back details.
    private jsonParser;
    private javaDB!: ChildProcessWithoutNullStreams;

    constructor(
        host: string,
        port: number,
        dbname: string,
        username: string,
        password: string,
        logTiming: boolean,
        pathToJavaBridge?: string,
        logQuery?: boolean,
    ) {
        this.connected = false;
        this.host = host;
        this.port = port;
        this.dbname = dbname;
        this.username = username;
        this.password = password;
        this.logTiming = logTiming == true;
        this.logQuery = logQuery || false;
        this.pathToJavaBridge = pathToJavaBridge;
        if (this.pathToJavaBridge === undefined) {
            this.pathToJavaBridge = path.resolve(__dirname, '..', 'JavaSybaseLink', 'dist', 'JavaSybaseLink.jar');
        }

        this.queryCount = 0;
        this.currentMessages = {}; // look up msgId to message sent and call back details.

        this.jsonParser = JSONStream.parse();
    }

    async connect(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.javaDB = spawn('java', [
                '-jar',
                this.pathToJavaBridge || '',
                this.host,
                this.port ? this.port.toString() : '',
                this.dbname,
                this.username,
                this.password,
            ]);

            this.javaDB.stdout.once('data', (data) => {
                if ((data + '').trim() != 'connected') {
                    reject(new Error('Error connecting ' + data));
                    return;
                }

                this.javaDB.stderr.removeAllListeners('data');
                this.connected = true;

                // set up normal listeners.
                this.javaDB.stdout
                    .setEncoding('utf8')
                    .pipe(this.jsonParser)
                    .on('data', async (jsonMsg) => {
                        this.onSQLResponse(jsonMsg);
                    });

                this.javaDB.stderr.on('data', async (err) => {
                    this.onSQLError(err);
                });

                resolve(data);
            });

            // handle connection issues.
            this.javaDB.stderr.once('data', (data) => {
                this.javaDB.stdout.removeAllListeners('data');
                this.javaDB.kill();
                reject(new Error(data));
            });
        });
    }

    disconnect(): void {
        this.javaDB.kill();
        this.connected = false;
    }

    get isConnected(): boolean {
        return this.connected;
    }

    query(sql: string, callback: Function, timeout?: number): void {
        if (this.isConnected === false) {
            callback(new Error("database isn't connected."));
            return;
        }

        const hrstart = process.hrtime();
        this.queryCount++;

        const msg: Message = {
            msgId: this.queryCount,
            sql: sql,
            sentTime: new Date().getTime(),
            callback: undefined,
            hrstart: undefined,
            timeout: timeout && timeout > 0 ? timeout : null,
        };

        const strMsg = JSON.stringify(msg).replace(/[\n]/g, '\\n');
        msg.callback = callback;
        msg.hrstart = hrstart;

        this.currentMessages[msg.msgId] = msg;

        this.javaDB.stdin.write(strMsg + '\n');
        if (this.logQuery) {
            console.log(
                'this: ' + this + ' currentMessages: ' + this.currentMessages + ' this.queryCount: ' + this.queryCount,
            );
            console.log('sql request written: ' + strMsg);
        }
    }

    async queryAsync(sql: string, timeout?: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.query(
                sql,
                (err: Error, results: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                },
                timeout,
            );
        });
    }

    onSQLResponse(jsonMsg: ResponseMessage): void {
        let err: any = undefined;
        const request = this.currentMessages[jsonMsg.msgId];
        delete this.currentMessages[jsonMsg.msgId];

        let result = jsonMsg.result;
        if (result && result.length === 1) result = result[0]; //if there is only one just return the first RS not a set of RS's

        const currentTime = new Date().getTime();
        const sendTimeMS = currentTime - jsonMsg.javaEndTime;
        const hrend = process.hrtime(request.hrstart);
        const javaDuration = jsonMsg.javaEndTime - jsonMsg.javaStartTime;

        if (jsonMsg.error !== undefined) {
            err = new Error(jsonMsg.error);
        }

        if (this.logTiming)
            console.log(
                'Execution time (hr): %ds %dms dbTime: %dms dbSendTime: %d sql=%s',
                hrend[0],
                hrend[1] / 1000000,
                javaDuration,
                sendTimeMS,
                request.sql,
            );
        request.callback(err, result);
    }

    onSQLError(data: string): void {
        const error = new Error(data);

        const callBackFuncitons: any[] = [];
        for (const k in this.currentMessages) {
            if (this.currentMessages.hasOwnProperty(k)) {
                callBackFuncitons.push(this.currentMessages[k].callback);
            }
        }

        // clear the current messages before calling back with the error.
        this.currentMessages = [];
        callBackFuncitons.forEach(function (cb: Function) {
            cb(error);
        });
    }
}
