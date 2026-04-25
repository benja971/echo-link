# Echo-link v2 — Design Spec

**Date:** 2026-04-25
**Author:** ben (with Claude as facilitator)
**Status:** Draft for review
**Target ship:** Same-day oneshot

---

## 1. Context

Echo-link v1 works. It is a self-hosted file-sharing service with Discord-flavoured embeds, magic-link auth, a unified account model, and a Discord bot. It is built in TypeScript with Express, React + shadcn, Postgres, and MinIO. Roughly 4 300 lines, 8 SQL migrations, ~30 commits since the unified account work landed.

The v1 problems are not bugs but ceiling problems:

- The UI looks like every other shadcn template — no personality, not memorable, no brand.
- Mobile usage is mediocre. The user shares files multi-channel (Discord, Telegram, Signal, iMessage), often from a phone.
- There is no marketing surface: a stranger landing on `/` sees a login form, not a product.
- The stack is sound but feels dated relative to what the user wants to build with (Bun, modern Svelte/runes, Drizzle, Tailwind v4).

V2 is therefore a **deep refactor of identity, design, frontend stack, and backend framework**, while keeping the data model, storage layer, and Discord bot largely intact.

---

## 2. Positioning & Voice

### 2.1 Product positioning

Echo-link v2 is a **personal CDN that doesn't suck**. Drop a file, get a link, share anywhere — Discord, Telegram, Signal, iMessage, raw chat. Self-hosted, opinionated, indie-crafted. Not a SaaS, not a growth play. The maintainer uses it daily; the public is welcome.

The *real* hook is **multi-channel link sharing without size limits**, not "for Discord". Discord embeds remain a polished feature, but they are no longer the identity.

### 2.2 Audience

- Primary: the maintainer and his close circle.
- Secondary: any indie/keyboard-first/self-hoster who lands on the site and wants to use or self-host it. The Catppuccin/Raycast tribe is the cultural target.
- Not targeted: enterprise, normies who already use Drive/Dropbox happily, anyone needing collaboration features.

### 2.3 Voice

- **Language:** English only across product, landing, errors, docs, commits.
- **Tone:** lowercase, mono-flavored, technically warm, dry humor allowed, zero corporate fluff.
- **Brand mark:** `echo·link` — wordmark in mono with a mauve dot mid-word, animated (pulse) only in the landing hero.
- **Examples of accepted copy:**
  - "drop a file. get a link. share anywhere."
  - "a personal cdn that doesn't suck."
  - "self-hosted · catppuccin · keyboard-first · open source"
  - "≤ 50mb · expires 24h · no account"

---

## 3. Visual System

### 3.1 Theme

Catppuccin Mocha is the default theme. Catppuccin Latte is the light alternative, swappable from the command palette. All palette tokens come from the official Catppuccin spec — no custom hex values outside official tokens unless explicitly justified.

Primary accent: **mauve** (`#cba6f7`). File-type semantic colors:
- video → peach (`#fab387`)
- image → sky (`#89dceb`)
- audio → green (`#a6e3a1`)
- archive/other → yellow (`#f9e2af`)

Warning/anonymous-mode tag: yellow with reduced opacity background.

### 3.2 Typography

- **UI / keys / brand / code:** JetBrains Mono (300, 400, 500, 700)
- **Body / copy / paragraphs:** Geist Sans (300, 400, 500, 600, 700)

Both fonts are loaded via `@fontsource` packages bundled with the app (no external CDN at runtime). Stylistic features `ss01`, `ss02`, `cv11` enabled for Geist where applicable.

### 3.3 Atmosphere & motion

- Background: dot grid 16px @ 0.04 opacity over Catppuccin `crust`, plus a fixed radial mauve glow at top-center and a sky tint at bottom-right (very low opacity).
- Glow: mauve radial halos on focused/hovered interactive elements (dropzone, command palette, primary CTAs).
- Motion baseline:
  - `pulse` (2.4s) on the brand dot in the hero.
  - `float` (3.2s) on the dropzone icon.
  - `blink` (1.1s steps(2)) on the command palette caret.
  - Slide-in stagger (0.5s, 100ms increments) on file-row reveals.
  - Scale-pop (0.32s ease-out) on command palette modal mount.
  - Native Svelte `transition:fade|fly|slide` for state changes — preferred over hand-rolled CSS.
- Easing: standardize on `cubic-bezier(0.22, 1, 0.36, 1)` exposed as `--ease`.

