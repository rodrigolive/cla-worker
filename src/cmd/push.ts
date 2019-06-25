import app from '@claw/app';
import * as yargs from 'yargs';
import * as fs from 'fs';
import * as path from 'path';
import PubSub from '@claw/pubsub';
import { commonOptions } from '@claw/commands';
import { Writable } from 'stream';

module.exports = new class implements yargs.CommandModule {
    command = 'push';
    describe = 'push file to server';

    builder(args: yargs.Argv) {
        commonOptions(args, 'verbose', 'api-key', 'url');
        args.option('file', {
            describe: 'input file'
        });
        args.option('key', {
            describe: 'the file key'
        });
        return args;
    }

    async handler(argv: yargs.Arguments) {
        app.build({ argv });

        const filepath = argv.file;
        const filekey  = argv.key;

        const pubsub = new PubSub({
            baseURL: argv.url,
            apiKey: argv.apiKey
        });

        try {
            await app.startup();

            await pubsub.connect();
        } catch (err) {
            app.error('connection error: ', err);
            process.exit(1);
        }

        try {
            const chunkSize = 1000 * 64;

            const readStream = fs.createReadStream(filepath, {
                highWaterMark: chunkSize
            });

            readStream.on('error', err => {
                const errMsg = `could not read file ${filepath}: ${err.toString()}`;

                app.error('get_file: read stream error', err);

                pubsub.publish('worker.get_file.fail', {
                    filepath,
                    filekey,
                    error: errMsg
                });
            });

            readStream.on('finish', async () => {
                app.milestone(`get_file: read file ${filepath}`);
            });

            await pubsub.push(filekey, filepath, readStream);
            readStream.close();
            app.milestone(`done ${filepath}`);
            pubsub.close();
        } catch (err) {
            app.error(err.toString());
            pubsub.close();
        }
    }
}();

