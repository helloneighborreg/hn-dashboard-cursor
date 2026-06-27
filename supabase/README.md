# Supabase setup

## 1. Create project

1. [supabase.com](https://supabase.com) → **New project**
2. Save the database password somewhere safe

## 2. Run schema

1. Project → **SQL Editor** → **New query**
2. Paste contents of `schema.sql` → **Run**

### Later schema changes (migrations)

Files under `supabase/migrations/` are **not** applied when you deploy the app. Each time the app needs new columns, run the matching `.sql` file manually:

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor** → **New query**
2. Open the migration file in this repo (e.g. `migrations/20260604_task_checkin.sql`), copy all of it, paste into the editor
3. Click **Run** (you should see “Success”)
4. Locally: `npm run db:check` — it will confirm columns like `checkin_date` exist

| Migration | What it adds |
|-----------|----------------|
| `20260604_task_checkin.sql` | `checkin_date`, `checkin_time` on `tasks` (Hospitable check-in + change notifications) |
| `20260605_task_hospitable_id.sql` | `hospitable_reservation_id` — match tasks when checkout date changes |
| `20260524_bank_transactions.sql` | `bank_connection` + `bank_transactions` (Plaid import) |
| `20260606_bank_transaction_categorization.sql` | `reviewed`, `hidden`, `notes` on bank transactions (Bookkeeping tab) |
| `20260624_task_timeline.sql` | `assigned_at`, `started_at`, `completed_at` on `tasks` (task detail timeline) |
| `20260704_task_payment.sql` | `scheduled_by`, `paid_at`, `paid_by` on `tasks`; migrates `under_review` → `completed` |
| `20260705_billpay_invoices.sql` | `billpay_invoices` — cleaning invoices queued when tasks are marked paid |
| `20260715_task_overdue_notified.sql` | `overdue_notified_at` on `tasks` — one overdue email/push per task |
| `20260627_task_archived.sql` | `archived_at` on `tasks` — hide tasks older than 30 days from dashboard/lists |

## 3. API keys

Project → **Settings** → **API**:

| Key | Use in app |
|-----|------------|
| **Project URL** | `SUPABASE_URL` |
| **service_role** (secret) | `SUPABASE_SERVICE_ROLE_KEY` |

**Important:** `SUPABASE_URL` must look like `https://abcdefghijklmnop.supabase.co` — copy **Project URL** from the API settings page. Do **not** paste the `supabase.com/dashboard/project/...` link from your browser.

Never commit or expose the service role key in the browser. It is only used in Next.js API routes (server-side).

## 4. Environment variables

Add to `env.local` (or Cloudflare Worker secrets):

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

## 5. Import existing data (optional)

If you have tasks/expenses in `data/db.json`:

```bash
node scripts/import-db-json.mjs
```

## Task assignment notifications (optional)

When an assignee is set on a task, the app emails and/or texts them. The same contacts are also notified when **booking details change** on their assigned task (checkout/check-in times, guest, pets, etc.), including after syncing from Hospitable.

```env
# Email/phone on dashboard users (recommended)
DASHBOARD_USERS=[{"username":"brandi","name":"Brandi Drieslein","role":"cleaner","password":"...","email":"brandi@example.com","phone":"+15551234567"}]

# Or a separate contact map (must match assignee dropdown names exactly)
TASK_ASSIGNEE_CONTACTS={"Rachel Jackson":{"email":"rachel@example.com","phone":"+15551234567"}}

# Email via Resend (https://resend.com)
RESEND_API_KEY=re_...
TASK_NOTIFY_FROM_EMAIL=tasks@yourdomain.com

# SMS via Twilio (optional)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+15551234567
```

If these are not set, assignment still works; notifications are skipped with a server log warning.

When a task is marked **completed** (admin button) or a cleaner **submits the in-app checklist**, the app emails configured recipients with a link to the checklist.

When a linked **booking changes** (checkout/due dates, guest, pets, etc.), one email goes to **all recipients on the same To: line** — the assignee (if any) plus admin emails. Unassigned tasks email admins only. SMS (optional) still goes to the assignee’s phone only.

When an **assigned task is not completed by its due date and time**, the app emails the assignee and admins (same To: line), texts the assignee (if configured), and sends web push to both. A separate cron runs every 15 minutes (`/api/tasks/overdue-notify-cron`); each task is notified at most once until the due schedule or assignee changes.

```env
# Who receives completion and task-change emails (comma-separated).
# Defaults to admin emails on DASHBOARD_USERS.
TASK_COMPLETION_NOTIFY_EMAIL=you@example.com
# Optional override for change emails only (otherwise same as above)
TASK_CHANGE_NOTIFY_EMAIL=you@example.com
```

## In-app turn clean checklist

CJC properties use the built-in checklist at `/forms/cjc-turn-clean-checklist`. The **Open Checklist** button on each task pre-fills guest, property, reservation, task ID, checkout date, and assignee via URL parameters.

### URL parameter map (`env.local`)

Optional — rename query params if you change the form schema:

```env
CHECKLIST_URL_PARAM_MAP={"property":"Property","guest":"Guest","reservation_id":"ReservationID","checkout_date":"CheckOut","task_id":"TaskID","assignee":"assignee"}
```

`CHECKLIST_URL_PARAM_MAP` is still accepted as a legacy alias. `FILLOUT_URL_PARAM_MAP` is an older alias for the same setting.

Fillout (`FILLOUT_*` env vars) is legacy — CJC properties use the in-app checklist above. Fillout is only needed for properties not mapped in `lib/propertyChecklists.js`.

Parameters sent from Tasks:

| Internal field | URL param (default map) |
|----------------|-------------------------|
| `property` | Property code (e.g. CJC8303) |
| `guest` | Guest name |
| `reservation_id` | Booking code (e.g. HM9CABAAY9) |
| `task_id` | Internal task UUID |
| `checkout_date` | Checkout date |
| `assignee` | Assignee name, if set |

### On submit

When a cleaner submits the checklist, the app:

- Saves answers and photos to `form_submissions` (Supabase + storage bucket)
- Moves the linked task to **Completed** (`completed`)
- Sets `checklist_submission_url` to the in-app submission view
- Emails admins that a checklist was submitted

Run migrations `supabase/migrations/20260625_form_submissions.sql`, `supabase/migrations/20260629_form_submission_permissions.sql`, and `supabase/migrations/20260630_checklist_section_examples.sql` for checklist storage and shared section example photos.

Property → checklist mapping is in `lib/propertyChecklists.js` (CJC units only today).

**Status dot colors:** red = overdue, orange = hold, yellow = assigned, green = completed.

## 7. Deploy

The app runs on **Cloudflare Workers** (OpenNext), not Vercel. See **`docs/CLOUDFLARE.md`** for build/deploy commands and the full env checklist.

```bash
npm run deploy:cloudflare
```

Always deploy with `--keep-vars` (included in that script) so dashboard secrets are not wiped.
