import app from '@claw/app';
import * as yargs from 'yargs';
import { commonOptions, CmdArgs } from '@claw/commands';
import { actionService } from '@claw/service';
import * as fs from 'fs';

module.exports = new class implements yargs.CommandModule {
    command = 'stop';
    describe = 'Stop workers running in the background';

    builder(args: yargs.Argv) {
        commonOptions(args, 'verbose', 'config', 'pidfile', 'workerid');
        return args;
    }

    async handler(argv: yargs.Arguments) {
        app.build({ argv });

        const { id, pidfile } = app.config;

        if (id == null) {
            app.fail(
                'workerid is not defined, please set --id [workerid] or configure your cla-worker.yml file'
            );
        }
        try {
            await app.startup();

            app.killDaemon(pidfile);

        } catch (err) {
            app.debug(err);
            app.fail('command "stop": %s', err);
        }
    }
}();
