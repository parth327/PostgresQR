# QR Registration App

A simple, ready-to-run web app:

1. Share a public link → user fills in Name, Location, Education, Phone, Photo, etc. (no login needed).
2. On save, a **unique QR code** is generated for that person's record.
3. Anyone who **scans the QR code** sees that person's saved details on a profile page.
4. An **admin** can log in to see the full list of registrations and every QR code.

All data — including uploaded photos and generated QR codes — is stored in a **PostgreSQL
database**, so it persists across restarts and redeploys (this is important on hosts like
Render, where the local disk is wiped periodically).

---

## 1. Requirements

- [Node.js](https://nodejs.org) version 16 or higher.
- A PostgreSQL database (a free one from [Render](https://render.com), [Neon](https://neon.tech),
  [Supabase](https://supabase.com), or a local Postgres install all work).

## 2. Setup (one-time)

Open a terminal in this folder and run:

```bash
npm install
```

Then create your environment file:

```bash
cp .env.example .env
```

Open `.env` and set:

- **`DATABASE_URL`** — your Postgres connection string (see "Getting a database" below).
- **`APP_BASE_URL`** — the address people will use to reach the app (see section 4).

By default the admin login is:
- **Username:** `admin`
- **Password:** `admin123`

### ⚠️ Change the admin password before real use
Run:
```bash
npm run create-admin
```
It asks for a username and password, then prints two lines. Paste those into your `.env`
file (replacing the existing `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` lines), then restart.

## 3. Getting a database

**Option A — Render Postgres (recommended if you're already hosting on Render):**
1. Render Dashboard → New → PostgreSQL. Pick the free plan.
2. Once created, open it and copy the **Internal Database URL** (if your web service is
   also on Render — internal is faster and free) or **External Database URL** (if
   connecting from your own computer).
3. Paste that into `DATABASE_URL` in `.env` (or your Render web service's Environment tab).

**Option B — any other Postgres (Neon, Supabase, local install, etc.):**
Just put its connection string in `DATABASE_URL`. If it's a plain local Postgres with
no SSL, also set `DB_SSL=false` in `.env`.

The app automatically creates its `records` table on first startup — no manual SQL needed.

## 4. Run the app

```bash
npm start
```

You'll see:
```
Database ready (records table checked/created).
QR Registration App running!
Local:      http://localhost:3000
Register:   http://localhost:3000/register
Admin:      http://localhost:3000/admin/login
```

- Share **`http://localhost:3000/register`** as the public registration link.
- Go to **`http://localhost:3000/admin/login`** to view all records as admin.

## 5. Important: set APP_BASE_URL so QR codes work when scanned

The QR code stores a link like `http://localhost:3000/view/<id>`. That link only works
on the same computer. For someone to scan the QR with their **phone** and see the profile,
the link inside the QR must point to an address their phone can actually reach:

- **Same WiFi network (quick local testing):** find your computer's local IP (e.g.
  `192.168.1.25`) and set `APP_BASE_URL=http://192.168.1.25:3000` in `.env`.
- **Deployed online** (Render, etc.): set it to your real domain, e.g.
  `APP_BASE_URL=https://your-app.onrender.com`.

Restart the server after changing `.env`. QR codes generated *after* the change use the
new address; ones already saved keep the address they were created with.

## 6. How it works / project structure

```
server.js               Main entry point (connects to DB, then starts the server)
config.js                Reads settings from .env
db.js                    All database access (Postgres) — records, photos, QR images
routes/public.js         Registration form, save + QR generation, public profile view
routes/admin.js          Admin login, dashboard/list, delete
middleware/requireAdmin  Blocks admin pages unless logged in
utils/auth.js            Secure password hashing (Node's built-in crypto, no bcrypt needed)
utils/create-admin.js    CLI tool to generate a new admin password hash
views/                   All the HTML pages (EJS templates)
public/css/              Stylesheet
```

Photos and QR code images are stored as base64 data directly in the `records` table and
served on the fly through `/photo/:id` and `/qr/:id` — there are no files written to disk,
which is exactly why this survives redeploys.

### Admin capabilities
- Login page (`/admin/login`)
- Dashboard listing every record with a QR thumbnail, search by name/location/education/phone/email
- View any individual record's full profile
- Download any QR code
- Delete a record

### Public flow
- `/register` — the form (share this link)
- On submit → saves the record to Postgres → generates a QR PNG → redirects to `/success/<id>`
- `/success/<id>` — shows the new QR code with a download button
- `/view/<id>` — the page a QR scan opens, showing that person's details

## 7. Security notes before going live publicly

- Change the default admin password (`npm run create-admin`).
- Set a strong random `SESSION_SECRET` in `.env`.
- Serve over HTTPS in production (Render does this automatically).
- Consider adding rate-limiting on `/register` if the link will be public, to avoid spam.
- Anyone with the QR code / link can view that person's details — don't collect more
  sensitive info (like ID numbers) than you need, since the page has no access control.

## 8. Deploying on Render

1. Push this project to a git repo, connect it as a Render **Web Service**.
2. Create a Render **PostgreSQL** instance (see section 3).
3. In your web service's **Environment** tab, add: `DATABASE_URL`, `DB_SSL=true`,
   `APP_BASE_URL` (your Render URL), `SESSION_SECRET`, `ADMIN_USERNAME`,
   `ADMIN_PASSWORD_HASH`. Render does **not** read your local `.env` file.
4. Build command: `npm install`. Start command: `npm start`.

Because everything now lives in Postgres, your data survives redeploys and restarts —
no disk add-on needed.

Enjoy!
