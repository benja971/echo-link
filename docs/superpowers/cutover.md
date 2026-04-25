# Echo-link v2 — Cutover Guide

This document walks you through deploying v2 to staging, running the smoke checklist, swapping DNS, and finally retiring v1. Run **in order**. The branch is `feature/v2` (15 commits as of writing); v1 stays intact on `main`.

**Prerequisites:**
- Staging server with Docker + Docker Compose
- A staging URL (e.g., `v2.echo-link.example.com`) with TLS termination configured to forward to your reverse proxy / port 3000
- A production `.env.production` based on `.env.production.example` plus the new v2 vars (see below)

---

## §1 — Build images locally + dry-run

From the worktree root (`backend/.worktrees/v2/`):

```bash
docker compose build
```

Should produce two images: `<repo>-web` (apps/web, Bun + ffmpeg) and `<repo>-bot` (apps/bot, Bun).

Boot the full stack locally to confirm it works end-to-end before sending to staging:

```bash
docker compose up -d
sleep 6
curl -sI http://localhost:3000/api/health
# Expected: HTTP/1.1 200 OK
docker compose logs -f web | head -40
```

Tear down when satisfied:

```bash
docker compose down
```

---

## §2 — Required v2 env vars

In addition to v1's vars, `.env.production` must define:

```env
# Auth (generate fresh)
SESSION_SECRET=$(openssl rand -hex 32)         # ≥32 chars
ANONYMOUS_IP_SALT=$(openssl rand -hex 16)      # ≥16 chars

# Anonymous mode
ANON_ENABLED=true
ANON_MAX_SIZE_MB=50
ANON_MAX_PER_IP_PER_DAY=3
ANON_EXPIRATION_HOURS=24

# Optional: cleanup endpoint bearer (otherwise the midnight scheduler still runs)
CLEANUP_TOKEN=$(openssl rand -hex 24)
```

These have **no v1 equivalent** and the app fails fast on startup if `SESSION_SECRET` or `ANONYMOUS_IP_SALT` are missing/short (zod validation in `apps/web/src/lib/server/env.ts`).

---

## §3 — Stage deploy

On the staging server:

```bash
# pull the v2 branch
git fetch origin
git checkout feature/v2

# put .env.production in place
cp .env.production.example .env.production
nano .env.production    # fill in SESSION_SECRET, ANONYMOUS_IP_SALT, all DB/S3/SMTP/Discord values

# build + run with the prod compose
docker compose -f docker-compose.prod.yml up -d --build

# tail logs
docker compose -f docker-compose.prod.yml logs -f web
```

**The web container runs Drizzle migrations on first boot via the schema in `packages/db/migrations/`.** If you're sharing the prod DB with v1 (additive cutover), see §6.

Confirm staging URL responds:

```bash
curl -sI https://v2.echo-link.example.com/api/health
# Expected: 200 OK
```

---

## §4 — Smoke checklist (must pass before DNS swap)

Run each on the **staging URL**. Use your real Discord/Telegram/Signal accounts to validate previews.

### Anonymous flow

- [ ] `/` loads, mauve dot pulses, dropzone visible with `≤ 50mb · expires 24h · no account` tag.
- [ ] Drop a small image (≤ 50 MB) on `/`. Get `✓ uploaded — link copied` toast and the URL on screen.
- [ ] Paste the share URL in Discord — preview renders (image embed for image, native player for MP4).
- [ ] Paste in Telegram — preview renders.
- [ ] Paste in Signal — at least the OG image previews.
- [ ] Drop 4 files in a row from `/` → 4th hits `429`. ✓ rate limit works.
- [ ] Drop a `.txt` file → `415`. ✓ magic-bytes whitelist works.

### Auth flow

- [ ] `/login` → enter email → "check your inbox".
- [ ] Click the magic link in the email → land on `/app` with session cookie set.
- [ ] Refresh `/app` → still authenticated.
- [ ] `/api/auth/logout` POST or sign out via ⌘K → redirected to `/`, cookie cleared.

### Workspace `/app`

- [ ] Stats pills show file count + total size.
- [ ] Drop a video (≤ 100 MB) — uploads, link copies, recent row appears.
- [ ] `⌘1` copies the first recent file's share URL.
- [ ] `⌘K` opens command palette.
- [ ] Inside the palette, type a query — files matching it show up.
- [ ] Arrow-key + enter = copy link.
- [ ] `⌘O` opens file picker.
- [ ] `⌘T` toggles theme — html `data-theme` flips between `mocha` and `latte`, persists across reloads.

### Share page `/v/:id`

- [ ] Visit a share URL — page renders the player + metadata strip.
- [ ] Copy variants menu: switch raw → md → html → bbcode and click the URL — clipboard contains the right format.
- [ ] QR code displays.
- [ ] Markdown embed preview block shows the right snippet.
- [ ] Visit a non-existent UUID → 404.
- [ ] Visit an expired file (manually advance `expires_at` in DB) → 410.

