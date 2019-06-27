import * as yargs from 'yargs';

const commons = {
    workerid: {
        alias: 'id',
        describe: 'sets the worker id'
    },
    'api-key': {
        alias: 'api_key',
        describe: 'set the worker connection api-key token'
    },
    verbose: {
        alias: 'v',
        count: true
    },
    capabilities: {
        alias: 'can',
        describe: 'set the worker capabilities'
    },
    url: {
        default: 'http://localhost:8080',
        describe: 'set the base server url'
    }
};

export function commonOptions(args: yargs.Argv, ...options) {
    for (const option of options) {
        const val = commons[option];
        if (!val) {
            throw `invalid common option '${option}'`;
        }
        args.option(option, val);
    }

    return args;
}
