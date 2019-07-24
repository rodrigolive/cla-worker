import app from '@claw/app';
import * as types from '@claw/types';

test('build app', () => {
    app.build({ argv: { _: ['testcmd'], $0: 'testcmd' } });

    expect(app).toBeDefined();
});

test('check modules', () => {
    expect(types).toBeDefined();
});

test('app args are stronger than config', () => {
    app.config = { ...app.config, id: '333', token: '444' };

    app.build({
        argv: { _: ['testcmd'], $0: 'testcmd', id: '123', token: '456' }
    });

    expect(app.config).toMatchObject({ id: '123', token: '456' });
});

test('app arg id loads token from config', () => {
    app.config.registrations = [{ id: '123', token: '456' }];

    app.build({
        argv: { _: ['testcmd'], $0: 'testcmd', config: false, id: '123' }
    });

    expect(app.config).toMatchObject({ id: '123', token: '456' });
});

test('app arg token takes precedence over token from config', () => {
    app.config.registrations = [{ id: '123', token: '456' }];

    app.build({
        argv: {
            _: ['testcmd'],
            $0: 'testcmd',
            config: false,
            id: '123',
            token: '777'
        }
    });

    expect(app.config).toMatchObject({ id: '123', token: '777' });
});