### PWA

- [ ] iPhone Safari → Share → Add to Home Screen → standalone icon launches `/app`.
- [ ] Android Chrome → install prompt or menu → installs as standalone.
- [ ] `manifest.webmanifest` resolves with 200.

### Discord bot

- [ ] In a Discord server with the bot, run `/upload`. Bot replies with a button that opens the staging upload session URL.
- [ ] Complete the upload via the web UI. Bot posts a follow-up message in the channel with the share link (if the v1 bot's notification flow is still wired — this is one path that might need adjustment in v2.0.1).
- [ ] Generate a link code in `/app` (via API call to `/api/me/discord/link/start`). Run `/link code:XXX-XXX` in Discord. Bot replies with `linked`/`merged` confirmation. Identity is now associated.

### Catch-all

- [ ] DevTools console clean (no 4xx/5xx beyond the deliberate ones).
- [ ] Mobile responsive: test on a real phone, dropzone is touch-friendly, command palette usable.

---

## §5 — DNS swap (the cutover)

When all of §4 passes:

1. Update DNS or your reverse proxy so `echo-link.example.com` (production) routes to the v2 staging container.
2. Verify:
   ```bash
   curl -sI https://echo-link.example.com/api/health   # 200
   ```
3. Re-run the embed tests on the production URL (Discord, Telegram).
4. **Do NOT remove the v1 image yet.** Keep the v1 docker-compose file + image on the host for ≥48 h as a rollback path.

If anything is broken on production after DNS, swap DNS back to v1 and investigate.

---

## §6 — Database cutover note (only if sharing the DB with v1)

The Drizzle migration generated in dev creates everything from scratch (see `packages/db/migrations/0000_wild_johnny_blaze.sql`). If you're staging against a **fresh** DB (`echo-link-v2`), no concern — that's what was tested.

If you're pointing v2 at v1's existing live DB, **do not run the auto-migration** — it will conflict with existing tables and may DROP columns that v1 used (notably some `discord_upload_sessions` fields, `users.last_login_at`, `upload_tokens.expires_at`).

Instead apply only the **additive part** by hand:

```sql
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS anonymous_ip_hash text;

CREATE INDEX IF NOT EXISTS files_anon_rate_idx
  ON files (anonymous_ip_hash, created_at);
```

Then mark Drizzle's migration as already applied so the runner skips it:

```sql
CREATE TABLE IF NOT EXISTS drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at BIGINT
);
INSERT INTO drizzle_migrations (hash, created_at)
VALUES ('<hash from packages/db/migrations/meta/_journal.json>', extract(epoch from now())::bigint * 1000);
```

(For full rigor, copy the actual hash from `meta/_journal.json` after running `db:generate`.)

---

## §7 — Post-cutover cleanup

After ≥24 h of healthy v2 production with no rollback:

```bash
git checkout feature/v2
git rm -r apps/api-legacy
git commit -m "chore: remove apps/api-legacy/ after v2 cutover"
git push
```

Merge `feature/v2` into `main`:

```bash
git checkout main
git merge --no-ff feature/v2 -m "merge: v2 to main after cutover"
git push
```

Tag the release:

```bash
git tag -a v2.0.0 -m "v2.0.0 — Catppuccin nerdy, SvelteKit + Bun"
git push --tags
```

Remove the v1 image from the staging host. v2 is officially live.

---

## §8 — Known follow-ups for v2.0.1+

These were deferred from v2.0:

- **Bot upload-session response handler**: the bot's notification posting after upload uses v1's flow. The v2 endpoint shape is now compatible, but the upload-session→notification round trip may need a smoke-pass (Phase 10's TS types match, but actual end-to-end Discord notification was not tested in this sprint).
- **Web Share Target API** (PWA) for "Share to echo-link" from iOS/Android share sheets.
- **Custom slugs** (`/v/my-clip` instead of UUIDs).
- **View counts / analytics on share links.**
- **Discord bot full modernization** (rewrite to use Bun directly, share Drizzle types).
- **Folders / projects organization in `/app`.**
- **API tokens + a curl-friendly CLI.**
- **iOS Shortcuts integration.**
- **Offline-first PWA caching** (currently only app-shell cache is wired).

---

## Rollback procedure (if v2 misbehaves on prod)

```bash
# point DNS / reverse-proxy back at v1
# then on the host:
cd <v1 deployment path>
docker compose -f docker-compose.prod.yml up -d
```

The v1 image and `docker-compose.prod.yml` should still be present on the host. The v1 DB (if shared) is untouched — additive migration didn't drop anything. v2.0 anonymous file rows in shared DB will be ignored by v1 (it never queries `is_anonymous`).
