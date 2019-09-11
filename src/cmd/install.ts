import app from '@claw/app';
import * as yargs from 'yargs';
import PubSub from '@claw/pubsub';
import { installService } from '@claw/service';

import { commonOptions, CmdArgs } from '@claw/commands';

module.exports = new class implements yargs.CommandModule {
    command = 'install';
    describe = 'install the Clarive Worker service';

    builder(args: yargs.Argv) {
        commonOptions(args, 'workerid', 'token');
        return args;
    }

    async handler(argv: CmdArgs) {
        app.build({ argv });

        installService({
            id: argv.workerid,
            auth: argv.auth
        });

        try {
            await app.startup();
        } catch (err) {
            app.debug(err);
            app.fail('command "start": %s', err);
        }
    }
}();
