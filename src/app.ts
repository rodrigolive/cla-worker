import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'js-yaml';
import * as yargs from 'yargs';

import { Logger } from '@claw/types';
import ConsoleLogger from '@claw/util/logger';

type AppConfig = {
    basedir: string;
    homedir: string;
    tags: string[];
};

class App {
    config: AppConfig & any; // TODO better define what config is
    logger: Logger = new ConsoleLogger();
    argv: yargs.Argv;
    env: string; // TODO this concept does not fit well here
    DEBUG: boolean = false;

    build(params) {
        this.config = this.configure(params.argv);
        this.argv = params.argv;
        this.DEBUG = params.argv.verbose;

        if (params.logger) {
            this.logger = params.logger;
        }

        // this is the global app object
        // App.app = this;
    }

    path(dirOrFile) {
        return path.join(this.config.home, dirOrFile);
    }

    info = this.logger.info.bind(this.logger);
    warn = this.logger.warn.bind(this.logger);
    error = this.logger.error.bind(this.logger);
    milestone = this.logger.milestone.bind(this.logger);
    log = this.logger.info.bind(this.logger);

    debug(msg, ...args) {
        if (!this.DEBUG) return;
        this.logger.debug(msg, ...args);
    }

    fail(msg = 'system failure (no reason)', ...args) {
        this.logger.fatal(1, msg, ...args);
    }

    configure(argv) {
        const CLA_WORKER_BASE =
            process.env.CLA_WORKER_BASE || path.resolve(process.cwd(), '..');

        const CLA_WORKER_HOME = process.env.CLA_WORKER_HOME || process.cwd();

        let defaults = {};

        const configCandidates = [path.join(CLA_WORKER_HOME, './cla-worker.yml')];

        for (const configPath of configCandidates) {
            if (!fs.existsSync(configPath)) continue;
            const baseFile = fs.readFileSync(configPath, 'utf8');
            const configData = YAML.safeLoad(baseFile);
            defaults = { ...defaults, ...configData };
        }

        this.env =
            argv.env ||
            process.env
                .CLA_WORKER_ENV; /* ||
            this.logger.fatal('Missing -c [env] parameter'); */

        let userConfig;

        if (this.env) {
            const configFilename = path.join(
                CLA_WORKER_BASE,
                `./config/${this.env}.yml`
            );

            if (!fs.existsSync(configFilename)) {
                this.logger.fatal(
                    1,
                    `could not find config file '${configFilename}'`
                );
            } else {
                let configFile;

                try {
                    configFile = fs.readFileSync(configFilename, 'utf8');
                } catch (err) {
                    this.logger.fatal(
                        1,
                        `could not open config file '${configFilename}': ${err}`
                    );
                }

                userConfig = YAML.safeLoad(configFile);
            }
        }

        const config = {
            homedir: CLA_WORKER_HOME,
            basedir: CLA_WORKER_BASE,
            ...defaults,
            ...userConfig
        };

        Object.keys(argv).map(key => (config[key] = argv[key]));

        if( typeof config.tags === 'string' ) {
            config.tags = config.tags.split(',')
        }
        else if( !Array.isArray( config.tags ) ) {
            config.tags = [];
        }

        return config;
    }

    async startup() {
        // TODO placeholder method for connecting to internal db, etc.
        return;
    }

    registry() {
        // TODO load registry here, from multiple special registry files (js or yaml?)
        //  located in server/registry/* and from plugins
    }

    loadPlugins() {
        /// TODO load all plugin code
    }

}

export default new App();
