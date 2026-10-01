process.env.TZ = 'Asia/Kolkata';
const test = require('node:test');
const assert = require('node:assert/strict');
const TD = require('../core.js');

test('toISODate uses local time, not UTC (IST early morning)', () => {
  const d = new Date(2026, 9, 1, 1, 30); // 1 Oct 2026, 01:30 IST = 30 Sep 20:00 UTC
  assert.equal(TD.toISODate(d), '2026-10-01');
  assert.equal(d.toISOString().slice(0, 10), '2026-09-30'); // the bug the old code had
});

test('addMonthsISO moves exactly one month and does not drift a day', () => {
  assert.equal(TD.addMonthsISO('2026-10-01', 1), '2026-11-01');
  assert.equal(TD.addMonthsISO('2026-11-01', 1), '2026-12-01');
  assert.equal(TD.addMonthsISO('2026-12-15', 1), '2027-01-15');
});

test('addMonthsISO clamps to month end', () => {
  assert.equal(TD.addMonthsISO('2026-01-31', 1), '2026-02-28');
  assert.equal(TD.addMonthsISO('2028-01-31', 1), '2028-02-29');
  assert.equal(TD.addMonthsISO('2026-03-31', 1), '2026-04-30');
});

test('addMonths shifts year-month keys', () => {
  assert.equal(TD.addMonths('2026-01', -1), '2025-12');
  assert.equal(TD.addMonths('2026-11', 3), '2027-02');
});

test('isValidISODate rejects impossible dates', () => {
  assert.equal(TD.isValidISODate('2026-02-30'), false);
  assert.equal(TD.isValidISODate('2026-13-01'), false);
  assert.equal(TD.isValidISODate('26-01-01'), false);
  assert.equal(TD.isValidISODate('2028-02-29'), true);
});

