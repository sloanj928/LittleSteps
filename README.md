# Little Steps

A private place for a family to keep their baby's firsts, foods, words and growth. It's an installable web app (PWA) built with Next.js, MUI (Material 3 styling) and a Turso (SQLite) database behind the app's own API.

The design is set out in the spec, *Little Steps: Product & Technical Spec*. This README covers running and deploying it.

## What's in it

- **Accounts.** Each account has a username, a password and a 6-digit PIN. There's no email. The PIN can only reset a forgotten password. Sign-in pauses after five wrong passwords. PIN reset pauses for a day after five wrong PINs, and freezes after three pauses in a row until an admin steps in.
- **Households.** Each person in a household is an owner, an editor or a viewer. Invite codes work once and last 48 hours. A household never ends up without an owner.
- **Firsts, foods, words and notes.** Dates can be exact, a month, a season or "not sure". Each entry shows the baby's age on that date, using corrected age for preemies. Entries keep an edit history, deletes can be undone, and deleted items can be recovered for 30 days.
- **Growth.** Charts use the WHO standards under age 2 and the CDC charts from age 2. You can compare siblings by percentile. A number that looks like a typo gets a "just checking" prompt, but is never refused.
- **Gentle "coming up" questions.** These are timed to typical age ranges and are never shown as deadlines. They can be snoozed, answered "not yet", hidden, or switched off.
- **Two display themes.** *Classic* shows charts and lists. *Nursery Shelf* shows pencil marks on a doorframe, food jars, alphabet blocks and ribbons. Every display has a one-tap Data view and a sentence describing it for screen readers.
- **Admin console.** It has support requests, one-time temporary passwords and an audit log. Admins can't see anyone's babies or entries.

## Run it locally

You need Node 20.9 or later.

```bash
npm install
cp .env.example .env.local        # the defaults use a local SQLite file
npm run db:migrate                # creates local.db
npm run dev                       # http://localhost:3000
```

To make yourself an admin, sign up in the app first, then run:

```bash
DATABASE_URL=file:local.db npm run admin:grant -- <your-username>
```

## Checks

| Command | What it runs |
| --- | --- |
| `npm run validate` | Type check, lint (zero warnings), unit and API tests, production build |
| `npm test` | Vitest. The API tests call every route handler against a temporary SQLite file, including the full role-by-route permission matrix. |
| `npm run build && npm run test:e2e` | Playwright runs a whole first evening in Chromium and WebKit (iPhone), against a production build on an empty database. It also checks the security headers and for console errors. |

Run `npx playwright install chromium-headless-shell webkit` once before the first end-to-end run.

## Deploy (Vercel + Turso)

1. **Create the database.**
   ```bash
   turso db create little-steps
   turso db show little-steps --url          # → DATABASE_URL (libsql://…)
   turso db tokens create little-steps       # → DATABASE_AUTH_TOKEN
   ```
2. **Migrate it.** The script refuses a remote database unless you confirm:
   ```bash
   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… MIGRATE_CONFIRM=yes npm run db:migrate
   ```
3. **Set up Vercel.** Import the repo, then set these environment variables for Production:
   - `DATABASE_URL`
   - `DATABASE_AUTH_TOKEN`
   - `IP_HASH_SALT`: a long random string. IP addresses are stored only as a keyed hash.
   - `CRON_SECRET`: a long random string. Vercel Cron sends it to the nightly purge.
4. **Deploy.** `vercel.json` schedules `/api/cron/purge` once a day. The purge finishes account deletions after 30 days, hands over households, erases deleted items after 30 days and clears expired sessions. A failed purge returns a 500 with the reason in the body.
5. **Grant admin.** Point `DATABASE_URL` and `DATABASE_AUTH_TOKEN` at Turso and run `npm run admin:grant -- <username>`.

### Schema changes

1. Edit `src/db/schema.ts`.
2. Run `npm run db:generate` and commit the new SQL file in `drizzle/`.
3. Try it on a copy of production first: `turso db create little-steps-copy --from-db little-steps`.
4. Take a backup, then run the migration against production with `MIGRATE_CONFIRM=yes`.

### Backups

- **Point-in-time restore.** Turso keeps this for your plan's retention window. To restore, use `turso db create <name> --from-db little-steps --timestamp <time>`.
- **Nightly dump.** As a second, independent copy, run `turso db shell little-steps .dump > little-steps-$(date +%F).sql` on a schedule you control. Keep the dumps somewhere other than Turso, and check now and then that one restores.

## Security notes

- The browser only talks to this app's API. All database queries are parameterized (Drizzle).
- Every data route checks the session, then household membership, then role. Someone outside a household gets the same 404 as for an id that doesn't exist.
- Sessions use a 256-bit random token in an httpOnly, SameSite=Lax, Secure cookie. Only its SHA-256 is stored. Sessions slide for 30 days, written at most once a day, with a 90-day cap.
- Passwords, PINs and temporary passwords are hashed with Argon2id. Invite codes are stored as hashes and shown only once.
- **CSRF.** State-changing requests must come from the app's own origin and be JSON.
- **CSP.** There's a fresh script nonce on every page, with `strict-dynamic`. Nothing loads from another origin, so there are no CDNs or trackers. The font is self-hosted.
- **Logs.** Server logs record the route and the error name, never request bodies, passwords, PINs or tokens.

## Layout

```
src/app/            pages (signed out in (auth), signed in in (app)) and API routes
src/db/             schema and client
src/lib/            pure rules shared by server and client: dates, growth, milestones, foods
src/lib/server/     sessions, rate limits, access checks, purge (server only)
src/ui/             theme, app shell, forms, display themes (classic, nursery)
src/test/           API tests and the test harness
e2e/                Playwright flows
scripts/            migrations, admin grant, icon and growth-table builders
```

The app icons are generated from `src/ui/logo.json` by `npm run icons`. The growth tables in `src/lib/growth/reference.json` are rebuilt from the published WHO and CDC files by `scripts/build-growth-reference.cjs`.
