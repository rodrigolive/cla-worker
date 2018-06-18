'use strict;'

const process = require('process');
const os = require('os');
const colors = require('colors');
const util = require('util');
const fs = require('fs');
const execSync = require('child_process').execSync;

const { MSG, readConfig } = require('./src/common');
const Dispatcher = require('./src/Dispatcher');

const yargs = require('yargs')
    .option('install', { describe: 'install claw as a service' })
    .option('remove', { describe: 'remove the claw service' })
    .option('start', { describe: 'start the claw service' })
    .option('stop', { describe: 'stop the claw service' })
    .option('status', { describe: 'status of the claw service' })
    .option('run', { describe: 'run claw in online mode' })
    .option('id', { describe: 'set the worker id' })
    .option('user', { describe: 'run worker with another user' })
    .option('config', { describe: 'config YAML file path' })
    .option('auth', { describe: 'redis auth token (redispassword)' })
    .usage('Usage: $0 <command> [options]');

const argv = yargs.argv;
const configFromFile = !argv.config ? {} : readConfig(argv.config);
let [config, redisOpts] = setupWorker(Object.assign( configFromFile, argv ));

if( config.run ) {

    startWorker( config, redisOpts );

}

function setupWorker(config) {

    if (config.user) {

        console.log(MSG.info, "Surrogating as user:", config.user);

        try {
            process.setuid(config.user);
        } catch (err) {
            console.error(MSG.error, `Could not surrogate as user ${config.user}:`, err.toString());
            process.exit(15);
        }
    }

    if (!config.chunk_size) config.chunk_size = 64 * 1024;

    let redisOpts = {
        showFriendlyErrorStack: true,
        lazyConnect: true,
        retryStrategy: function(times) {
            var delay = Math.min(times * 50, 2000);
            return delay;
        }
    };
    if (config.host) {
        console.log("Connecting to host: %s", config.host);
        redisOpts.host = config.host;
    }
    if (config.port) {
        console.log("Connecting to port: %s", config.port);
        redisOpts.port = config.port;
    }
    if (config.url) {
        redisOpts.url = config.url;
    }

    if (config.auth) {
        redisOpts.password = config.auth;
    }

    const hostname = os.hostname();
    const username = os.userInfo().username;
    const pid = process.pid;

    config.workerid = config.id && config.id.length ?
        config.id :
        `${username}@${hostname}/${pid}`;

    return [config, redisOpts];
}

function connectWorker(redisOpts) {

    const Redis = require('ioredis');

    return new Promise( (res) => {
        let redis = new Redis(redisOpts);

        Redis.Promise.onPossiblyUnhandledRejection(function (error) {
            console.error( MSG.error, error.toString() );
        });

        redis.on('error', (err) => {
            console.error( MSG.error, "Could not connect to redis", err.toString() );
        });
        redis.on('ready', () => {
            let pub = redis.duplicate();
            res( [ redis, pub ] );
        });
        redis.connect();
    });
}

async function startWorker(config) {

    let [ redis, pub ] = await connectWorker(redisOpts);

    let workerid = config.workerid;

    const QUEUE = {
        pong: `queue:pong:${workerid}`,
        work: `queue:${workerid}:*`,
        capability: `queue:capability:*`
    };

    console.log(MSG.info, "Clarive Worker. Starting...");
    console.log(MSG.info, "Worker ID:", workerid.bold);

    pub.on('pmessage', function(pattern, channel, message) {

        console.log(MSG.debug, util.format('MSG pattern=%s, channel=%s, msg=%s', pattern, channel, message));

        if (pattern == QUEUE.work && channel.length) {

            let decodedMsg = message && message.length ? JSON.parse(message) : {};

            let [ns, workerid, cmd, msgId] = channel.split(/:/);
            if (msgId && msgId.length) {
                new Dispatcher(redis, config, cmd, msgId, decodedMsg);
            }
        }
    });

    pub.subscribe(QUEUE.pong, function(err, count) {
        redis.publish(`queue:${workerid}:ping`, '');
    });

    pub.psubscribe(QUEUE.work, function(err, count) {
        console.log('Subscribed to worker queue.'.white);
    });

    pub.psubscribe(QUEUE.capability, function(err, count) {
        console.log('Subscribed to capability queue.'.white);
    });

    redis.hset('queue:workers', workerid, config, function(err, count) {
        if (err) {
            console.error(MSG.error, 'Could not register into workers queue', err);
        } else {
            console.log("Registered into worker queue.");
        }
    });
}

if ( config.remove ) {

    removeService({ });
}

if ( config.install ) {

    installService( {
        id: config.id,
        username: config.username,
        password: config.password,
        auth: config.auth
    } );

}

if ( config.start ) {

    actionService( 'start' );

}

if ( config.stop ) {

    actionService( 'stop' );

}

if ( config.status ) {

    actionService( 'status' );

}

function exec(command) {

    var result = {};

    try {

        result.stdout = execSync(command).toString();
        result.status = 0;
        result.success = 1;

    } catch( error ) {

        result = error;
        result.success = 0;

    }

    return result;

}

function isRoot() {

    var isRoot = 0;

    if( os.platform == 'linux' ) {

        isRoot = process.getuid && process.getuid() === 0;

    } else if( os.platform == 'win32' ) {

        isRoot = exec('NET SESSION').success;

    }

    return isRoot;
}

function installService(options) {

    const service = require ("os-service");
    var programArgs = [];

    if (options.id) {
        programArgs.push("--id");
        programArgs.push(options.id);
    }

    if (options.auth) {
        programArgs.push("--auth");
        programArgs.push(options.auth);
    }

    var installOptions = {
        displayName: "claw",
        programArgs: programArgs,
        username: options.username,
        password: options.password
    };

    if ( isRoot() ) {

        service.add ("claw", installOptions, (error) => {

            if (error)
                console.trace(error);

        });

    } else {

        console.log("Needs to be executed as root/Administrator user");

    }

}

function removeService(options) {

    const service = require ("os-service");

    if ( isRoot() ) {

        service.remove ("claw", (error) => {
            if (error)
                console.trace(error);
        });

    } else {

        console.log("Needs to be executed as root/Administrator user");

    }

}

function actionService(action) {

    const service = require ("os-service");

    if ( isRoot() ) {

        if( os.platform == 'linux' ) {

            var serviceActionResult;
            serviceActionResult = exec('service claw ' + action);
            serviceActionResult.success ? console.log(serviceActionResult.stdout)
                : console.error(serviceActionResult.message);


        } else if( os.platform == 'win32' ) {

            serviceActionResult = exec(`net ${action} $service /y`);
            serviceActionResult.success ? console.log(serviceActionResult.stdout)
                : console.error(serviceActionResult.message);
        }

    } else {

        console.log("Needs to be executed as root/Administrator user");

    }

}