test('escapeHtml escapes markup characters', () => {
  assert.equal(TD.escapeHtml('<img src=x onerror="a()">&\''), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;');
});

test('csvEscape quotes special characters and neutralises formulas', () => {
  assert.equal(TD.csvEscape('a,b'), '"a,b"');
  assert.equal(TD.csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(TD.csvEscape('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(TD.csvEscape('-5 off'), "'-5 off");
  assert.equal(TD.csvEscape('plain'), 'plain');
});

test('parseCSV handles quotes, embedded commas, newlines, BOM and CRLF', () => {
  const rows = TD.parseCSV('﻿a,b\r\n"x, y","line1\nline2"\r\n"q""uote",z\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'line1\nline2'], ['q"uote', 'z']]);
});

const CATS = [
  { id: 'food', label: 'Food & Dining' },
  { id: 'other_expense', label: 'Other Expense' },
  { id: 'other_income', label: 'Other Income' },
];
let n = 0;
const makeId = () => 'id' + ++n;

test('export then import round-trips, including notes with newlines and formula-like text', () => {
  const tx = [
    { description: '=cmd', amount: 120.5, type: 'expense', category: 'food', date: '2026-10-01', tags: ['a', 'b'], notes: 'line1\nline2, "q"' },
    { description: 'Salary', amount: 5000, type: 'income', category: 'other_income', date: '2026-10-02', tags: [], notes: '' },
  ];
  const csv = TD.buildCSV(tx, id => CATS.find(c => c.id === id).label);
  const res = TD.importTransactions(csv, CATS, [], makeId);
  assert.equal(res.added.length, 2);
  assert.equal(res.added[0].description, '=cmd');
  assert.equal(res.added[0].notes, 'line1\nline2, "q"');
  assert.deepEqual(res.added[0].tags, ['a', 'b']);
  assert.equal(res.added[0].category, 'food');
  assert.equal(res.added[1].type, 'income');
});

test('import skips invalid rows and duplicates', () => {
  const csv = [
    'Description,Amount,Type,Category,Date,Tags,Notes',
    'Tea,20,expense,Food & Dining,2026-10-01,,',
    'Tea,20,expense,Food & Dining,2026-10-01,,',
    'Bad date,20,expense,Food & Dining,2026-02-30,,',
    'No amount,,expense,Food & Dining,2026-10-01,,',
    'Negative,-5,expense,Food & Dining,2026-10-01,,',
    'Unknown cat,10,expense,Nope,2026-10-03,,',
  ].join('\n');
  const existing = [{ description: 'Unknown cat', amount: 10, type: 'expense', date: '2026-10-03' }];
  const res = TD.importTransactions(csv, CATS, existing, makeId);
  assert.equal(res.added.length, 1);
  assert.equal(res.duplicates, 2);
  assert.equal(res.invalid, 3);
});

test('import maps unknown categories to Other Expense / Other Income', () => {
  const csv = 'D,A,T,C,Dt,Tg,N\nX,5,income,Mystery,2026-10-01,,\nY,5,expense,Mystery,2026-10-01,,';
  const res = TD.importTransactions(csv, CATS, [], makeId);
  assert.equal(res.added[0].category, 'other_income');
  assert.equal(res.added[1].category, 'other_expense');
});

test('accountBalance adds income and subtracts expenses for tagged transactions only', () => {
  const acc = { id: 'a1', type: 'bank', balance: 1000 };
  const tx = [
    { accountId: 'a1', type: 'income', amount: 500 },
    { accountId: 'a1', type: 'expense', amount: 200.25 },
    { accountId: 'other', type: 'expense', amount: 999 },
    { accountId: null, type: 'expense', amount: 999 },
  ];
  assert.equal(TD.accountBalance(acc, tx), 1299.75);
});

test('accountBalance leaves liabilities at their opening balance', () => {
  assert.equal(TD.accountBalance({ id: 'l1', type: 'liability', balance: 50000 }, [{ accountId: 'l1', type: 'expense', amount: 10 }]), 50000);
});

test('dueOccurrences returns every missed month and the next future date', () => {
  const r = TD.dueOccurrences({ nextDate: '2026-07-31' }, '2026-10-15');
  assert.deepEqual(r.dates, ['2026-07-31', '2026-08-31', '2026-09-30', ]);
  assert.equal(r.nextDate, '2026-10-31');
});

test('dueOccurrences returns nothing when not yet due', () => {
  const r = TD.dueOccurrences({ nextDate: '2026-11-01' }, '2026-10-15');
  assert.deepEqual(r.dates, []);
  assert.equal(r.nextDate, '2026-11-01');
});

test('spentByCategory totals expenses for one month only', () => {
  const tx = [
    { type: 'expense', category: 'food', amount: 10, date: '2026-10-01' },
    { type: 'expense', category: 'food', amount: 5, date: '2026-10-20' },
    { type: 'expense', category: 'food', amount: 99, date: '2026-09-30' },
    { type: 'income', category: 'food', amount: 99, date: '2026-10-05' },
  ];
  assert.deepEqual(TD.spentByCategory(tx, '2026-10'), { food: 15 });
});

test('daysSince', () => {
  const now = Date.parse('2026-10-31T00:00:00Z');
  assert.equal(TD.daysSince('2026-10-01T00:00:00Z', now), 30);
  assert.equal(TD.daysSince(null, now), Infinity);
  assert.equal(TD.daysSince('garbage', now), Infinity);
});

test('validateBackup accepts a well-formed backup and rejects malformed ones', () => {
  const good = { app: 'track-daily', version: 1, transactions: [{ id: 'a', description: 'x', type: 'expense', amount: 5, date: '2026-10-01' }],
    accounts: [{ id: 'ac', name: 'Cash' }], recurring: [{ id: 'r', nextDate: '2026-11-01', amount: 10 }], budgets: {}, customCategories: [{ id: 'c', label: 'Bus' }] };
  assert.equal(TD.validateBackup(good), true);
  assert.equal(TD.validateBackup(null), false);
  assert.equal(TD.validateBackup({ ...good, app: 'other' }), false);
  assert.equal(TD.validateBackup({ ...good, budgets: [] }), false);
  assert.equal(TD.validateBackup({ ...good, transactions: [{ ...good.transactions[0], date: '2026-02-30' }] }), false);
  assert.equal(TD.validateBackup({ ...good, transactions: [{ ...good.transactions[0], amount: -1 }] }), false);
  assert.equal(TD.validateBackup({ ...good, transactions: [{ ...good.transactions[0], type: 'transfer' }] }), false);
});
