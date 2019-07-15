import app from '@claw/app';
import * as yargs from 'yargs';
import PubSub from '@claw/pubsub';
import { commonOptions, CmdArgs } from '@claw/commands';
import Dispatcher from '@claw/Dispatcher';
import * as fs from 'fs';

class CmdRun implements yargs.CommandModule {
    command = 'run';
    describe = 'Run the worker online';

    builder(args: yargs.Argv) {
        commonOptions(
            args,
            'verbose',
            'token',
            'url',
            'workerid',
            'logfile',
            'pidfile',
            'tags',
            'daemon'
        );
        return args;
    }

    async handler(argv: CmdArgs) {
        app.build({ argv });

        await app.startup();
        app.debug(argv);

        const { logfile, pidfile } = app.config;

        const isFork = !!process.env['CLA_WORKER_FORKED'];

        if (argv.daemon && !isFork) {
            app.checkRunningDaemon();

            const { spawn } = require('child_process');

            const isNode = process.argv[0] === 'node' ? true : false;

            const subprocess = spawn(
                process.argv[isNode ? 1 : 0],
                process.argv.slice(isNode ? 2 : 1),
                {
                    env: Object.assign({}, process.env, {
                        CLA_WORKER_FORKED: 1
                    }),
                    detached: true,
                    stdio: 'ignore'
                }
            );

            app.info(`forked child with pid ${subprocess.pid}`);
            subprocess.unref();
        } else {
            if (isFork) {
                app.daemonize();
            }
            CmdRun.runner(argv);
        }
    }

    static async runner(argv: CmdArgs) {
        try {
            const pubsub = new PubSub({
                id: argv.id,
                baseURL: argv.url,
                token: argv.token
            });

            try {
                await pubsub.connect();
            } catch (err) {
                app.error('could not connect to server: ', err.message);
                process.exit(1);
            }

            var disposePubSub = pubsub.subscribe(
                [
                    'worker.put_file',
                    'worker.get_file',
                    'worker.exec',
                    'worker.eval',
                    'worker.ready',
                    'worker.capable'
                ],
                async (eventName, eventData, eventFind, oid) => {
                    app.debug('got message:', eventName, eventData);

                    try {
                        const dispatcher = new Dispatcher(
                            pubsub,
                            app.config,
                            eventName,
                            oid,
                            eventData
                        );

                        await dispatcher.process();
                    } catch (error) {
                        app.error(
                            `error processing message ${eventName} (${oid}): ${error}`
                        );
                    }
                },
                err => {
                    app.error('connection error: ', err);
                }
            );
        } catch (err) {
            app.debug(err);
            app.fail('command %s: %s', argv._.join(' '), err);
        }
    }
}

module.exports = new CmdRun();
