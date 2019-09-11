import app from '@claw/app';
import * as yargs from 'yargs';
import { commonOptions, CmdArgs } from '@claw/commands';
import { actionService } from '@claw/service';
import { isForked } from '@claw/common';
import { runner } from '@claw/runner';

module.exports = new class implements yargs.CommandModule {
    command = 'start';
    describe = 'start the Clarive Worker service';

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
            'envs'
        );
        return args;
    }

    async handler(argv: yargs.Arguments) {
        app.build({ argv });

        await app.startup();
        app.debug('cla-worker loaded config: ', app.config);

        const { id, logfile, pidfile } = app.config;

        if (id == null) {
            app.fail(
                'workerid is not defined, please set --id [workerid] or configure your cla-worker.yml file'
            );
        }

        if (!isForked()) {
            app.info('spawning cla-worker in the background...');
            app.spawnDaemon();
        } else {
            if (isForked()) {
                app.daemonize();
            }
            runner(argv);
        }
    }
}
