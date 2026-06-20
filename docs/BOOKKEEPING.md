# Bookkeeping tab (experimental)

Baselane-style transaction categorization UI at `/bookkeeping`.

## Remove this feature

1. Delete `pages/bookkeeping.js`
2. Delete `components/bookkeeping/`
3. Delete `lib/bookkeepingCategories.js` and `lib/bookkeepingClient.js`
4. Remove the `/bookkeeping` nav line from `lib/roles.js` and `/bookkeeping` from `NAV_ICONS` in `components/Layout.js`
5. Optionally revert API/DB changes if you no longer need `reviewed`, `hidden`, `notes` on `bank_transactions`

## Database

Run migration `supabase/migrations/20260606_bank_transaction_categorization.sql` in Supabase SQL editor if not applied via CLI.

## Data source

Uses Plaid-imported rows in `bank_transactions`. Connect/sync from **Income** → Bank feed, then categorize here.
