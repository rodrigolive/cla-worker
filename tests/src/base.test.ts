import app from '@claw/app';
import * as types from '@claw/types';

test('build app', () => {
    app.build({ argv: { _: ['testcmd'], $0: 'testcmd' } });

    expect(app).toBeDefined();
});

test('check modules', () => {
    expect(types).toBeDefined();
});
