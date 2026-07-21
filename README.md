# Sift

My little financial friend — a sleek, dark-mode web app for manually categorizing bank transactions.

Paste/upload a bank CSV export, step through each transaction assigning it to a category, watch running totals build, and get a copy-ready summary for your spreadsheet. Sift **remembers** which merchants go in which categories and auto-fills them next time.

## Features

- **CSV import** — upload one or more `.csv` files at once (e.g. separate credit- and debit-card exports) or paste raw CSV text. Multiple files are merged into a single session; leading title/filter lines are skipped and the header row is auto-detected per file.
- **Smart cleanup** — the noisy bank `Memo` field (dates, reference numbers, MCC codes, URLs) is cleaned into a readable merchant name.
- **Learned auto-categorization** — once you categorize a merchant, Sift fuzzy-matches future transactions from the same merchant and pre-fills the category (works within the same file and across future imports).
- **Editable categories** — add, rename, recolor, and delete categories on the fly.
- **Live running totals** — per-category spend updates as you go.
- **Ignore transactions** — mark credit-card payments, transfers, and other noise as *Ignored*: still tracked and (optionally) remembered for auto-ignoring next time, but excluded from all summary totals.
- **Debit/credit aware** — spending and deposits are tracked and summarized separately.
- **Copy-ready summary** — copy category totals as tab-separated values, straight into your spreadsheet.
- **Keyboard shortcuts** — press `1`–`9` to assign a category, `0` to ignore, `←`/`→` to navigate.
- **Persistent** — categories, learned mappings, and in-progress sessions are stored in `localStorage`. No backend, no data leaves your browser.

## Expected CSV format

Header row (title/filter lines above it are skipped):

```
Transaction Number,Date,Description,Memo,Amount Debit,Amount Credit,Balance,Check Number
```

Columns are matched **by header name**, so exports with extra trailing columns work too — e.g. the credit-card format with `…,Check Number,Fees,Principal,Interest`. Any unrecognized columns are ignored; only the amount **spent** (`Amount Debit`) is tracked.

- **Memo** holds the real merchant info and is used for display + matching.
- **Amount Debit** is spending (negative); **Amount Credit** is deposits/refunds. Each row uses one column. `Fees` / `Principal` / `Interest` and any other extra columns are ignored.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS v4. No backend.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
```

## Data & privacy

Everything runs client-side. Your categories, learned merchant→category mappings, and current session live in the browser's `localStorage` only.
