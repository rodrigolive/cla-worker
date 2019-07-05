import app from '@claw/app';
import * as types from '@claw/types';

test('build app', () => {
    app.build({ argv: {} });

    expect(app).toBeDefined();
});

test('check modules', ()=>{
    expect(types).toBeDefined();
});
