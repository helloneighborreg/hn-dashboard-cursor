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

Optional **`email`** and **`phone`** on each user are used when that person is selected as a task assignee (see task notifications in `supabase/README.md`).

### Legacy single admin

If only **`DASHBOARD_PASSWORD`** is set, one admin account is created (`username`: `admin`). Username on the login form is optional.

Also required: **`SESSION_SECRET`** (32+ random characters).

## Login

- **Admin** → lands on Dashboard after sign-in  
- **Cleaner** → lands on My Tasks (assigned list)  

Cleaners who open any other page are redirected to `/tasks`.