### 3.4 Reference mockups

The four canonical surface mockups produced during brainstorming live at `.superpowers/brainstorm/<session>/content/v2-design-preview.html`. They define the look-and-feel ground truth for:

1. `/` anonymous landing
2. `/app` workspace
3. ⌘K command palette overlay
4. `/v/:id` share page

Mobile-responsive variants must be designed during implementation but should preserve the same density and atmosphere.

---

## 4. Information Architecture

### 4.1 Routes

| Route                  | Purpose                                                     | Auth         |
|------------------------|-------------------------------------------------------------|--------------|
| `/`                    | Anonymous landing-as-demo + functional dropzone             | none         |
| `/app`                 | Workspace: drop hero, recent, all files                     | required     |
| `/v/:id`               | Public share page (player, metadata, copy variants, QR)     | public       |
| `/login`               | Magic-link request form                                     | none         |
| `/login/verify`        | Magic-link verification redirect → `/app`                   | none         |
| `/auth/discord`        | Discord OAuth flow (kept from v1)                           | none         |
| `/files/:path`         | S3-backed streaming proxy (kept from v1)                    | varies       |
| `/discord/upload/:t`   | Discord bot upload session redirect (kept from v1)          | session-token|
| `/api/*`               | SvelteKit `+server.ts` endpoints                            | varies       |

### 4.2 Non-route surfaces (all invoked from ⌘K)

- File detail / preview modal
- All-files extended browse (filter, sort)
- User stats panel
- Account panel (identities, Discord linking, sign-out)
- Settings / theme switcher
- "Last upload" copy shortcut

URL stability is a goal: deep links such as `/app?file=h7x` open the file detail modal on top of the workspace.

### 4.3 `/` behavior when authenticated (option α)

The landing remains visible to logged-in users — they can review the public face of the product. The "sign in →" button becomes "open app →". A drop on `/` while authenticated uses the user's account (not the anonymous flow).

### 4.4 Anonymous mode constraints

