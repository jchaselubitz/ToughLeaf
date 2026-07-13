# Implementation Plan

Phased so the app is runnable end-to-end early and each phase is demoable.
Stack and rationale: [tech-stack.md](tech-stack.md). Schema: [data-model.md](data-model.md).
AI design: [ai-review.md](ai-review.md).

## Phase 0 — Scaffold
- Yarn workspaces monorepo: `apps/web`, `apps/api`, `packages/shared`.
- `packages/shared`: status enum, doc-type slugs, Zod v4 schemas, AI review
  result types.
- `apps/api`: Hono on `@hono/node-server`; `/api/health`; serve-static wired
  for `apps/web/dist` with index.html fallback.
- `apps/web`: Vite + React + TS, Tailwind v4 + shadcn/ui, React Router,
  TanStack Query, Hono RPC client typed against the API.
- Root scripts: `dev` (api + vite dev with proxy), `build`, `db:*`.

**Done when:** `yarn dev` serves a hello page through both Vite dev server and
the built/static path.

## Phase 1 — Database
- Drizzle schema for all tables in [data-model.md](data-model.md);
  drizzle-kit migrations.
- Seed script: 5 `document_types`, default `requirements` per type
  (lists in [ai-review.md](ai-review.md)).
- Local dev DB: Docker Postgres (`docker compose up db`).

**Done when:** migrate + seed run clean; Drizzle Studio shows seeded data.

## Phase 2 — Subcontractor CRUD + portal skeleton
- API: create subcontractor (generates `portal_token`, creates the 5
  `document_requests` with the modal's due date), list (dashboard payload with
  nested request statuses), get/update (name, email, due date → updates
  non-accepted requests), note update.
- Web: Dashboard with subcontractor cards + per-doc status chips; "Add
  subcontractor" modal (name, email, due date); Subcontractor detail page with
  editable fields + note.
- Portal route `/portal/:token`: renders the 5 document cards with the
  three-rectangle status indicator (requested/overdue → submitted/incomplete →
  accepted; overdue derived from due date).

**Done when:** add a sub in the modal, open their portal link, see 5
requested cards; overdue renders red when due date is past.

## Phase 3 — Files: upload, versions, download
- Bucket wiring (AWS S3 SDK against Railway bucket; MinIO in docker-compose as
  the local stand-in).
- `POST /api/portal/:token/requests/:id/upload`: multipart; validate token,
  request ownership, mime (pdf/images), size cap; store as new
  `document_version`; request status → `submitted`.
- Client download button → API issues short-lived presigned GET.
- Portal cards: drag-and-drop + file picker + submit; version list on the
  client Document Card.

**Done when:** upload from portal flips status, file downloads from the
client app via signed URL; re-upload creates version 2.

## Phase 4 — Review loop (human)
- Mark accepted / mark incomplete on the current version; incomplete REQUIRES
  a reason; writes `decided_status`/`decided_at` + `human_review`; request
  status follows.
- Portal shows incomplete reason under the indicator; re-upload resets to
  `submitted` and clears the visible message.
- Per-requirement human corrections UI on the Document Card (parallel to AI
  results — works even before AI exists, seeded from requirements list).

**Done when:** full loop: request → upload → incomplete w/ reason → sub sees
reason → re-upload → accept → all-green.

## Phase 5 — AI review (Gemini)
- `@google/genai`, `gemini-2.5-flash`, enforced `responseSchema`
  (see [ai-review.md](ai-review.md)); prompt = base per-type prompt +
  requirements rows + settings free-text.
- Runs async after upload (fire-and-forget with error capture); card
  polls/refetches until `ai_review` lands; manual re-run button.
- COI `extracted.expiry_date` surfaced on card; expiring/expired flag on
  accepted certs.
- Settings page: per-doc-type additional-instructions textarea + requirements
  +/- table.
- AI verdicts prefill the incomplete reason; corrections stored in
  `human_review` without touching `ai_review`.

**Done when:** uploading a sample COI yields per-requirement pass/fail on the
card, marked as AI-generated, human can flip verdicts and accept/reject.

## Phase 6 — Email (Resend)
- Templates: initial request (portal link, doc list, due date) and follow-up
  (outstanding docs only). Send from client app (add-sub confirmation prompt +
  follow-up button on card/detail page).
- Every send logged to `email_log`; **preview mode** when `RESEND_API_KEY`
  unset (log row with null `resend_id`, render preview in UI).
- Email history visible on the subcontractor page.

**Done when:** follow-up button delivers real mail with a working portal link;
history shows request/follow-up timestamps.

## Phase 7 — Deploy + polish
- Railway: Postgres, bucket, service (Dockerfile or nixpacks: build web +
  api, run migrations on release, serve).
- `noindex` on portal, security headers, upload size limits, empty states,
  toasts, loading/pending states, seed demo data.
- Smoke-test the full loop in prod with a real email + real PDF.

**Done when:** the demo runs end-to-end on the Railway URL.

## Environment variables

### Needed from Jake
| Var | Used for | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Phase 5 | Google AI Studio key |
| `RESEND_API_KEY` | Phase 6 | optional until then; app runs in email preview mode without it |
| `RESEND_FROM` | Phase 6 | verified sender, e.g. `compliance@yourdomain.com` |

Plus: Railway project access (or Jake runs the deploy), which auto-provides
the infra vars below.

### Provided by Railway (infra)
| Var | Notes |
|---|---|
| `DATABASE_URL` | from Railway Postgres plugin |
| `BUCKET_ENDPOINT`, `BUCKET_ACCESS_KEY_ID`, `BUCKET_SECRET_ACCESS_KEY`, `BUCKET_NAME`, `BUCKET_REGION` | from Railway bucket |
| `PORT` | injected by Railway |

### App config
| Var | Notes |
|---|---|
| `APP_BASE_URL` | public URL for portal links in emails (Railway domain) |

### Local dev defaults (checked-in `.env.example`)
`DATABASE_URL` → docker Postgres; `BUCKET_*` → MinIO from docker-compose;
`APP_BASE_URL` → `http://localhost:5173`; Gemini/Resend keys blank (AI review
shows "unavailable", email in preview mode — everything else fully functional).
