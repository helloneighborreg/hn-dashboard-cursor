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
| `20260607_bank_transaction_reservation_match.sql` | `matched_reservation_id`, `matched_payout_amount` — link bank deposits to Hospitable payouts |

## 3. API keys

Project → **Settings** → **API**:

| Key | Use in app |
|-----|------------|
| **Project URL** | `SUPABASE_URL` |
| **service_role** (secret) | `SUPABASE_SERVICE_ROLE_KEY` |

**Important:** `SUPABASE_URL` must look like `https://abcdefghijklmnop.supabase.co` — copy **Project URL** from the API settings page. Do **not** paste the `supabase.com/dashboard/project/...` link from your browser.

Never commit or expose the service role key in the browser. It is only used in Next.js API routes (server-side).

## 4. Environment variables

Add to `env.local` (or Vercel):

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

When a task is marked **completed** (admin button or Fillout webhook), the app emails configured recipients with a link to the checklist (and PDF when available).

When a linked **booking changes** (checkout/due dates, guest, pets, etc.), one email goes to **all recipients on the same To: line** — the assignee (if any) plus admin emails. Unassigned tasks email admins only. SMS (optional) still goes to the assignee’s phone only.

```env
# Who receives completion and task-change emails (comma-separated).
# Defaults to admin emails on DASHBOARD_USERS.
TASK_COMPLETION_NOTIFY_EMAIL=you@example.com
# Optional override for change emails only (otherwise same as above)
TASK_CHANGE_NOTIFY_EMAIL=you@example.com
```

## Fillout checklist (recommended)

The **Open Checklist** button builds a Fillout URL with task details as query parameters.

### 1. Form link (`env.local`)

```env
# Your Fillout form URL (from Share → Link)
FILLOUT_CHECKLIST_BASE_URL=https://forms.fillout.com/t/your-form-id

# Optional: rename URL params to match your Fillout field URL parameter names
# FILLOUT_URL_PARAM_MAP={"property":"Property","guest":"Guest","reservation_id":"ReservationID","checkout_date":"CheckOut","task_id":"TaskID"}
```

In Fillout, set each field’s **default value** to the matching **URL parameter** (same names as above, unless you customized the map).

Parameters sent automatically:

| Internal field | Fillout URL param (default map) |
|-----------|--------|
| `property` | Property code (e.g. CJC8303) → `Property` |
| `guest` | Guest name → `Guest` |
| `reservation_id` | Booking code (e.g. HM9CABAAY9) → `ReservationID` |
| `task_id` | Internal task UUID (for webhook) → `TaskID` |
| `checkout_date` | Checkout date → `CheckOut` |
| `assignee` | Assignee name, if set |

### 2. Completion webhook

When a cleaner submits the form, Fillout can call your app to mark the task **completed** and store the submission ID + PDF link. This runs **alongside** your Notion/PDF integrations — add it as a second integration on the same form.

```env
FILLOUT_WEBHOOK_SECRET=choose-a-long-random-string
```

**Fillout setup:** Integrate → Webhook → POST to:

`https://your-deployed-domain.com/api/webhooks/fillout`

Add header `x-fillout-secret: <same as FILLOUT_WEBHOOK_SECRET>`.

**Critical:** Each checklist link from the dashboard includes `?TaskID=…&ReservationID=…` (and other fields). In Fillout, create **URL parameter** hidden fields for at least:

| URL param | Purpose |
|-----------|---------|
| `TaskID` | Primary key — used to mark the correct task complete |
| `ReservationID` | Fallback lookup (booking code, e.g. HM9CABAAY9) |

Set each field’s default value to the matching URL parameter name (Fillout → field settings → prefilled from URL).

Fillout sends nested JSON (`submission.urlParameters`, `submission.questions`, `submission.documents`). The webhook parser reads all of these automatically. You can also map custom body fields in Fillout’s webhook “Advanced view” if needed.

Optional fields stored on the task:

- `submissionId` — Fillout submission ID (included automatically)
- Completed checklist URL — stored as `checklist_submission_url` (Fillout edit link with all answers)
- PDF URL — shown in the **PDF** column on the tasks page. Map your generated document to `pdf_url` in Fillout’s webhook **Advanced view** body, or include it in `submission.documents`.

Run migration `supabase/migrations/20260522_task_fillout.sql` for `fillout_submission_id` and `checklist_pdf_url` columns, then `supabase/migrations/20260530_task_checklist_submission_url.sql` for the completed checklist link.

**Status dot colors:** red = unassigned, green = assigned, blue = completed (after Fillout submit).

### Backfill completed tasks + PDF links

After webhooks are configured, backfill historical Fillout submissions (PDF column + completion status):

1. Generate an API key at https://build.fillout.com/home/settings/developer
2. Add to `env.local`:
   ```env
   FILLOUT_API_TOKEN=sk_prod_...
   ```
3. Run locally:
   ```bash
   npm run db:backfill-fillout
   ```
   Preview first with `npm run db:backfill-fillout -- --dry-run`

Or POST as admin to `/api/tasks/backfill-fillout` on your deployed app (same env var on Vercel).

The script scans both checklist forms (Cascades + Kirkwood), matches submissions to tasks via `reservation_id` / `task_id`, and stores `checklist_submission_url` (Fillout edit link) and `checklist_pdf_url` from Fillout’s generated documents.

### Multiple forms by property group (recommended for this portfolio)

CJC8103, CJC8201, CJC8303, CJC9203, and CJC9206 share one Fillout form; KWD502 uses another.
Do **not** set `FILLOUT_CHECKLIST_BASE_URL` when using this setup.

```env
FILLOUT_CHECKLIST_FORMS={"cjc":"https://forms.fillout.com/t/your-cjc-form","kwd502":"https://forms.fillout.com/t/your-kwd-form"}
```

Property → form mapping is built into `lib/propertyChecklists.js`.

### Per-property URLs (optional override)

To override a single property:

```env
TASK_CHECKLIST_URLS={"CJC8303":"https://forms.fillout.com/t/..."}
```

## 7. Deploy on Vercel

Import the GitHub repo, add all env vars (dashboard password, Hospitable token, session secret, Supabase URL + service role), deploy.
