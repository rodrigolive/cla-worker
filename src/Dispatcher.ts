import app from '@claw/app';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as util from 'util';

import { MSG, length } from '@claw/common';
import PubSub from '@claw/pubsub';

import { Writable } from 'stream';

const fsAsync = {
    rename: util.promisify(fs.rename)
}

export default class Dispatcher {
    message: any;
    pubsub: PubSub;
    cmd: string;
    msgId: string;
    config: any;

    constructor(pubsub, config, cmd, msgId, message) {
        this.pubsub = pubsub;
        this.cmd = cmd;
        this.msgId = msgId;
        this.message = message;
        this.config = config;
    }

    async process() {
        app.info('dispatching message:', this.msgId);

        await this.pubsub.publish(`${this.cmd}.ack`, { oid: this.msgId });

        try {
            switch (this.cmd) {
                case 'worker.ready':
                    break;
                case 'worker.put_file':
                    await this.cmdPutFile(this.message);
                    break;
                case 'worker.get_file':
                    await this.cmdGetFile(this.message);
                    break;
                case 'worker.exec':
                    await this.cmdExec(this.message);
                    break;
                default:
                    this.publishError(
                        util.format(
                            'Invalid command %s in message id=%s',
                            this.cmd,
                            this.msgId
                        )
                    );
            }
        } catch (err) {
            this.publishError(err);
            this.done();
        }
    }

    publishError(err) {
        if (typeof err == 'object') {
            err = err.toString();
        }
        err = `during command ${this.cmd}: ${err}`;
        app.error(err);

        let result = {
            ret: err,
            rc: 99,
            output: err
        };
        this.result(result);
        this.done();
    }

    cmdExec({ cmd }) {
        const [cmdName, ...cmdArgs] = cmd;
        const cmdOpts: any = {};

        if (length(this.message.chdir)) cmdOpts.cwd = this.message.chdir;
        if (!cmdArgs.length) cmdOpts.shell = true;

        app.debug(
            'Running cmd=%s, args=%s, opts=%s',
            cmdName,
            cmdArgs,
            JSON.stringify(cmdOpts)
        );

        let output = '';

        const proc = spawn(cmdName, cmdArgs, cmdOpts).on('error', err => {
            let { message } = err;
            if (/ENOENT/.exec(message)) {
                message = util.format(
                    "Could not run command '%s' with options: %s",
                    cmdName,
                    JSON.stringify([cmdArgs, cmdOpts])
                );
            }
            this.publishError(message);
        });

        proc.stdout.on('data', data => {
            output += data;
            app.debug(`stdout: ${data}`);
        });

        proc.stderr.on('data', data => {
            output += data;
            app.debug(`stderr: ${data}`);
        });

        proc.on('close', code => {
            let result = {
                ret: '',
                rc: code,
                output: output
            };
            this.result(result);
            this.done();
        });
    }

    async cmdGetFile({ filepath, filekey }) {
        const { pubsub } = this;

        if (!filekey) {
            throw 'Missing filekey in get_file operation';
        }

        if (!filepath) {
            throw 'Missing filepath in get_file operation';
        }

        try {
            const readStream = fs.createReadStream(filepath, {
                highWaterMark: this.config.chunk_size
            });

            readStream.on('error', err => {
                const errMsg = `could not read file ${filepath}: ${err.toString()}`;

                app.error('get_file: read stream error', err);

                pubsub.publish('worker.get_file.fail', {
                    oid: this.msgId,
                    filepath,
                    filekey,
                    error: errMsg
                });
            });

            await pubsub.push(filekey, filepath, readStream);

            readStream.close();
            await pubsub.publish('worker.get_file.done', {
                oid: this.msgId,
                filekey,
                filepath
            });

            app.milestone(`get_file done ${filepath}`);
        } catch (err) {
            await pubsub.publish('worker.put_file.fail', {
                oid: this.msgId,
                filekey,
                filepath,
                error: err.toString()
            });

            app.error(err.toString());
        }
    }

