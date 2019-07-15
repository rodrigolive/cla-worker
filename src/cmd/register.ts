import app from '@claw/app';
import * as yargs from 'yargs';
import PubSub from '@claw/pubsub';
import { commonOptions, CmdArgs } from '@claw/commands';
import Dispatcher from '@claw/Dispatcher';

module.exports = new class implements yargs.CommandModule {
    command = 'register';
    describe = 'Register worker with a passkey';

    builder(args: yargs.Argv) {
        commonOptions(args, 'verbose', 'passkey', 'url', 'workerid', 'tags', 'origin');
        return args;
    }

    async handler(argv: CmdArgs) {
        app.build({ argv });

        try {
            await app.startup();

            const pubsub = new PubSub({
                id: argv.id,
                baseURL: argv.url,
                origin: argv.origin,
            });

            const result = await pubsub.register(argv.passkey);
            const { token, error, projects } = result;

            if( error ) {
                app.fail(`error registering worker: ${error}`);
            }
            else {
                app.info('Registration token: ', token);
                app.info('Projects registered: ', projects);
                app.info(`Start the worker with the following command:

            cla-worker run --token ${token} --id ${pubsub.id}\n`);
            }
        } catch (err) {
            app.debug(err);
            app.fail('command %s: %s', argv._.join(' '), err);
        }
    }
}();
