'use strict;'

const { spawn } = require('child_process');
const { MSG, length } = require('./common');
const util = require('util');
const fs = require('fs');

class Dispatcher {

    constructor(redis, config, cmd, msgId, message) {
        this.redis = redis;
        this.cmd = cmd;
        this.msgId = msgId;
        this.message = message;
        this.config = config;

        console.log(MSG.info, "Processing message:", this.msgId);
        redis.publish(`queue:${this.msgId}:start`, '');

        try {
            switch (cmd) {
                case 'put_file':
                    this.cmdPutFile();
                    break;
                case 'get_file':
                    this.cmdGetFile();
                    break;
                case 'exec':
                    this.cmdExec();
                    break;
                default:
                    this.publishError(util.format("Invalid command %s in message id=%s", cmd, this.msgId));
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
        err = util.format("[error] during command %s: %s", this.cmd, err);
        console.error(MSG.error, err);

        let result = {
            ret: err,
            rc: 99,
            output: err
        };
        this.result(result);
        this.done();
    }

    cmdExec() {
        var self = this;

        let [cmdName, ...cmdArgs] = this.message.cmd;
        let cmdOpts = {};

        if (length(this.message.chdir)) cmdOpts.cwd = this.message.chdir;
        if (!cmdArgs.length) cmdOpts.shell = true;

        console.log(MSG.debug, "Running cmd=%s, args=%s, opts=%s", cmdName, cmdArgs, JSON.stringify(cmdOpts));

        let output = '';

        const proc = spawn(cmdName, cmdArgs, cmdOpts).on("error", (err) => {
            if (/ENOENT/.exec(err)) {
                err = util.format("Could not run command '%s' with options: %s", cmdName, JSON.stringify([cmdArgs, cmdOpts]));
            }
            self.publishError(err);
        });

        proc.stdout.on('data', (data) => {
            output += data;
            console.log(MSG.debug, `stdout: ${data}`);
        });

        proc.stderr.on('data', (data) => {
            output += data;
            console.log(MSG.debug, `stderr: ${data}`);
        });

        proc.on('close', (code) => {
            let result = {
                ret: '',
                rc: code,
                output: output
            };
            this.result(result);
            this.done();
        });
    }

    cmdGetFile() {
        const self = this;

        const path = this.message.filepath;

        let readStream = fs.createReadStream(path, { highWaterMark: self.config.chunk_size });
        readStream.on('error', (err) => {
            console.error(MSG.error, `Worker error reading from file ${path}:`, err);
            self.publishError(err);
        });

        let bytes = 0;

        fs.stat(path, (err, stat) => {

            self.redis.rpush(`queue:${self.msgId}:file`, JSON.stringify(stat));

            readStream.on('data', chunk => {
                var buf = Buffer.from(chunk).toString('base64');
                self.redis.rpush(`queue:${self.msgId}:file`, buf);
                bytes += chunk.length;
            }).on('end', () => {
                self.result({ stat });
                self.done();
            });
        });
    }

    cmdPutFile() {
        const self = this;

        const path = self.message.filepath;
        const redisBlocking = self.duplicate();

        var writeStream = fs.createWriteStream(path, { flags: 'w' });
        writeStream.on('error', (err) => {
            console.error(MSG.error, "Stream error", err);
            self.publishError(err);
        });

        let key = `queue:${self.msgId}:file`;

        const loop = () => {
            redisBlocking.blpop(key, 1, (err, data) => {
                if (err) {
                    console.error(MSG.error, "Failed to get file for put_file command, key=%s, error=%s", key, err);
                } else if (data) {
                    let [key, msg] = data;

                    var buf = Buffer.from(msg, 'base64');

                    writeStream.write(buf);

                    loop();

                    fs.stat(path, (err, stat) => {
                        self.result({ stat });
                        self.done();
                    });
                }
            });
        }

        loop();
    }

    duplicate() {
        return this.redis.duplicate();
    }

    result(result) {
        this.redis.set(`queue:${this.msgId}:result`, JSON.stringify(result));
    }

    done() {
        this.redis.publish(`queue:${this.msgId}:done`, '');
    }
}

module.exports = Dispatcher;