    Old_cmdGetFile({ filepath }) {
        let readStream = fs.createReadStream(filepath, {
            highWaterMark: this.config.chunk_size
        });

        readStream.on('error', err => {
            app.error(`Worker error reading from file ${filepath}:`, err);
            this.publishError(err);
        });

        let bytes = 0;

        fs.stat(filepath, (err, stat) => {
            this.pubsub.publish(
                `queue:${this.msgId}:file`,
                JSON.stringify(stat)
            );

            readStream
                .on('data', chunk => {
                    var buf = Buffer.from(chunk).toString('base64');
                    this.pubsub.publish(`queue:${this.msgId}:file`, buf);
                    bytes += chunk.length;
                })
                .on('end', () => {
                    this.result({ stat });
                    this.done();
                });
        });
    }

    async cmdPutFile({ filepath, filekey }) {
        const { pubsub } = this;
        const onError: Array<(err: Error) => void> = [];

        if (!filekey) {
            throw 'Missing filekey in put_file operation';
        }

        if (!filepath) {
            throw 'Missing filekey in put_file operation';
        }

        let lastError = '';

        try {
            const tmpfile = [filepath, filekey, 'temp'].join('.');
            app.debug('creating temporary file %s', tmpfile);

            let stream = fs.createWriteStream(tmpfile, { flags: 'w' });

            stream.on('error', err => {
                lastError = err.toString();

                if (fs.existsSync(tmpfile)) {
                    fs.unlinkSync(tmpfile);
                }

                const errMsg = `could not write temporary file ${tmpfile}: ${err.toString()}`;

                app.error('put_file: write stream error', err);

                pubsub.publish('worker.put_file.fail', {
                    oid: this.msgId,
                    filekey,
                    filepath,
                    error: errMsg
                });
            });

            onError.push(err => {
                if(fs.existsSync(tmpfile))
                    fs.unlinkSync(tmpfile);
            });

            stream.on('finish', async () => {
                try {
                    await fsAsync.rename(tmpfile, filepath);
                    await pubsub.publish('worker.put_file.done', {
                        oid: this.msgId,
                        filekey,
                        filepath
                    });
                    app.milestone(`put_file: wrote file ${filepath}`);
                } catch(err) {
                    onError.forEach(ev => {
                        ev(err);
                    });
                    await pubsub.publish('worker.put_file.fail', {
                        oid: this.msgId,
                        filekey,
                        filepath,
                        error: lastError
                    });
                    app.error(
                        `could not write file ${filepath} from temp file ${tmpfile}`, err
                    );
                }
            });

            await pubsub.pop(filekey, stream);
        } catch (err) {
            await pubsub.publish('worker.put_file.fail', {
                oid: this.msgId,
                filekey,
                filepath,
                error: err.toString()
            });
            onError.forEach(ev => {
                ev(err);
            });
            app.error(err.toString());
        }
    }

    Old_cmdPutFile() {
        const { pubsub } = this;
        const path = this.message.filepath;

        var writeStream = fs.createWriteStream(path, { flags: 'w' });

        writeStream.on('error', err => {
            app.error('Stream error', err);
            this.publishError(err);
        });

        let key = `queue:${this.msgId}:file`;

        const readStream = new Writable({
            objectMode: true,
            write: (data, _, done) => {
                let [key, msg] = data;

                var buf = Buffer.from(msg, 'base64');

                writeStream.write(buf);

                fs.stat(path, (err, stat) => {
                    this.result({ stat });
                    this.done();
                });

                done();
            }
        });

        readStream.on('error', err => {
            app.error(
                `Failed to get file for put_file command, key=${key}, error=${err}`
            );
        });

        pubsub.pop(key, readStream);
    }

    result(result) {
        this.pubsub.publish(
            `queue:${this.msgId}:result`,
            JSON.stringify(result)
        );
    }

    done() {
        this.pubsub.publish(`queue:${this.msgId}:done`, '');
    }
}
