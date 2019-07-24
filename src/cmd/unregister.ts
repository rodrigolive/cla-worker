import app from '@claw/app';
import * as yargs from 'yargs';
import PubSub from '@claw/pubsub';
import { commonOptions } from '@claw/commands';
import Dispatcher from '@claw/Dispatcher';

module.exports = new class implements yargs.CommandModule {
    command = 'unregister';
    describe = 'Unregister worker from server';

    builder(args: yargs.Argv) {
        commonOptions(args, 'verbose', 'token', 'url', 'workerid', 'tags', 'origin');
        return args;
    }

    async handler(argv: yargs.Arguments) {
        app.build({ argv });

        try {
            await app.startup();
            const { id, token } = app.config;

            const pubsub = new PubSub({
                id,
                token,
                baseURL: argv.url,
                origin: argv.origin,
            });

            const result = await pubsub.unregister();
            const { registration, error, projects } = result;

            if( error ) {
                app.fail(`error unregistering worker: ${error}`);
            }
            else {
                app.milestone('worker registration removed: ', pubsub.id);
            }
        } catch (err) {
            app.debug(err);
            app.fail('command %s: %s', argv._.join(' '), err);
        }
    }
}();

