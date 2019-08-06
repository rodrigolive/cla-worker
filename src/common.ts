import app from '@claw/app';
import * as yaml from 'js-yaml';
import * as os from 'os';
import * as fs from 'fs';

export const length = arg => {
    return arg !== undefined && arg !== null && arg.length > 0;
};

export const readConfig = file => {
    app.info('Parsing config file:', file);

    try {
        const configFromFile = yaml.safeLoad(fs.readFileSync(file, 'utf8'));
        return configFromFile;
    } catch (e) {
        app.error(e.toString());
        process.exit(12);
    }
};

export const origin = () => `${os.userInfo().username}@${os.hostname()}#${process.pid}`;
