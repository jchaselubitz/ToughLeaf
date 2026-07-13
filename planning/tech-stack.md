# Tech Stack

## Hosting — everything on Railway
| Piece | Where | Notes |
|---|---|---|
| Frontend (SPA) + API | one Railway service | Hono serves `/api/*` routes and the built Vite assets from `apps/web/dist` — single origin, no CORS, one deploy, one URL for portal links in emails |
| Postgres | Railway | plain Postgres |
| File storage | Railway bucket | S3-compatible; **private**; standard AWS S3 SDK |

Long-running Node service — no serverless timeout pressure on the Gemini call.

## Application
| Concern | Choice | Notes |
|---|---|---|
| Frontend | Vite + React + TypeScript | SPA; React Router; TanStack Query for server state |
| UI | shadcn/ui + Tailwind v4 | dialogs/forms/toasts from shadcn; status rectangles + drag-drop cards are custom |
| Backend | Hono (Node, TypeScript) | small, typed; multipart upload handling |
| ORM | Drizzle | schema-first: typed tables → drizzle-kit generated migrations; relational query API fits our nested reads; chosen over Kysely (better query builder, but hand-written migrations + codegen sync loop + no Zod generation — wrong tradeoff for a greenfield demo) |
| Validation | Zod **v4** | API inputs; schemas shared via workspace package; `drizzle-zod` (v4-compatible) generates table schemas |
| AI | `@google/genai` | current unified SDK; `gemini-2.5-flash`; `responseSchema` for enforced JSON; inline PDF bytes; backend-only |
| Email | Resend | key provided by Jake; without a key, sends are logged/previewed (email_log row with null resend_id) |
| Package manager | Yarn workspaces | monorepo |

## Repo layout
```
apps/
  web/        # Vite SPA (client app + subcontractor portal)
  api/        # Hono service (uploads, signed URLs, Gemini, Resend)
packages/
  shared/     # status enum, doc type slugs, AI review result types, zod schemas
planning/     # these docs
```

## Key flows
- **Serving**: Hono mounts API routes under `/api/*` and serves the SPA build
  (static assets + index.html fallback for client-side routes) for everything
  else. Frontend calls the API with relative paths.
- **Upload**: browser → API (multipart, portal token validated, size/mime
  checked) → S3 bucket. Not presigned browser PUTs — keeps PII posture and
  validation server-side.
- **Download**: API issues short-lived presigned GET URL.
- **AI review**: runs async on the API after upload; card polls/refetches
  until `ai_review` lands on the version.

## Environment variables
| Var | Service |
|---|---|
| `DATABASE_URL` | api |
| `BUCKET_*` (endpoint, key id, secret, name) | api |
| `GEMINI_API_KEY` | api |
| `RESEND_API_KEY` | api (optional → preview mode) |
| `APP_BASE_URL` | api (portal links in emails) |

No `VITE_API_URL` needed — same origin, relative `/api` paths.
