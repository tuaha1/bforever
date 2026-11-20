# Bforever

This repo holds everything Claude knows about **Bforever**, Ammi's couture
business in Vaniyambadi. It also sets up Claude as her Urdu-speaking business
companion.

- `CLAUDE.md` sets out how Claude behaves with her: Urdu only, a warm feminine
  voice, one question at a time, starting with the business numbers.
- **Receipts:** whenever she makes a sale, she tells Claude the details in
  Urdu. Claude makes a receipt image (`tools/receipt/`; see
  `tools/receipt/sample.png`), she sends it to the customer on WhatsApp, and
  the sale goes into `business/sales/` (customers, orders, payments).
  `node tools/sales-report.js` shows pending balances and monthly sales.
- `business/` holds what she has told Claude so far: profile, team, finances,
  progress checklist and a log of each conversation. Claude writes these files
  in English so you can review them.

## How she uses it

1. Install the Claude app on her phone and sign in.
2. Open a Claude Code session on this repository (`tuaha1/bforever`).
3. She types (or uses Urdu voice typing on her keyboard) in Urdu. Claude
   introduces itself and starts with Phase 1: the numbers.

## Keep this repo private

It will hold real business and salary figures.
