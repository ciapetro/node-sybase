import path from 'path';
import os from 'os';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import JSONStream from 'JSONStream';

type Message = {
    msgId: number;
    sql: string;
    timeout: number | null;
    callback?: Function;
    isQuery: boolean;
};

type ResponseMessage = {
    msgId: number;
    result: any[] | any;
    error: boolean;
    errorMessage: string;
};

export = class Sybase {
    private connected = false;
    private host: string;
    private port: number;
    private dbname: string;
    private username: string;
    private password: string;
    private logTiming: boolean;
    private logQuery: boolean;
    private pathToRepl: undefined | string;
    private queryCount = 0;
    private currentMessages = {}; // look up msgId to message sent and call back details.
    private jsonParser;
    private repl!: ChildProcessWithoutNullStreams;
    private fileExecutable: string;
    constructor(
        host: string,
        port: number,
        dbname: string,
        username: string,
        password: string,
        logTiming: boolean,
        pathToRepl?: string,
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
        this.pathToRepl = pathToRepl;
        if (this.pathToRepl === undefined) {
            this.pathToRepl = path.resolve(__dirname, '..', 'gorepl', 'dist');
        }
        this.fileExecutable = '';
        switch (os.type()) {
            case 'Windows_NT':
                this.fileExecutable = 'gorepl-win.exe';
                break;
            case 'Linux': {
                this.fileExecutable = './gorepl-linux';
                break;
            }
            case 'Darwin': {
                this.fileExecutable = './gorepl-darwin';
                break;
            }
            default:
                break;
        }
        this.queryCount = 0;
        this.currentMessages = {}; // look up msgId to message sent and call back details.

        this.jsonParser = JSONStream.parse();
    }

    async connect(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.repl = spawn(
                this.fileExecutable,
                [this.host, this.port ? this.port.toString() : '', this.dbname, this.username, this.password],
                {
                    cwd: this.pathToRepl,
                },
            );

            this.repl.stdout.once('data', (data) => {
                if ((data + '').trim() != 'connected') {
                    reject(new Error('Error connecting ' + data));
                    return;
                }

                this.repl.stderr.removeAllListeners('data');
                this.connected = true;

                // set up normal listeners.
                this.repl.stdout
                    .setEncoding('utf8')
                    .pipe(this.jsonParser)
                    .on('data', async (jsonMsg) => {
                        this.onSQLResponse(jsonMsg);
                    });

                this.repl.stderr.on('data', async (err) => {
                    this.onSQLError(err);
                });

                resolve(data);
            });

            // handle connection issues.
            this.repl.stderr.once('data', (data) => {
                this.repl.stdout.removeAllListeners('data');
                this.repl.kill();
                reject(new Error(data));
            });
        });
    }

    disconnect(): void {
        if (this.repl) {
            this.repl.kill();
        }
        this.connected = false;
    }

    get isConnected(): boolean {
        return this.connected;
    }

    execute(sql: string, callback: Function, timeout?: number): void {
        this.sendMessage(sql, callback, false, timeout);
    }
    query(sql: string, callback: Function, timeout?: number): void {
        this.sendMessage(sql, callback, true, timeout);
    }
    sendMessage(sql: string, callback: Function, isQuery: boolean, timeout?: number): void {
        if (this.isConnected === false) {
            callback(new Error("database isn't connected."));
            return;
        }

        this.queryCount++;

        const msg: Message = {
            msgId: this.queryCount,
            sql: sql,
            callback: undefined,
            timeout: timeout && timeout > 0 ? timeout : null,
            isQuery,
        };

        const strMsg = JSON.stringify(msg).replace(/[\n]/g, '\\n');
        msg.callback = callback;

        this.currentMessages[msg.msgId] = msg;

        this.repl.stdin.write(strMsg + '\n');
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

    async executeAsync(sql: string, timeout?: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.execute(
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

        const result = jsonMsg.result;

        if (jsonMsg.error) {
            err = new Error(jsonMsg.errorMessage);
        }

        if (this.logTiming)
            console.log('Execution time (hr): %ds %dms dbTime: %dms dbSendTime: %d sql=%s', request.sql);
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
};
