# RetainerKit — SQL-first client portal starter (Next.js + NextAuth + Postgres)

RetainerKit is a small, **SQL-first** portal starter intended for client/contractor demos.
It uses **Next.js (App Router)** + **Tailwind v4** + **daisyUI**, with **NextAuth.js v4 (stable)** and a **custom Postgres adapter** (no ORM, no Prisma).

Auth supports:
- **GitHub OAuth** (NextAuth)
- **Google OAuth** (NextAuth)
- **Email + Password** (first-party endpoints that create **database sessions** in Postgres)

> Why email/password isn’t a NextAuth Credentials provider:
> NextAuth v4 Credentials provider uses JWT sessions; it does not support `session.strategy = "database"`.
> This project keeps **database sessions** and implements email/password as SQL endpoints that insert rows into `sessions`
> and set the same session cookie name used by NextAuth database sessions.

---

## Stack

- Next.js (App Router, `src/` layout)
- Tailwind CSS v4 + daisyUI
- NextAuth.js v4 (stable)
- Postgres (Docker for local dev)
- SQL migrations + Node migration runner (uses `pg`)

---

## Local development (Windows / PowerShell)

### 1) Install deps

```powershell
npm install
```

### 2) Start Postgres

```powershell
docker compose up -d
```

### 3) Configure environment

Create **`.env.local`** in the project root:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=REPLACE_ME_WITH_A_RANDOM_SECRET
DATABASE_URL=postgresql://retainerkit:retainerkit@localhost:5432/retainerkit

# Optional OAuth providers (enable buttons automatically when set)
GITHUB_ID=
GITHUB_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Generate a secret (PowerShell, deterministic):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste that value into `NEXTAUTH_SECRET`.

**Important:** Use `http://localhost:3000` in dev to avoid cookie issues that can happen with non-localhost IPs.

### 4) Run migrations (creates tables)

```powershell
npm run db:migrate
```

Or reset everything (drops and recreates schema, then migrates):

```powershell
npm run db:reset
```

### 5) Start the app

```powershell
npm run dev
```

Open:

- http://localhost:3000

---

## Database

### Docker Compose

Postgres runs as:

- user: `retainerkit`
- password: `retainerkit`
- database: `retainerkit`
- port: `5432`

### Verify it’s running

```powershell
docker ps
docker logs retainerkit-db --tail 50
```

### Quick query (PowerShell-friendly)

```powershell
docker exec -it retainerkit-db psql -U retainerkit -d retainerkit -c "select now();"
```

---

## Migrations

Migrations live in:

- `db/migrations/*.sql`

The migration runner:

- `db/migrate.mjs`

It tracks applied migrations in:

- `schema_migrations`

Run:

```powershell
npm run db:migrate
```

Reset (drops and recreates schema, then migrates):

```powershell
npm run db:reset
```

---

## Auth flows

### OAuth (GitHub / Google)

- Login page calls NextAuth providers.
- Signing in via OAuth will create:
  - `users` row
  - `accounts` row (linked provider)
  - `sessions` row (database session strategy)

### Email + Password

Endpoints:
- `POST /api/register`  
  Creates user with bcrypt password hash.
- `POST /api/login`  
  Verifies password, inserts a `sessions` row, and sets the `next-auth.session-token` cookie.
- `POST /api/logout`  
  Deletes the current session row and clears the cookie.

This means **email/password sessions are stored in Postgres**, just like OAuth sessions.

### Confirm sessions are in the DB

After logging in:

```powershell
docker exec -it retainerkit-db psql -U retainerkit -d retainerkit -c "select count(*) as sessions from sessions;"
```

---

## Routes

- `/` Landing
- `/login` Login page (OAuth buttons + email/password form)
- `/register` Registration page
- `/portal` Protected portal (server-gated)

Protection is enforced server-side using `getServerSession(authOptions)` in the portal layout.

---

## Troubleshooting

### “Missing required env var: DATABASE_URL” when running db scripts
`node db/*.mjs` does not auto-load `.env.local` unless scripts call dotenv (this repo does).
Confirm `.env.local` exists at the repo root and includes `DATABASE_URL`.

### Tailwind/daisyUI looks unstyled
Ensure `src/app/globals.css` contains:

```css
@import "tailwindcss";
@plugin "daisyui";
```

### Conflicting route/page at `/login`
Make sure you do **not** have `src/app/login/route.ts`.  
The login API must live at `src/app/api/login/route.ts`.

### Clear cache after major config changes
```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

---

## License

MIT (or update as desired)
