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

## 6. Deploy on Vercel

Import the GitHub repo, add all env vars (dashboard password, Hospitable token, session secret, Supabase URL + service role), deploy.
