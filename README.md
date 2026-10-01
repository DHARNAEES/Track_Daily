# Track Daily — Personal Finance Tracker

A single-file, offline-first personal finance tracker: transactions, accounts,
budgets, recurring entries, and spending insights — built with HTML, Tailwind
CSS, vanilla JavaScript, and Chart.js. No backend, no build step, no API keys.

Internally the app identifies itself as **Vantage** (page title / header
logo) — "Track Daily" is this project's repo/deployment name. Rename either
one to match if you'd like them consistent; see [Customizing](#customizing)
below.

## Features

- **Overview** — total balance, income, expenses, and net savings for the
  current month, each with a month-over-month trend
- **Wealth** — net worth summary across cash, bank, asset, and liability
  accounts you add
- **Money**
  - **Transactions** — add/edit/delete, filter by type/category, search,
    month navigation
  - **Accounts** — manage the accounts transactions can be tagged to
  - **Budget** — per-category monthly budgets, with auto-suggest (based on
    your last 3 months of spending) and copy-from-last-month
  - **Insights** — category breakdown donut chart and a 6-month income vs.
    expense trend chart
  - **Recurring** — recurring transaction templates with a due-reminder
    banner and one-tap "generate" into real transactions
- **More** — light/dark theme, custom categories, CSV export/import, reset
- CSV export/import, so your data isn't locked into the browser

## Tech stack

- Plain HTML + vanilla JavaScript (no framework, no bundler)
- [Tailwind CSS](https://tailwindcss.com) via the Play CDN
- [Chart.js](https://www.chartjs.org/) via CDN
- `localStorage` for all data persistence — nothing leaves the browser

## Getting started

This is a static site — there's nothing to install or build.

**Locally:** just open `index.html` in a browser, or serve the folder with
any static file server, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8000
```

**Deploying:** any static host works (Netlify, GitHub Pages, Vercel, S3,
etc.) — point it at this repo's root with no build command.

### Deploying to Netlify

- **One-off / manual:** Site dashboard → **Deploys** tab → drag `index.html`
  onto the upload area. Re-upload any time you change the file.
- **Continuous (recommended):** Site dashboard → **Project configuration →
  Build & deploy → Link repository** → select this repo → authorize GitHub
  when prompted. `netlify.toml` in this repo already tells Netlify to
  publish the root with no build step, so no further config is needed —
  every push to the linked branch deploys automatically.

## Data & privacy

All data (transactions, accounts, budgets, recurring templates, custom
categories, theme preference) is stored in the browser's `localStorage` —
there is no server and nothing is transmitted anywhere. This also means:

- Data is per-browser/per-device — it won't sync across devices or browsers
  on its own
- Clearing site data/cookies for the deployed domain erases it
- Use **More → Export CSV** periodically if you want a portable backup, and
  **Import CSV** to bring it into another browser/device

## Customizing

- **App name:** the title tag and sidebar/header logo both say "Vantage" —
  search `index.html` for `Vantage` to rename.
- **Currency:** amounts are formatted as INR (`₹`, Indian digit grouping) via
  the `fmtMoney` function — update that function and the `₹` literals to
  change currency.
- **Categories/colors:** the default category list (icon, color, label) is
  defined in the `BASE_CATS` array near the top of the `<script>` block.

## License

MIT — see [LICENSE](./LICENSE).
