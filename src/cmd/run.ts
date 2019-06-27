import app from '@claw/app';
import * as yargs from 'yargs';
import PubSub from '@claw/pubsub';
import { commonOptions } from '@claw/commands';
import Dispatcher from '@claw/Dispatcher';

module.exports = new class implements yargs.CommandModule {
    command = 'run';
    describe = 'Run the worker online';

    builder(args: yargs.Argv) {
        commonOptions(args, 'verbose', 'api-key', 'url', 'workerid', 'capabilities');
        return args;
    }

    async handler(argv: yargs.Arguments) {
        app.build({ argv });

        try {
            await app.startup();

            console.log(argv);

            const pubsub = new PubSub({
                //username: 'rodrigo',
                id: argv.id,
                baseURL: argv.url,
                apiKey: argv.apiKey
            });

            try {
                await pubsub.connect();
            } catch (err) {
                app.error('could not connect to server: ', err);
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
}();
