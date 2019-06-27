const moduleAlias = require('module-alias');
const path = require('path');
const fs = require('fs');
const debug = require('debug')('claw:main');
const homedir = require('os').homedir();

const appRoot = path.resolve(__dirname, '..');
// global.appRoot = appRoot;

moduleAlias.addAliases({
    '@claw': path.join(appRoot, 'src')
});

// TODO detect all possible extension/plugin paths and add to yargs paths

const yargs = require('yargs').commandDir(path.join(__dirname, '../src/cmd'), {
    extensions: ['js', 'ts']
});

yargs
    .usage('Usage: $0 <command> [options]')
    .recommendCommands()
    .demandCommand(1)
    .strict()
    .help('h')
    .alias('h', 'help').argv;
