import app from '@claw/app';
import * as yargs from 'yargs';
import { actionService } from '@claw/service';

module.exports = new class implements yargs.CommandModule {
    command = 'start';
    describe = 'start the Clarive Worker service';

    builder(args: yargs.Argv) {
        return args;
    }

    async handler(argv: yargs.Arguments) {
        app.build({ argv });

        actionService('status');

        try {
            await app.startup();
        } catch (err) {
            app.debug(err);
            app.fail('command "start": %s', err);
        }
    }
}();
