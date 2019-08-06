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
            'config',
            'workerid',
            'logfile',
            'pidfile',
            'tags',
            'envs',
            'daemon'
        );
        return args;
    }

    async handler(argv: CmdArgs) {
        app.build({ argv });

        await app.startup();
        app.debug('cla-worker loaded config: ', app.config);

        const { id, daemon, logfile, pidfile } = app.config;

        if( id == null ) {
            app.fail('workerid is not defined, please set --id [workerid] or configure your cla-worker.yml file');
        }

        const isFork = !!process.env['CLA_WORKER_FORKED'];

        if (daemon && !isFork) {
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
        const { id, url, token, tags, envs } = app.config;

        try {
            if (!token) {
                app.warn(`no token detected for workerId=${id}.`);
                app.warn(
                    `register your worker first with "cla-worker register" to get an id/token pair or set it with --token [your_token]`
                );
            }

            const pubsub = new PubSub({
                id,
                token,
                tags,
                envs,
                baseURL: url
            });

            app.on('exit', async () => {
                app.info('closing connection to Clarive server...');
                await pubsub.close();
                app.milestone('worker shutdown completed!');
            });

            try {
                await pubsub.connect();
            } catch (err) {
                if (err.status === 401) {
                    app.error(
                        `could not connect to server: worker id=${id} is not authorized. Have you ran "cla-worker register"?`
                    );
                } else {
                    app.error(
                        `could not connect to server: ${err.status||''} ${
                            err.message
                        }: ${err.warning}`
                    );
                }
                process.exit(1);
            }

            var disposePubSub = pubsub.subscribe(
                [
                    'worker.put_file',
                    'worker.get_file',
                    'worker.exec',
                    'worker.eval',
                    'worker.ready',
                    'worker.shutdown',
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
                    const msg = err.message
                        ? `${err.message} (code: ${err.status})`
                        : 'server not available';
                    app.error(
                        `connection error to server ${pubsub.baseURL}: `,
                        msg
                    );
                }
            );
        } catch (err) {
            app.debug(err);
            app.fail('command %s: %s', app.commandName, err);
        }
    }
}

module.exports = new CmdRun();
