import * as yargs from 'yargs';
import { origin } from '@claw/common';

const commons = {
    workerid: {
        alias: 'id',
        describe: 'sets the worker id'
    },
    passkey: {
        required: true,
        describe: 'the server registration passkey'
    },
    token: {
        required: true,
        describe: 'set the registered worker connection token'
    },
    verbose: {
        alias: 'v',
        count: true
    },
    daemon: {
        alias: 'fork',
        type: 'boolean',
        default: false,
        describe: 'run worker in the background'
    },
    logfile: {
        default: `${process.cwd()}/cla-worker.log`,
        describe: 'path to log file'
    },
    pidfile: {
        default: `${process.cwd()}/cla-worker.pid`,
        describe: 'path to daemon pid file'
    },
    tags: {
        describe: 'set the worker tags'
    },
    origin: {
        default: origin(),
        describe: 'current user@hostname'
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

export interface CmdArgs extends yargs.Arguments {
    passkey: string;
    token: string;
    verbose: boolean | number;
}
