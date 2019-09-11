import * as moduleAlias from 'module-alias';
import * as path from 'path';
import * as os from 'os';

const appRoot = path.resolve(__dirname, '..');
const { version } = require('../package.json');

moduleAlias.addAliases({
    '@claw': path.join(appRoot, 'src')
});

// TODO detect all possible extension/plugin paths and add to yargs paths

const yargs = require('yargs').commandDir(path.join(__dirname, '../src/cmd'), {
    extensions: ['js', 'ts']
});

yargs
    .usage('Usage: $0 <command> [options]')
    .env('CLA_WORKER')
    .recommendCommands()
    .version(version)
    .demandCommand(1)
    .strict()
    .help('h')
    .alias('h', 'help').argv;
