'use strict;'

const process = require('process');
const os = require('os');
const colors = require('colors');
const util = require('util');

const { MSG, readConfig } = require('./src/common');
const Dispatcher = require('./src/Dispatcher');

const yargs = require('yargs')
    .option('id', { describe: 'set the worker id' })
    .option('user', { describe: 'run worker with another user' })
    .option('config', { describe: 'config YAML file path' })
    .option('auth', { describe: 'redis auth token (redispassword)' })
    .usage('Usage: $0 <command> [options]');

const argv = yargs.argv;
const configFromFile = !argv.config ? {} : readConfig(argv.config);
let [config, redisOpts] = setupWorker(Object.assign( configFromFile, argv ));

startWorker( config, redisOpts );

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
