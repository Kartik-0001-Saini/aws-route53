# AWS Route 53 Clone

A functional clone of the **AWS Route 53 web console** — hosted zones and DNS records with real
persistence, a real API, and the console's own interaction model. No DNS resolution is performed
anywhere; the deliverable is the experience and the data layer behind it.

| | |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript) · Tailwind v4 over a Cloudscape-derived token layer |
| Backend | FastAPI · SQLAlchemy 2.0 · Alembic |
| Database | SQLite |
| Auth | Firebase Google OAuth **+** a one-click demo account |

---

## Contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [API overview](#api-overview)
- [Authentication](#authentication)
- [Project structure](#project-structure)

---

## Quick start

Prerequisites: **Node 20.9+**, **Python 3.11+**, git. Verified on Node 22.21 / Python 3.13.9.

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

API on <http://localhost:8000> · interactive docs at <http://localhost:8000/docs>.

The app boots with no `.env` at all — every setting has a development-safe default. Copying
`.env.example` is only needed once you configure Firebase.

### Frontend

```powershell
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Console on <http://localhost:3000>. Press **Continue as demo user** — no credentials, and the
account arrives pre-populated with five hosted zones and their records.

---

## Configuration

Two `.env` files, both gitignored, each with a committed `.env.example`.

### `backend/.env`

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite path. Relative paths resolve against `backend/`, not the working directory. |
| `CORS_ORIGINS` | Comma-separated exact origins. No wildcard — credentials are sent. |
| `FIREBASE_SERVICE_ACCOUNT_B64` | Service-account JSON, base64 encoded. **Empty disables Google sign-in**; the demo path still works. |
| `DEMO_TOKEN_SECRET` | Signs demo session tokens. Must be changed in production. |

### `frontend/.env.local`

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Backend origin. |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web config. Public by design — safe in a client bundle. Empty hides the Google button. |

> **`NEXT_PUBLIC_*` values are inlined at build time.** Changing them on a host requires a
> **redeploy**; a restart silently keeps the old values.

### Setting up Firebase (optional)

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method** → enable **Google**.
3. **Project settings → General → Your apps** → add a Web app → copy the config into the
   `NEXT_PUBLIC_FIREBASE_*` variables.
4. **Project settings → Service accounts** → *Generate new private key*. Base64 it and put the
   result in `FIREBASE_SERVICE_ACCOUNT_B64`:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\key.json"))
   ```
5. **Authentication → Settings → Authorized domains** → add your deployed domain. Missing this makes
   Google sign-in fail silently with nothing in the console.

Skipping all of this is fine. The app detects the absent credential, hides the Google button, and
runs entirely on the demo path.

---

## Architecture

Two apps, one repository, no shared runtime. They meet only at the HTTP boundary.

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  frontend/  (Next.js, 3000) │         │  backend/  (FastAPI, 8000)   │
│                             │         │                              │
│  App Router pages           │  HTTPS  │  api/v1/     routers         │
│  React Query cache          │ ──────► │  services/   business rules  │
│  Firebase client SDK        │ Bearer  │  models/     SQLAlchemy ORM  │
│  Cloudscape token layer     │  token  │  validators/ pure DNS rules  │
└─────────────────────────────┘         └──────────────┬───────────────┘
              │                                        │
              ▼                                        ▼
      Firebase Auth  ◄────── verifies ID token ──── firebase-admin
      (identity only)                                  │
                                                       ▼
                                                  SQLite (Alembic)
```

**Backend layering.** A request only ever moves downward — routers handle HTTP and authorisation,
services own the business rules and the transaction, models are persistence only, validators are
pure functions with no I/O. A router that opens a session and writes a query inline is treated as a
bug, not a shortcut.

**The auth boundary is hard.** The frontend never holds a Firebase *Admin* credential. The backend
never trusts a client-supplied user id — identity comes only from a verified token, resolved by the
`current_user` dependency. Every zone and record query filters on that user id.

**Route 53 fidelity.** Colours, spacing, radii and type all come from a token layer in
`globals.css` derived from Cloudscape, the design system the real console is built on. No component
hardcodes a hex value, which is what makes the dark theme a token swap rather than a rewrite.

---

## Database schema

```
users ──< hosted_zones ──< dns_records
```

### `users`

One row per authenticated identity. Firebase owns authentication; this table owns identity *within
the app*.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `firebase_uid` | str, unique, indexed | The join to Firebase. A fixed sentinel for the demo user. |
| `email` | str, indexed | |
| `display_name`, `photo_url` | str, null | Refreshed from the provider on each sign-in. |
| `provider` | enum | `google` \| `demo` |
| `aws_account_id` | str(12) | Mocked account number shown in the top nav. Stable per user. |
| `seeded_at` | datetime, null | Set once the starter zones are created — prevents re-seeding someone who deleted them. |
| `last_login_at` | datetime, null | |

### `hosted_zones`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | Never leaves the backend. |
| `zone_id` | str, unique, indexed | Public Route 53-style id: `Z` + 21 chars. Used in URLs and the API. |
| `user_id` | FK → users, cascade | |
| `name` | str, indexed | Canonical: lower-cased, no trailing dot. |
| `type` | enum | `public` \| `private` |
| `comment` | text, null | The only mutable field, as in Route 53. |
| `name_servers` | JSON | The four delegated NS. Empty for private zones. |
| `vpc_id`, `vpc_region` | str, null | Private-zone association (mocked). |

Unique on `(user_id, name, type)` — Route 53 permits a public and a private zone for the same
domain, but not two of a kind.

### `dns_records`

The unit is the record *set*, as in Route 53: one row can carry several values, newline-separated,
exactly as the console's textarea presents them.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `hosted_zone_id` | FK → hosted_zones, cascade | |
| `name` | str, indexed | Fully qualified, canonical. The apex is stored as the bare zone name. |
| `type` | enum | A, AAAA, CAA, CNAME, MX, NS, PTR, SOA, SRV, TXT |
| `ttl` | int, null | Null only for alias records, which inherit the target's TTL. |
| `value` | text | Newline-separated values. |
| `routing_policy` | enum | simple, weighted, latency, failover, geolocation, multivalue |
| `set_identifier` | str | Distinguishes members of a routing group. Empty string, never null, so the unique constraint holds. |
| `weight`, `region`, `failover_type`, `health_check_id` | | Per-policy fields. |
| `is_alias`, `alias_target` | | |
| `is_system` | bool | Apex NS and SOA. Not editable, not deletable — as in the console. |

Unique on `(hosted_zone_id, name, type, set_identifier)`.

### Notes on the data layer

- **Foreign keys are enforced.** SQLite ignores them unless `PRAGMA foreign_keys=ON` is set on every
  connection, which the engine does on connect. Without it, `ON DELETE CASCADE` silently does
  nothing and deleting a zone would orphan its records.
- **`record_count` is a correlated subquery**, not a stored counter — a stored value is one missed
  decrement away from lying.
- **Timestamps are UTC-aware in both directions.** SQLite has no timezone-aware type, so a
  `UtcDateTime` decorator normalises on write and re-tags on read; otherwise the API would emit
  offset-less strings the browser would read as local time.
- **Migrations use batch mode**, since SQLite cannot `ALTER` a constraint — which works only because
  every constraint has a deterministic name from the metadata naming convention.

---

## API overview

Base path `/api/v1`. Every endpoint except `/auth/config` and `/auth/demo` requires
`Authorization: Bearer <token>`.

### Authentication

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/auth/config` | Which sign-in methods this server supports. Lets the login screen hide a Google button that would fail. |
| `POST` | `/auth/demo` | Start a demo session. Returns a token shaped like Firebase's. |
| `GET` | `/auth/me` | The signed-in user. Called on boot to restore a persisted session. |
| `POST` | `/auth/logout` | Acknowledge sign-out. |

### Hosted zones

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/hosted-zones` | List. `page`, `page_size`, `search`, `type`, `sort_by`, `sort_dir`. |
| `POST` | `/hosted-zones` | Create, together with the apex NS and SOA records. |
| `GET` | `/hosted-zones/{zone_id}` | Detail, including the delegation set. |
| `PATCH` | `/hosted-zones/{zone_id}` | Edit the comment. Name and type are immutable. |
| `DELETE` | `/hosted-zones/{zone_id}` | Delete. **409** while the zone still holds user records. |

### DNS records

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/hosted-zones/{zone_id}/records` | List. `search`, repeatable `type`, `sort_by`, `sort_dir`, paging. |
| `POST` | `/hosted-zones/{zone_id}/records` | Create. The name is resolved against the zone server-side. |
| `GET` | `/hosted-zones/{zone_id}/records/{id}` | Detail. |
| `PUT` | `/hosted-zones/{zone_id}/records/{id}` | Edit value and routing. Name and type are immutable. |
| `DELETE` | `/hosted-zones/{zone_id}/records/{id}` | Delete. **409** for apex NS and SOA. |
| `POST` | `/hosted-zones/{zone_id}/records/bulk-delete` | Delete a selection. System records are reported as skipped rather than failing the batch. |

### Import and export

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/hosted-zones/{zone_id}/export?format=bind\|json` | Download the zone as a BIND zone file or as JSON. |
| `POST` | `/hosted-zones/{zone_id}/import` | Import records from a BIND zone file. |

Import **previews by default** — nothing is written unless `apply` is true. The preview validates every
record, so what it lists is exactly what will be written; a preview that counted records validation
would refuse is a preview that lies, which defeats the point of having one. It also reports lines the
parser could not read, records that already exist as conflicts, and records that failed validation,
each with its reason.

Imported records go through the same service and validators as hand-created ones, so an import
cannot introduce a record the API would otherwise reject. `$ORIGIN`, `$TTL`, `@`, blank owner names
(repeating the previous), relative names, BIND duration shorthand (`1h`, `2d`) and parenthesised
multi-line records are all understood. `$INCLUDE` and `$GENERATE` are deliberately not: the first
reads from the filesystem, the second is a macro language of its own.

Records are nested under their zone, which is what makes ownership impossible to bypass — the zone
is resolved against the caller before the record is ever looked up.

### One error shape

Every failure returns the same envelope, so the frontend has exactly one thing to parse:

```json
{
  "error": {
    "code": "CnameConflict",
    "message": "A CNAME record already exists for www.example.com...",
    "details": { "fields": { "value": "'999.1.1.1' is not valid." } }
  }
}
```

`details.fields` maps directly onto form inputs. Status codes: **401** unauthenticated,
**403** forbidden, **404** not found, **409** conflict, **422** validation.

### Validation

Per-type rules matching what Route 53 itself enforces — because a clone that accepts `999.1.1.1` as
an A record stops feeling like the console the moment anyone tries it.

| Type | Rule |
|---|---|
| `A` / `AAAA` | Parsed as a real IPv4 / IPv6 address. |
| `CNAME` | Valid hostname, single value, and cannot share a name with any other record (RFC 1034). |
| `MX` | `<priority 0–65535> <hostname>` |
| `SRV` | `<priority> <weight> <port> <target>` |
| `CAA` | `<flags 0–255> <issue\|issuewild\|iodef> "<value>"` |
| `TXT` | Double-quoted; each quoted string ≤ 255 bytes. |
| `TTL` | 0 – 2,147,483,647. Rejected on alias records, which inherit their target's. |

---

## Authentication

Two paths, one contract. Whichever was used, the client presents
`Authorization: Bearer <token>` and the backend resolves it to a `VerifiedIdentity`. Nothing
downstream branches on which path produced it.

**Google.** Firebase holds the session; `firebase-admin` verifies the ID token against Google's
public keys — signature, issuer, audience, expiry. The SDK refreshes an expiring token silently, and
`browserLocalPersistence` is what satisfies the assignment's session-persistence requirement: the
refresh token survives a reload and a browser restart.

**Demo.** A short-lived HS256 JWT this backend both mints and verifies, kept in `localStorage`. It
exists so the hosted demo opens for anyone — a blocked popup, a Workspace policy forbidding
third-party OAuth consent, or simply not wanting to hand over a Google account should not be the
difference between seeing the app and seeing nothing.

**Seeding.** Every new user is given five hosted zones and their records on first login, through the
service layer rather than straight into the ORM — so seeded rows obey exactly the same rules as
user-created ones. Without this, a grader signing in with their own Google account would land on an
empty console, and the first thing they would see of a Route 53 clone would be a blank table.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | Focus the search box |
| `c` | Create a hosted zone (hosted zones list) |
| `i` | Import records from a zone file (zone detail) |
| `?` | Show the shortcut list |
| `Esc` | Close a dialog |

Shortcuts never fire while you are typing in a field, and never fire while a dialog is open — the
dialog owns the keyboard, and a shortcut firing invisibly behind a modal is worse than no shortcut.
The help dialog is rendered from the same array that registers the handlers, so a shortcut cannot
exist without being documented or be documented after it has been removed.

## Project structure

```
backend/
├── alembic/                 migration chain
├── app/
│   ├── api/
│   │   ├── deps.py          the only place a request's identity is established
│   │   └── v1/              routers: auth, hosted_zones, dns_records
│   ├── core/                config, security, exceptions, identifier generators
│   ├── db/                  engine, session, base, seed data
│   ├── models/              SQLAlchemy ORM
│   ├── schemas/             Pydantic request/response
│   ├── services/            business rules, own the transaction
│   ├── validators/          pure DNS rules, no I/O
│   └── main.py
└── tests/

frontend/
└── src/
    ├── app/
    │   ├── (console)/       authenticated pages, sharing one frame and guard
    │   ├── login/
    │   ├── globals.css      the Cloudscape token layer
    │   └── layout.tsx
    ├── components/
    │   ├── layout/          TopNavigation, SideNavigation, Breadcrumbs, shells
    │   └── ui/              Button, Table, Container, Flashbar, Pagination…
    ├── lib/
    │   ├── api/             HTTP client + typed endpoint wrappers
    │   ├── auth/            session context; both sign-in paths
    │   ├── firebase/        client SDK, lazily loaded and absent-safe
    │   ├── notifications/   flash message store
    │   └── theme/           light/dark, applied before first paint
    └── types/api.ts         mirrors the backend schemas
```

---

## Notes

This is a clone built for an assignment. It is not affiliated with Amazon Web Services, performs no
DNS resolution, and the AWS wordmark in the header is a type treatment rather than the trademarked
asset.
