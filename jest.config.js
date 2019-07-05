module.exports = {
    roots: ['<rootDir>/tests'],
    testRegex: '((\\.|/)(test|spec))\\.tsx?$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest'
    },
    moduleNameMapper: {
        '@root/(.*)$': '<rootDir>/$1',
        '@claw/(.*)$': '<rootDir>/src/$1',
        '@claw-test/(.*)$': '<rootDir>/tests/$1'
    }
};

