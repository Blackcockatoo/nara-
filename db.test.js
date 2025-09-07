const { DB } = require('./db');

describe('DB helper', () => {
  beforeEach(() => {
    const store = {};
    global.localStorage = {
      getItem: key => (key in store ? store[key] : null),
      setItem: (key, val) => {
        store[key] = String(val);
      },
    };
  });

  test('set and get round-trip', () => {
    DB.set('foo', {a:1});
    expect(DB.get('foo', {})).toEqual({a:1});
  });

  test('fallback when missing', () => {
    expect(DB.get('missing', 42)).toBe(42);
  });
});
