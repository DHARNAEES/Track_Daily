/* Track Daily — pure logic (dates, CSV, balances, recurring). No DOM access, so it can be unit tested with Node. */
(function (root) {
  'use strict';

  const pad = n => String(n).padStart(2, '0');

  /** Local-time YYYY-MM-DD (toISOString() would use UTC and be a day off in timezones like IST). */
  function toISODate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function todayISO() { return toISODate(new Date()); }

  function isValidISODate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  /** 'YYYY-MM' shifted by delta months. */
  function addMonths(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  /** Shifts a YYYY-MM-DD by n months, clamping to the last day (Jan 31 + 1 month = Feb 28/29, not Mar 3). */
  function addMonthsISO(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const target = new Date(y, m - 1 + n, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return target.getFullYear() + '-' + pad(target.getMonth() + 1) + '-' + pad(Math.min(d, lastDay));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------------- CSV ---------------- */

  /** Neutralise spreadsheet formula injection (=, +, -, @, tab, CR at the start of a text cell). */
  function csvEscape(value) {
    let s = String(value == null ? '' : value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  const CSV_HEADER = ['Description', 'Amount', 'Type', 'Category', 'Date', 'Tags', 'Notes'];

  function buildCSV(transactions, categoryLabel) {
    const rows = transactions.map(t => [
      csvEscape(t.description), t.amount, t.type, csvEscape(categoryLabel(t.category)),
      t.date, csvEscape((t.tags || []).join('|')), csvEscape(t.notes || ''),
    ]);
    return [CSV_HEADER.join(',')].concat(rows.map(r => r.join(','))).join('\n');
  }

  /** RFC 4180-style parser: quoted fields may contain commas, quotes and newlines. Returns an array of rows. */
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], cur = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some(v => v.trim() !== '')) rows.push(row);
        row = [];
      } else cur += c;
    }
    row.push(cur);
    if (row.some(v => v.trim() !== '')) rows.push(row);
    return rows;
  }

  /** Undo the leading apostrophe csvEscape adds, so export -> import round-trips. */
  function unescapeCell(s) {
    return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
  }

  function txKey(t) {
    return [t.date, t.type, Number(t.amount).toFixed(2), String(t.description).trim().toLowerCase()].join('|');
  }

  /**
   * Turns CSV text into transactions. Skips invalid rows and exact duplicates of existing
   * transactions (same date, type, amount and description), including duplicates within the file.
   */
  function importTransactions(text, categories, existing, makeId) {
    const rows = parseCSV(text);
    const result = { added: [], invalid: 0, duplicates: 0 };
    if (rows.length < 2) return result;
    const seen = new Set((existing || []).map(txKey));
    rows.slice(1).forEach(r => {
      const description = unescapeCell((r[0] || '').trim());
      const amt = parseFloat(String(r[1] || '').replace(/,/g, ''));
      const date = (r[4] || '').trim();
      if (!description || !(amt > 0) || !isValidISODate(date)) { result.invalid++; return; }
      const type = (r[2] || '').trim().toLowerCase() === 'income' ? 'income' : 'expense';
      const label = unescapeCell((r[3] || '').trim()).toLowerCase();
      const match = categories.find(c => c.label.toLowerCase() === label);
      const category = match ? match.id : (type === 'income' ? 'other_income' : 'other_expense');
      const tx = {
        id: makeId(), description, amount: amt, type, category, date,
        tags: (r[5] || '').split('|').map(s => unescapeCell(s.trim())).filter(Boolean),
        notes: unescapeCell((r[6] || '').trim()),
      };
      const key = txKey(tx);
      if (seen.has(key)) { result.duplicates++; return; }
      seen.add(key);
      result.added.push(tx);
    });
    return result;
  }

  /* ---------------- Accounts ---------------- */

  /** Cash/bank/asset accounts: opening balance + income - expense of transactions tagged to the account. Liabilities stay at their opening balance. */
  function accountBalance(account, transactions) {
    const opening = Number(account.balance) || 0;
    if (account.type === 'liability') return opening;
    let net = 0;
    transactions.forEach(t => {
      if (t.accountId !== account.id) return;
      net += t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0;
    });
    return Math.round((opening + net) * 100) / 100;
  }

  /* ---------------- Recurring ---------------- */

  /** Every occurrence of a monthly template that is due on or before `today` (so months the app wasn't opened aren't skipped). */
  function dueOccurrences(template, today) {
    const dates = [];
    let next = template.nextDate;
    let guard = 0;
    while (next <= today && guard++ < 120) {
      dates.push(next);
      next = addMonthsISO(template.nextDate, dates.length);
    }
    return { dates, nextDate: next };
  }

  /* ---------------- Budgets / backup ---------------- */

  function spentByCategory(transactions, ym) {
    const out = {};
    transactions.forEach(t => {
      if (t.type === 'expense' && t.date.slice(0, 7) === ym) out[t.category] = (out[t.category] || 0) + t.amount;
    });
    return out;
  }

  function daysSince(iso, now) {
    if (!iso) return Infinity;
    const t = Date.parse(iso);
    if (isNaN(t)) return Infinity;
    return Math.floor(((now || Date.now()) - t) / 86400000);
  }

  /** Structural check for a Track Daily JSON backup before it is allowed to replace local data. */
  function validateBackup(b) {
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
    if (!isObj(b) || b.app !== 'track-daily') return false;
    if (!Array.isArray(b.transactions) || !Array.isArray(b.accounts) || !Array.isArray(b.recurring) || !Array.isArray(b.customCategories) || !isObj(b.budgets)) return false;
    return b.transactions.every(t => isObj(t) && typeof t.id === 'string' && typeof t.description === 'string' &&
      (t.type === 'income' || t.type === 'expense') && Number(t.amount) > 0 && typeof t.date === 'string' && isValidISODate(t.date)) &&
      b.accounts.every(a => isObj(a) && typeof a.id === 'string' && typeof a.name === 'string') &&
      b.recurring.every(r => isObj(r) && typeof r.id === 'string' && typeof r.nextDate === 'string' && isValidISODate(r.nextDate) && Number(r.amount) > 0) &&
      b.customCategories.every(k => isObj(k) && typeof k.id === 'string' && typeof k.label === 'string');
  }

  const api = {
    toISODate, todayISO, isValidISODate, addMonths, addMonthsISO, escapeHtml,
    csvEscape, buildCSV, parseCSV, importTransactions, accountBalance, dueOccurrences,
    spentByCategory, daysSince, validateBackup,
  };
  root.TD = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
