# Cloudflare Workers deploy

## Build & deploy

```bash
npm run build:cloudflare    # build only
npm run deploy:cloudflare   # build + deploy (keeps dashboard env vars)
```

If you connect GitHub in **Workers Builds**, set the deploy command to:

```bash
npm run build:cloudflare && npx opennextjs-cloudflare deploy -- --keep-vars
```

## Environment variables

**Secrets** (tokens, passwords) belong in the Cloudflare dashboard:

**Workers & Pages → `hn-dashboard-cursor` → Settings → Variables and Secrets**

Do **not** commit secrets to git. Copy values from local `env.local`.

**Non-secret config** (checklist URLs, URL param map) lives in `wrangler.jsonc` under `"vars"` so local deploys stay in sync with the dashboard. If Cloudflare shows “Update your wrangler config file…”, paste only the **non-secret** lines into `wrangler.jsonc` — never put API keys or `DASHBOARD_USERS` in that file.

Always deploy with `--keep-vars` so dashboard secrets are not wiped:

```bash
npm run deploy:cloudflare
```

### Restore checklist

```bash
node scripts/print-cloudflare-env-checklist.mjs
node scripts/print-dashboard-users.mjs
```

### Required variables

| Variable | Notes |
|----------|--------|
| `SESSION_SECRET` | 32+ random characters |
| `DASHBOARD_USERS` | One-line JSON array — use `print-dashboard-users.mjs` |
| `HOSPITABLE_API_TOKEN` | Hospitable → Settings → API access |
| `SUPABASE_URL` | Project URL from Supabase API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret key |
| `CRON_SECRET` | Random string for scheduled crons (`/api/tasks/sync-cron`, `/api/tasks/overdue-notify-cron`) |

### Optional — web push (PWA)

| Variable | Notes |
|----------|--------|
| `VAPID_PUBLIC_KEY` | In `wrangler.jsonc` `vars` (non-secret) |
| `VAPID_PRIVATE_KEY` | Cloudflare **Secret** only — never commit |
| `VAPID_SUBJECT` | In `wrangler.jsonc` `vars`, e.g. `mailto:hello@hnreg.com` |

Generate keys: `node scripts/generate-vapid-keys.mjs`

### Optional — legacy Fillout

Only needed if some properties still use external Fillout forms (not the in-app CJC checklist). If unset, skip these — CJC units use `/forms/cjc-turn-clean-checklist`.

| Variable | Notes |
|----------|--------|
| `FILLOUT_CHECKLIST_FORMS` or `FILLOUT_CHECKLIST_BASE_URL` | External checklist URLs for unmapped properties |
| `FILLOUT_WEBHOOK_SECRET` | Fillout webhook header secret |
| `FILLOUT_API_TOKEN` | For one-time backfill: `npm run db:backfill-fillout` |

See `.env.local.example` for optional notification, Plaid, and other vars.

### DASHBOARD_USERS in Cloudflare

Use **+ Add → Secret**. Paste **only** the JSON array (no `DASHBOARD_USERS=` prefix, no outer quotes):

```json
[{"username":"josiah","name":"Josiah Burton","role":"admin","password":"..."}]
```

If Cloudflare's bulk JSON editor rejects it, escape the whole value as a string (see output of `print-dashboard-users.mjs`).

### Verify after restore

Open **`/api/auth/status`** on your live site (no login required):

```json
{
  "login_ready": true,
  "dashboard_user_count": 2,
  "dashboard_usernames": ["josiah", "brandi"]
}
```

## Why variables disappeared

Wrangler **replaces** Worker config on each deploy. Without **`--keep-vars`**, dashboard-configured variables are **deleted**.

Always deploy with:

```bash
opennextjs-cloudflare deploy -- --keep-vars
```

(`npm run deploy:cloudflare` includes this flag.)

## Task sync and subrequest limits

**Sync from Reservations** calls Hospitable (paginated) and Supabase. Cloudflare Workers cap **subrequests per invocation** (50 on Free). The app batches DB writes and limits Hospitable pages to stay under that cap. Do **not** add a `limits` block to `wrangler.jsonc` on the Free plan — deploy will fail with “CPU limits are not supported for the Free plan.” Paid plans may optionally raise `limits.subrequests` in Wrangler.

For one booking, use **sync-reservation** (`POST /api/tasks/sync-reservation?code=…`) instead of full sync.

### Automatic sync (Cron)

Two Cloudflare Cron Triggers run via `worker.js`:

| Schedule | Route | Purpose |
|----------|-------|---------|
| Every 30 min | `POST /api/tasks/sync-cron` | Sync turnover tasks from Hospitable |
| Every 15 min | `POST /api/tasks/overdue-notify-cron` | Notify assignee + admins when a task is past due |

1. Set **`CRON_SECRET`** in Cloudflare (Settings → Variables and Secrets) — any long random string.
2. Deploy with `npm run deploy:cloudflare` (uses custom `worker.js` entry in `wrangler.jsonc`).

Manual sync from the Tasks page still works. The sync cron uses the same logic with `skipNotify: true` (no booking-change emails/texts on bulk sync).

Overdue notifications require the `overdue_notified_at` column — run `supabase/migrations/20260715_task_overdue_notified.sql`.

Test locally after `npm run preview:cloudflare`:

```bash
curl -X POST http://localhost:8787/api/tasks/sync-cron \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

curl -X POST http://localhost:8787/api/tasks/overdue-notify-cron \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Trigger the scheduled handler (runs the default sync cron when testing):

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled"
```

## Local preview on Workers

```bash
npm run preview:cloudflare
```

Uses `env.local` / `.env.local` via Next.js (same as `npm run dev`).