- Single file per drop, ≤ 50 MB.
- File-type whitelist via magic-bytes (image, video, audio, archive — same as v1's `file-type` validation).
- Rate limit: 3 uploads per IP per 24 h.
- Hard expiry: 24 h, no extension, no claim-into-account flow.
- Admin kill switch: env var or DB flag to disable anonymous uploads in one config change.
- Stored in `files` table with `account_id = NULL`, `is_anonymous = true`, distinct expiry rule.

---

## 5. Tech Architecture

### 5.1 Stack

| Layer          | Choice                                            |
|----------------|---------------------------------------------------|
| Runtime        | Bun (latest stable)                               |
| Framework      | SvelteKit 2 + Svelte 5 (runes)                    |
| Styling        | Tailwind v4 + CSS variables (Catppuccin tokens)   |
| UI primitives  | bits-ui                                           |
| Command palette| `cmdk-sv` if available, else hand-rolled          |
| Fonts          | `@fontsource/jetbrains-mono`, `@fontsource/geist-sans` |
| ORM            | Drizzle ORM                                       |
| Database       | Postgres 16 (kept)                                |
| Storage        | MinIO / S3 (kept) via `@aws-sdk/client-s3`        |
| Image proc.    | sharp (kept)                                      |
| Video thumbs   | FFmpeg via spawned process (kept)                 |
| File validation| `file-type` (kept)                                |
| Auth           | hand-rolled magic links + HTTP-only cookie sessions; bearer tokens for bot/API |
| Email          | Nodemailer SMTP (kept)                            |
| PWA            | manifest + icons + minimal SW (no offline cache, no share target) |
| Discord bot    | TypeScript / Node, discord.js (kept as-is)        |
| Deploy         | Docker Compose, multi-stage Dockerfile (Bun base) |

### 5.2 Repository structure

The existing `backend/` git repository is restructured **in place** to become the v2 monorepo. History is preserved.

```
backend/
├── apps/
│   ├── web/                # SvelteKit 2 app (frontend + API)
│   │   ├── src/
│   │   │   ├── routes/     # +page.svelte, +server.ts
│   │   │   ├── lib/        # components, hooks, utils
│   │   │   └── app.html
│   │   ├── static/         # icons, manifest, share-target landing assets
│   │   ├── package.json
│   │   └── svelte.config.js
│   ├── bot/                # Discord bot, ported as-is from src/discord/
│   │   ├── src/
│   │   │   ├── bot.ts
│   │   │   └── config.ts
│   │   └── package.json
│   └── api-legacy/         # v1 src/ kept as read-only reference during port
├── packages/
│   └── db/                 # Drizzle schema + migrations + client
│       ├── schema.ts
│       ├── migrations/
│       └── package.json
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile              # for apps/web
├── Dockerfile.bot          # for apps/bot
├── pnpm-workspace.yaml     # or bun workspace config
├── package.json            # root workspace
└── README.md
```

`api-legacy/` is deleted at the end of cutover.

### 5.3 Data model

The v1 schema is preserved verbatim and re-expressed as Drizzle schema in `packages/db/schema.ts`. New columns:

- `files.is_anonymous: boolean` (default `false`)
- `files.anonymous_ip_hash: text` (nullable, for rate-limit accounting; SHA-256 of IP + salt)

Per-IP rate limiting is computed at request time by aggregating `files` where `is_anonymous = true` AND `anonymous_ip_hash = ?` AND `created_at > now() - 24h`. No separate `anonymous_uploads` table — keeps the schema minimal.

Existing data migrates as-is (UUIDs and S3 keys preserved). Magic-link tokens are cleared on cutover; users re-auth on first visit. Upload tokens (for the Discord bot) are preserved.

### 5.4 Auth flow

Two auth paths, unchanged conceptually from v1:

1. **Web magic link:** `POST /api/auth/request` → email magic link → user clicks → `GET /login/verify?token=…` → set HTTP-only session cookie → redirect `/app`.
2. **Discord bot:** bot calls `POST /api/discord/upload-session` with bearer token → opaque session token → user uploads via `/discord/upload/:token` redirect to `/app?discord_session=…`.

Sessions: HTTP-only cookies, `SameSite=Lax`, signed (HMAC) with a server secret.

### 5.5 Upload pipeline

For both authenticated and anonymous uploads:

1. Auth check (cookie session OR Discord session token OR anonymous rate-limit check)
2. Multipart parse (SvelteKit native form data + `File` API; no Multer)
3. Magic-bytes validation via `file-type`
4. Size + quota validation (account quota for auth'd, hard 50 MB for anon)
5. S3 upload with UUID key
6. Image dimensions extraction via sharp (if image)
7. DB record insertion
8. Async video thumbnail job (if video) — same FFmpeg approach as v1

### 5.6 PWA

- `manifest.json` with icons (multiple sizes), theme color (Catppuccin base), display `standalone`.
- Minimal service worker that caches the app shell only — no aggressive offline strategy in v2.0.
- Web Share Target API: **not** implemented in v2.0 (deferred to v2.1+).

---

## 6. Feature Scope

### 6.1 In v2.0 (must ship)

- Anonymous demo dropzone on `/` with anti-abuse (size cap, file-type whitelist, IP rate limit, kill switch).
- Workspace `/app` with hero dropzone, recent files row (⌘1‒5 quick-copy shortcuts), all-files grid + list, stats pills.
- ⌘K command palette: upload, search files (fuzzy), copy last link, navigate, theme switch, sign out.
- Share page `/v/:id` with video player, metadata, QR code, copy variants menu (raw URL, Markdown, HTML `<video>`, BBCode), download button.
- Magic-link auth (English flow).
- Discord OAuth (kept).
- Discord bot endpoints repointed to new `/api/discord/*` routes; bot itself untouched.
- PWA installable (manifest + icons + minimal SW).
- Theme switcher Mocha ⇄ Latte.
- Multi-file batch drop (drop N files → N links sequentially).
- Mobile-responsive across all surfaces.
- Catppuccin atmosphere, motion, typography per §3.

### 6.2 Out of scope for v2.0 (deferred)

| Feature                      | Tier   |
|------------------------------|--------|
| Custom slugs (`/v/my-clip`)  | v2.1   |
| Web Share Target API (PWA)   | v2.1   |
| View counts / analytics      | v2.1   |
| Public profile pages         | v2.2+  |
| API tokens + CLI tool        | v2.2+  |
| Folders / projects           | v2.2+  |
| Edit metadata after upload   | v2.1   |
| iOS Shortcuts integration    | v2.2+  |
| Discord bot modernization    | v2.1   |
| Microservice Rust for media  | v2.2+  |
| Offline-first PWA            | v2.2+  |

### 6.3 Non-goals

- Collaboration / sharing beyond a public link.
- Comments, reactions, threads.
- Built-in image/video editing.
- Client-side encryption.
- Federation / multi-tenant.

---

## 7. Migration & Day-of Execution

### 7.1 Repository strategy

Restructure in place inside the existing `backend/` git repo (decision recorded; reversal would lose v1 history). The legacy `src/` is moved to `apps/api-legacy/` for the duration of the port and deleted at cutover.

### 7.2 Domain & DNS

Production domain stays `echo-link.<tld>` (decision recorded). A staging URL (`v2.echo-link.<tld>` or similar) is used during the day for validation.

### 7.3 Data cutover

- Postgres database is shared between v1 and v2 during staging — schema is additive.
- The new columns (`is_anonymous`, `anonymous_ip_hash`) are added via a Drizzle migration before cutover.
- Magic-link tokens are cleared on cutover (DELETE FROM magic_links). All users re-auth on first visit. Acceptable.
- Upload tokens (`upload_tokens`) are preserved.
- Files (`files`) are preserved verbatim.
- Discord upload sessions and link requests are cleared (DELETE FROM discord_upload_sessions, discord_link_requests) — short-lived state, low impact.

### 7.4 Day-of phase plan

Each phase ~30–60 min. Phases 5–8 can partially overlap (UI work parallel to backend completion).

| #  | Phase                                                       |
|----|-------------------------------------------------------------|
| 1  | Scaffold monorepo: `apps/web` SvelteKit, `packages/db`, Bun lockfile, root scripts |
| 2  | Drizzle schema port + initial migration regen + new columns |
| 3  | Auth: magic-link, sessions, identity model port             |
| 4  | Upload pipeline: validation + sharp/ffmpeg + S3 + anonymous quotas |
| 5  | Workspace UI `/app`: drop hero + recent + all files         |
| 6  | Share page `/v/:id`: player + metadata + QR + copy variants |
| 7  | Anonymous landing `/`: hero + functional dropzone + sections + footer |
| 8  | ⌘K command palette                                          |
| 9  | PWA: manifest + icons + minimal SW                          |
| 10 | Discord bot endpoints repoint; bot untouched                |
| 11 | Docker prod build → staging deploy                          |
| 12 | Smoke test → DNS swap to v2; v1 image kept for rollback     |

### 7.5 Rollback

- The v1 Docker image and `docker-compose.prod.yml` are preserved on the host.
- DNS swap is the cutover trigger; reverting DNS (or the proxy config) returns traffic to v1 within minutes.
- Database schema is additive only during v2.0 — v1 keeps working against it.

---

## 8. Testing & verification

No automated test suite exists in v1. v2.0 does not introduce a full test suite either (out of scope for a oneshot day), but adds:

- Smoke-test checklist run before DNS swap: anonymous upload, auth'd upload, share page render in Discord/Telegram/Signal previews, magic-link round trip, Discord bot `/upload` end-to-end, PWA install on iOS/Android, theme switch.
- Healthcheck endpoint `/api/health` retained from v1.
- Manual mobile responsive check on a real iPhone and Android device.

A proper Vitest + Playwright suite is a v2.1 follow-up.

---

## 9. Open decisions resolved

- **Domain:** `echo-link.<tld>` retained.
- **Repo strategy:** in-place restructure of `backend/` repo.
- **Anonymous mode:** ships in v2.0 (not deferred).
- **Frontend stack:** SvelteKit 2 + Svelte 5 + Bun.
- **Backend framework:** SvelteKit `+server.ts` endpoints (no separate Hono service).
- **Theme baseline:** Catppuccin Mocha, Latte alternative.
- **Language:** English only.
- **PWA scope:** installable only; no Share Target, no offline cache.
- **Discord bot:** untouched in v2.0; modernization deferred to v2.1.
- **No Rust microservice** in v2.0 (sharp + ffmpeg cover hot paths). Reserved as v2.2+ option if media processing becomes a bottleneck.

---

## 10. References

- Brainstorm session mockups: `.superpowers/brainstorm/<session>/content/v2-design-preview.html`
- v1 architecture guide: `backend/CLAUDE.md`
- v1 README (FR): `backend/README.md`
- Catppuccin Mocha palette: <https://catppuccin.com/palette>
- SvelteKit 2 docs: <https://kit.svelte.dev>
- bits-ui: <https://bits-ui.com>
- Drizzle ORM: <https://orm.drizzle.team>
