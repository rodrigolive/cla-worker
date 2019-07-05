import app from '@claw/app';
import * as yargs from 'yargs';
import PubSub from '@claw/pubsub';
import { removeService } from '@claw/service';

module.exports = new class implements yargs.CommandModule {
    command = 'remove';
    describe = 'remove the Clarive Worker service';

    builder(args: yargs.Argv) {
        return args;
    }

    async handler(argv: yargs.Arguments) {
        app.build({ argv });

        removeService({});

        try {
            await app.startup();
        } catch (err) {
            app.debug(err);
            app.fail('command "stop": %s', err);
        }
    }
}();
