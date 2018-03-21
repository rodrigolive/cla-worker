'use strict;'

const yaml = require('js-yaml');

const MSG = { error: '[error]'.red, warn: '[warn]'.yellow, info: '[info]'.blue, debug: '[debug]'.grey };

const length = arg => {
    return arg !== undefined && arg !== null && arg.length > 0
};

const readConfig = (file) => {

    console.log(MSG.info, "Parsing config file:", file);

    try {
        configFromFile = yaml.safeLoad(fs.readFileSync(file, 'utf8'));
        return configFromFile;
    } catch (e) {
        console.error(MSG.error, e.toString());
        process.exit(12);
    }
}

module.exports = { MSG, length, readConfig };
