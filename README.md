# Track Daily — Personal Finance Tracker

An offline-first personal finance tracker: transactions, accounts, budgets,
recurring entries and spending insights. Plain HTML, Tailwind CSS (CDN),
vanilla JavaScript and Chart.js. No build step, no API keys, and no backend
unless you opt in to cloud backup.

It installs as an app on phones and desktops (PWA) and works offline after the
first visit. Below 1024px it is a single-column mobile app with a bottom nav;
at 1024px and above it switches to a desktop layout — a left sidebar, a
dashboard on Overview (recent transactions + top spending) and a sticky
summary rail beside the transaction list.

## Features

- **Overview** — total balance, income, expenses and net savings for the
  current month, each with a month-over-month trend, plus a backup reminder
- **Wealth** — net worth across cash, bank, asset and liability accounts.
  Cash/bank/asset balances include the income and expenses you tag to them
  (opening balance + income − expenses); liabilities stay at their opening balance
- **Money**
  - **Transactions** — add/edit/delete, filter by type/category, search,
    month navigation
  - **Accounts** — manage the accounts transactions can be tagged to
  - **Budget** — per-category monthly budgets with **spent-vs-budget progress
    bars**, auto-suggest (from your last 3 months) and copy-from-last-month.
    Changes save automatically
  - **Insights** — category breakdown donut and 6-month income vs. expense trend
  - **Recurring** — monthly templates with a due-reminder banner. "Review &
    generate" creates **every** missed month, not just the latest
- **More** — light/dark theme, custom categories, CSV export/import, full JSON
  backup/restore, optional cloud backup, reset
- **Installable & offline** — web app manifest and a service worker

## Your data

All data lives in the browser's `localStorage`; nothing is sent anywhere unless
you enable cloud backup. That means:

- Data is per browser/device and is erased if you clear site data
- **Back up regularly.** *More → Back up everything (JSON)* saves transactions,
  accounts, budgets, recurring templates and custom categories. *Restore from
  backup* replaces everything with a validated backup file. The Overview page
  reminds you after 30 days without a backup (snooze for 7 days)
- *Export CSV* saves transactions only. Import skips exact duplicates
  (same date, type, amount and description) and invalid rows, and understands
  notes containing commas, quotes and line breaks. Exported text cells that
  start with `=`, `+`, `-` or `@` are prefixed with `'` so spreadsheets don't
  run them as formulas

### Optional cloud backup

Off by default. To turn it on:

1. Create a free [Supabase](https://supabase.com) project and enable the Email provider.
2. Run `supabase/schema.sql` in the SQL editor (one table, one row per user,
   row-level security).
3. Put your project URL and anon (public) key in `config.js`.

*More → Cloud backup* then lets you sign in and upload or restore a full
backup. It's manual (no automatic background sync), and restoring replaces the
local data after a confirmation. This feature needs a configured Supabase
project to work, so test it with your own project before relying on it.

## Tech stack

- Plain HTML + vanilla JavaScript (no framework, no bundler)
- [Tailwind CSS](https://tailwindcss.com) Play CDN; [Chart.js](https://www.chartjs.org/) is bundled in `vendor/` (the previous CDN URL 404s, which left the charts blank)
- `core.js` — pure logic (dates, CSV, balances, recurring, backup validation), unit tested
- `sw.js` + `manifest.webmanifest` — offline support and installability
- `localStorage` for persistence

## Project structure

```
index.html            App UI and wiring
core.js               Pure, tested logic (window.TD / module.exports)
config.js             Optional settings (cloud backup)
vendor/chart.umd.js   Chart.js 4.4.4 (bundled, MIT)
sw.js                 Service worker (bump CACHE when shipping changes)
manifest.webmanifest  PWA manifest
icon.svg              App icon
supabase/schema.sql   Optional cloud backup table
tests/core.test.js    Unit tests (node --test)
netlify.toml          Static deploy config and headers
```

## Getting started

It's a static site — nothing to install or build. Serve the folder (service
workers need `http://localhost` or HTTPS, so opening the file directly works
but without offline install):

```bash
npx serve .
# or
python3 -m http.server 8000
```

### Tests

```bash
npm test      # unit tests for core.js (Node 18+)
```

### Deploying to Netlify

- **Continuous (recommended):** Site dashboard → **Project configuration →
  Build & deploy → Link repository** → select this repo. `netlify.toml`
  publishes the root with no build step and sets cache headers so updates
  reach installed copies.
- **One-off:** drag the project folder (not just `index.html` — the app also
  needs `core.js`, `config.js`, `sw.js`, `manifest.webmanifest` and `icon.svg`)
  onto the Deploys tab.

Any static host works (GitHub Pages, Vercel, S3, …).

## Notes on naming

The app was previously called "Vantage" internally. Its `localStorage` keys
still start with `vantage_` on purpose, so existing users keep their data.

## Customizing

- **Currency:** amounts are formatted as INR (`₹`, Indian digit grouping) via
  `fmtMoney` in `index.html`.
- **Categories/colors:** the default list is `BASE_CATS` near the top of the
  main `<script>` block.

## License

MIT — see [LICENSE](./LICENSE).
