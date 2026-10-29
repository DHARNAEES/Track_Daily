const test = require('node:test');
const assert = require('node:assert/strict');

function fakeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}
// auth.js binds to `window` or globalThis at load time, so give it a fresh storage per test.
function load() {
  delete require.cache[require.resolve('../auth.js')];
  globalThis.localStorage = fakeStorage();
  return require('../auth.js');
}

test('validateSignup checks username, password length and duplicates', () => {
  const A = load();
  assert.match(A.validateSignup('a', 'secret1', []), /Username/);
  assert.match(A.validateSignup('alice', '123', []), /Password/);
  assert.match(A.validateSignup('Alice', 'secret1', [{ username: 'alice' }]), /taken/);
  assert.equal(A.validateSignup('Alice', 'secret1', []), '');
});

test('each user gets a different key prefix', () => {
  const A = load();
  assert.notEqual(A.userKey('1', 'vantage_transactions_v1'), A.userKey('2', 'vantage_transactions_v1'));
});

test('sign up, sign out, wrong password rejected, right password signs in', async () => {
  const A = load();
  const u = await A.signUp('Alice', 'secret1', 'Alice A');
  assert.equal(A.currentUser().id, u.id);
  A.signOut();
  assert.equal(A.currentUser(), null);
  await assert.rejects(A.signIn('alice', 'wrong-pass'), /Wrong username or password/);
  await assert.rejects(A.signIn('nobody', 'secret1'), /Wrong username or password/);
  assert.equal((await A.signIn('ALICE', 'secret1')).id, u.id);
  assert.equal(A.currentUser().name, 'Alice A');
});

test('passwords are not stored in plain text', async () => {
  const A = load();
  await A.signUp('alice', 'secret1');
  assert.ok(!localStorage.getItem(A.USERS_KEY).includes('secret1'));
});

test('first account adopts pre-account data once; later accounts start empty', async () => {
  const A = load();
  localStorage.setItem('vantage_transactions_v1', '[{"id":"t1"}]');
  assert.equal(A.hasUnclaimedLegacyData(), true);
  const a = await A.signUp('alice', 'secret1');
  assert.equal(localStorage.getItem(A.userKey(a.id, 'vantage_transactions_v1')), '[{"id":"t1"}]');
  assert.equal(A.hasUnclaimedLegacyData(), false);
  const b = await A.signUp('bob', 'secret2');
  assert.equal(localStorage.getItem(A.userKey(b.id, 'vantage_transactions_v1')), null);
  // original data is kept as a safety copy
  assert.equal(localStorage.getItem('vantage_transactions_v1'), '[{"id":"t1"}]');
});

test('currentUser ignores a session pointing at a deleted account', async () => {
  const A = load();
  await A.signUp('alice', 'secret1');
  localStorage.setItem(A.SESSION_KEY, JSON.stringify({ userId: 'ghost' }));
  assert.equal(A.currentUser(), null);
});
