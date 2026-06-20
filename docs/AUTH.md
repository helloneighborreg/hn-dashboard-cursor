# Dashboard users and roles

## Roles

| Role | Pages | Notes |
|------|--------|--------|
| **admin** | All modules | Can sync tasks, mark complete, view Dashboard & Financials |
| **cleaner** | Tasks only | Sees only tasks assigned to them; list and calendar views; no Reservations or other modules |

## Environment variables

Set **`DASHBOARD_USERS`** (recommended) as a JSON array:

```json
[
  {
    "username": "josiah",
    "name": "Josiah Burton",
    "role": "admin",
    "password": "your-admin-password"
  },
  {
    "username": "brandi",
    "name": "Brandi Drieslein",
    "role": "cleaner",
    "password": "her-password",
    "email": "brandi@example.com",
    "phone": "+15551234567"
  }
]
```

In Vercel/local `.env`, put it on one line:

```bash
DASHBOARD_USERS=[{"username":"josiah","name":"Josiah Burton","role":"admin","password":"..."},{"username":"brandi","name":"Brandi Drielsien","role":"cleaner","password":"..."}]
```

For production, use bcrypt hashes instead of plain passwords (same format as `DASHBOARD_PASSWORD` — values starting with `$2` are verified with bcrypt).

Optional **`email`** and **`phone`** on each user are used when that person is selected as a task assignee. **Admin** users with an **`email`** also receive task-change and completion notifications (or set `TASK_CHANGE_NOTIFY_EMAIL` / `TASK_COMPLETION_NOTIFY_EMAIL` — see `supabase/README.md`).

### Legacy single admin

If only **`DASHBOARD_PASSWORD`** is set, one admin account is created (`username`: `admin`). Username on the login form is optional.

Also required: **`SESSION_SECRET`** (32+ random characters).

After deploy, open **`/api/auth/status`** on your site. You should see `"dashboard_usernames":["josiah","brandi"]` and `"login_ready":true`. If users are missing, fix **`DASHBOARD_USERS`** in Cloudflare → Workers → Settings → Variables and Secrets.

Generate a one-line `DASHBOARD_USERS` value locally:

```bash
node scripts/print-dashboard-users.mjs --brandi-password brandi
```

Paste the output into Cloudflare as a **Secret** named `DASHBOARD_USERS`. See **`docs/CLOUDFLARE.md`** for the full env list and deploy notes (`--keep-vars` prevents vars from being wiped on deploy).

## Login

- **Admin** → lands on Dashboard after sign-in  
- **Cleaner** → lands on My Tasks (assigned list)  

Cleaners who open any other page are redirected to `/tasks`.
