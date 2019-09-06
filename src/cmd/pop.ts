import app from '@claw/app';
import * as yargs from 'yargs';
import * as fs from 'fs';
import PubSub from '@claw/pubsub';
import { commonOptions, CmdArgs } from '@claw/commands';
import { Writable } from 'stream';

interface Args extends CmdArgs {
    key: string;
    filepath: string;
    filekey: string;
    file: string;
}

module.exports = new class implements yargs.CommandModule {
    command = 'pop';
    describe = 'pop file from server';

    builder(args: yargs.Argv) {
        commonOptions(args, 'verbose', 'api-key', 'url');
        args.option('file', {
            describe: 'optional output file'
        });
        args.option('key', {
            describe: 'the file key'
        });
        return args;
    }

    async handler(argv: Args) {
        app.build({ argv });

        const onError: Array<(err: Error) => void> = [];

        try {
            await app.startup();

            const ps = new PubSub({
                baseURL: argv.url,
                apiKey: argv.apiKey
            });

            try {
                await ps.connect();
            } catch (err) {
                app.error('connection error: ', err);
                process.exit(1);
            }

            // await ps.publish(`worker.put_file`, { message: 'ready', scope: [{ id: '1234' }] });
            await ps.publish(`worker.put_file`, { message: 'ready' });

            app.info(`connected with workerId=${ps.id}`);

            let stream;

            if (argv.file) {
                const tmpfile = argv.file + '.' + argv.key;
                app.debug('creating temporary file %s', tmpfile);
                stream = fs.createWriteStream(tmpfile, { flags: 'w' });

                stream.on('error', err => {
                    fs.unlinkSync(tmpfile);
                    app.error('Stream error', err);
                });

                onError.push(() => {
                    fs.unlinkSync(tmpfile);
                });

                stream.on('finish', () => {
                    fs.rename(tmpfile, argv.file, err => {
                        if (err) {
                            app.error(
                                `could not write file ${
                                    argv.file
                                } from temp file ${tmpfile}`
                            );
                        } else {
                            app.info(`wrote file ${argv.file}`);
                        }
                    });
                });
            } else {
                stream = new Writable({
                    write: (data, _, done) => {
                        const [key, msg] = data;
                        app.debug('got data', data);
                        done();
                    }
                });
            }

            stream.on('finish', () => {
                ps.close();
            });

            await ps.pop(argv.key, stream);
        } catch (err) {
            onError.forEach(ev => {
                ev(err);
            });
            app.debug(err);
            app.fail('command %s: %s', app.commandName, err);
        }
    }
}();
