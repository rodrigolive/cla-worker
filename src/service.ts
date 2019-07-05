const execSync = require('child_process').execSync;
const os = require('os');
// const service = require('os-service');
const service = { add: (...opts) => {}, remove: (...opts) => {} };

export interface Result {
    stdout: string;
    status: number;
    success: number;
}

export function exec(command) {
    var result: Result = { stdout: '', status: 0, success: 1 };

    try {
        result.stdout = execSync(command).toString();
        result.status = 0;
        result.success = 1;
    } catch (error) {
        result = error;
        result.success = 0;
    }

    return result;
}

export function isRoot() {
    let isRoot: any = 0;

    if (/^linux|darwin/.exec(os.platform)) {
        isRoot = process.getuid && process.getuid() === 0;
    } else if (os.platform == 'win32') {
        isRoot = exec('NET SESSION').success;
    }

    return isRoot;
}

export function installService(options) {
    var programArgs = [];

    if (options.id) {
        programArgs.push('--id');
        programArgs.push(options.id);
    }

    if (options.auth) {
        programArgs.push('--auth');
        programArgs.push(options.auth);
    }

    var installOptions = {
        displayName: 'claw',
        programArgs: programArgs,
        username: options.username,
        password: options.password
    };

    if (isRoot()) {
        service.add('claw', installOptions, error => {
            if (error) console.trace(error);
        });
    } else {
        console.log('Needs to be executed as root/Administrator user');
    }
}

export function actionService(action) {
    if (isRoot()) {
        if (os.platform == 'linux') {
            var serviceActionResult;
            serviceActionResult = exec('service claw ' + action);
            serviceActionResult.success
                ? console.log(serviceActionResult.stdout)
                : console.error(serviceActionResult.message);
        } else if (os.platform == 'win32') {
            serviceActionResult = exec(`net ${action} $service /y`);
            serviceActionResult.success
                ? console.log(serviceActionResult.stdout)
                : console.error(serviceActionResult.message);
        }
    } else {
        console.log('Needs to be executed as root/Administrator user');
    }
}

export function removeService(options) {
    if (isRoot()) {
        service.remove('claw', error => {
            if (error) console.trace(error);
        });
    } else {
        console.log('Needs to be executed as root/Administrator user');
    }
}
