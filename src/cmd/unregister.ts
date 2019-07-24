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

            const pubsub = new PubSub({
                id: argv.id,
                baseURL: argv.url,
                origin: argv.origin,
                token: argv.token
            });

            const result = await pubsub.unregister();
            const { registration, error, projects } = result;

            if( error ) {
                app.fail(`error unregistering worker: ${error}`);
            }
            else {
                app.info('Worker registration removed: ', pubsub.id);
            }
        } catch (err) {
            app.debug(err);
            app.fail('command %s: %s', argv._.join(' '), err);
        }
    }
}();

