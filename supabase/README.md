# Supabase setup

## 1. Create project

1. [supabase.com](https://supabase.com) → **New project**
2. Save the database password somewhere safe

## 2. Run schema

1. Project → **SQL Editor** → **New query**
2. Paste contents of `schema.sql` → **Run**

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

When an assignee is set on a task, the app emails and/or texts them. The same contacts are notified when **checkout or due date/time changes** on an already-assigned task (including after syncing from reservations).

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

## Fillout checklist (recommended)

The **Open Checklist** button builds a Fillout URL with task details as query parameters.

### 1. Form link (`env.local`)

```env
# Your Fillout form URL (from Share → Link)
FILLOUT_CHECKLIST_BASE_URL=https://forms.fillout.com/t/your-form-id

# Optional: rename URL params to match your Fillout field URL parameter names
# FILLOUT_URL_PARAM_MAP={"property":"property","guest":"guest","reservation_id":"reservation_id","task_id":"task_id"}
```

In Fillout, set each field’s **default value** to the matching **URL parameter** (same names as above, unless you customized the map).

Parameters sent automatically:

| Parameter | Value |
|-----------|--------|
| `property` | Property code (e.g. CJC8303) |
| `guest` | Guest name |
| `reservation_id` | Booking code (e.g. HM9CABAAY9) |
| `task_id` | Internal task UUID (for webhook) |
| `checkout_date` | Checkout date |
| `assignee` | Assignee name, if set |

### 2. Completion webhook

When a cleaner submits the form, Fillout can call your app to mark the task **completed** and store the submission ID + PDF link.

```env
FILLOUT_WEBHOOK_SECRET=choose-a-long-random-string
```

**Fillout setup:** Integrations → Webhook → POST to:

`https://your-deployed-domain.com/api/webhooks/fillout`

Add header `x-fillout-secret: <same as FILLOUT_WEBHOOK_SECRET>` if using a secret.

Include in the webhook body (hidden fields on the form, prefilled from URL params):

- `task_id` (required to find the task)
- `reservation_id` (fallback)
- `submissionId` / `submission_id` (from Fillout)
- `pdfUrl` / `pdf_url` (PDF export URL if Fillout provides it)

Run migration `supabase/migrations/20260522_task_fillout.sql` for `fillout_submission_id` and `checklist_pdf_url` columns.

**Status dot colors:** red = unassigned, green = assigned, blue = completed (after Fillout submit).

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
