# Bookkeeping / Transactions

Bank transaction categorization lives under **Transactions** at `/transactions?tab=bank` (not a separate nav item).

## Related routes

| Legacy URL | Redirects to |
|------------|--------------|
| `/bookkeeping` | `/transactions?tab=bank` |
| `/income` | `/transactions?tab=hospitable` |
| `/expenses` | `/transactions?tab=manual` |

Legacy redirects remain for bookmarks; they are not in the sidebar.

## Key modules

- `components/bookkeeping/` — transaction table, categorization UI, reservation matching
- `lib/bookkeepingCategories.js` — category taxonomy
- `lib/bookkeepingClient.js` — client-side edit/exclude helpers
- `pages/api/bank/` — Plaid link, sync, transaction CRUD

## Database

Run these in Supabase SQL editor if not already applied:

- `supabase/migrations/20260606_bank_transaction_categorization.sql`
- `supabase/migrations/20260607_bank_transaction_reservation_match.sql`

## Data source

Uses Plaid-imported rows in `bank_transactions`. Connect and sync from **Transactions → Bank** tab.
