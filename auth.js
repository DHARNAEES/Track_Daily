/* Track Daily — local accounts. Each account's data is stored under its own key prefix, so users sharing one
   browser never see or overwrite each other's data. Accounts live on this device only (no server), so this keeps
   people's data apart; it is not encryption. Loaded by login.html and index.html; the pure helpers are unit tested. */
(function (root) {
  'use strict';

  const USERS_KEY = 'td_users_v1';
  const SESSION_KEY = 'td_session_v1';
  const LEGACY_CLAIMED_KEY = 'td_legacy_claimed_v1';
  // Keys used before accounts existed; the first account created on a device adopts them.
  const LEGACY_KEYS = [
    'vantage_transactions_v1', 'vantage_accounts_v1', 'vantage_recurring_v1',
    'vantage_budgets_v1', 'vantage_custom_categories_v1', 'vantage_meta_v1',
  ];
  const PBKDF2_ITERATIONS = 150000;

  /* ---------------- pure helpers ---------------- */

  function normalizeUsername(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  /** Returns an error message, or '' when the sign-up details are acceptable. */
  function validateSignup(username, password, existingUsers, email) {
    const u = normalizeUsername(username);
    if (!/^[a-z0-9._-]{3,24}$/.test(u)) return 'Username must be 3–24 letters, numbers, dots, dashes or underscores';
    if (String(password).length < 6) return 'Password must be at least 6 characters';
    if ((existingUsers || []).some(x => x.username === u)) return 'That username is already taken on this device';
    if (email !== undefined) {
      const e = normalizeUsername(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Enter a valid email address';
      if ((existingUsers || []).some(x => x.email === e)) return 'That email is already used on this device';
    }
    return '';
  }

  /** Storage key for one user's copy of an app key. Ids are generated here, never user-typed. */
  function userKey(userId, name) { return 'u_' + userId + '__' + name; }

  function newId() {
    const b = new Uint8Array(8);
    root.crypto.getRandomValues(b);
    return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  }

  /* ---------------- storage (browser only) ---------------- */

  function readJSON(key, fallback) {
    try { const v = JSON.parse(root.localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function writeJSON(key, value) { root.localStorage.setItem(key, JSON.stringify(value)); }

  function getUsers() { const u = readJSON(USERS_KEY, []); return Array.isArray(u) ? u : []; }

  function currentUser() {
    const s = readJSON(SESSION_KEY, null);
    if (!s || typeof s.userId !== 'string') return null;
    const u = getUsers().find(x => x.id === s.userId);
    return u ? { id: u.id, username: u.username, name: u.name } : null;
  }

  /* ---------------- password hashing ---------------- */

  const toHex = buf => Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');
  const fromHex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));

  async function hashPassword(password, saltHex, iterations) {
    if (!root.crypto || !root.crypto.subtle) throw new Error('This browser blocks secure password hashing here. Open the app over https or localhost.');
    const key = await root.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await root.crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256);
    return toHex(bits);
  }

  /** True when no account exists yet and pre-account data is waiting to be adopted. */
  function hasUnclaimedLegacyData() {
    if (root.localStorage.getItem(LEGACY_CLAIMED_KEY)) return false;
    return LEGACY_KEYS.some(k => root.localStorage.getItem(k) !== null);
  }

  /** Copies pre-account data into the new user's namespace. Originals are left untouched as a safety copy. */
  function adoptLegacyData(userId) {
    if (!hasUnclaimedLegacyData()) return false;
    LEGACY_KEYS.forEach(k => {
      const v = root.localStorage.getItem(k);
      if (v !== null) root.localStorage.setItem(userKey(userId, k), v);
    });
    root.localStorage.setItem(LEGACY_CLAIMED_KEY, userId);
    return true;
  }

  /* ---------------- account actions ---------------- */

  async function signUp(username, password, displayName, email) {
    const users = getUsers();
    const err = validateSignup(username, password, users, email);
    if (err) throw new Error(err);
    const salt = toHex(root.crypto.getRandomValues(new Uint8Array(16)));
    const user = {
      id: newId(), username: normalizeUsername(username),
      email: email === undefined ? '' : normalizeUsername(email),
      name: String(displayName || '').trim().slice(0, 40) || normalizeUsername(username),
      salt, iterations: PBKDF2_ITERATIONS, hash: await hashPassword(password, salt, PBKDF2_ITERATIONS),
      created: new Date().toISOString(),
    };
    // Adopt first, so a storage failure leaves no account behind with missing data.
    adoptLegacyData(user.id);
    users.push(user);
    writeJSON(USERS_KEY, users);
    writeJSON(SESSION_KEY, { userId: user.id });
    return { id: user.id, username: user.username, name: user.name };
  }

  async function signIn(username, password) {
    // The sign-in field accepts either the username or the email the account was created with.
    const id = normalizeUsername(username);
    const u = getUsers().find(x => x.username === id || (x.email && x.email === id));
    // Hash even for unknown names so timing does not reveal which usernames exist.
    const salt = u ? u.salt : '00'.repeat(16);
    const hash = await hashPassword(password, salt, u ? u.iterations : PBKDF2_ITERATIONS);
    if (!u || hash !== u.hash) throw new Error('Wrong username or password');
    writeJSON(SESSION_KEY, { userId: u.id });
    return { id: u.id, username: u.username, name: u.name };
  }

  /** Local profile used when nobody has signed in (the app has no sign-in screen). Adopts pre-account data once. */
  function guestUser() {
    adoptLegacyData('guest');
    return { id: 'guest', username: 'guest', name: '' };
  }

  function signOut() { try { root.localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  const api = {
    SESSION_KEY, USERS_KEY, LEGACY_KEYS,
    normalizeUsername, validateSignup, userKey,
    getUsers, currentUser, guestUser, signUp, signIn, signOut, hasUnclaimedLegacyData,
  };
  root.TD_AUTH = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
