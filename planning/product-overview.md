# Product Overview & Design Decisions

A lightweight RegTech demo: a general contractor (the client) collects and reviews
compliance documents from subcontractors, with AI-assisted review. Regulatory
context is in [Documentation/legal-and-regulatory-framework.md](../Documentation/legal-and-regulatory-framework.md).

## Required documents (per subcontractor)

| Document | Cadence (real world) | Demo treatment |
|---|---|---|
| Insurance Certificate (COI) | One-time, expires | Single slot; AI extracts expiry date, surfaced on card |
| W-9 | One-time | Single slot |
| Certified Payroll Report (WH-347) | Weekly (Davis-Bacon) | Single slot for demo; schema supports recurrence later |
| Monthly Workforce Report | Monthly | Single slot for demo; schema supports recurrence later |
| Diversity Certification (DBE/MBE/WBE/SBE) | One-time | Single slot — ties the demo to the FAR/§19.7 diversity story |

## Two sides of the app

### Subcontractor portal (no auth)
- Identified by unguessable token in URL (long random ID). Page is `noindex`.
- One big card-row per required document — the focus of the page.
- Each card: drag-and-drop zone + upload button + submit.
- Status indicator at the bottom of each card: **three rectangles filling left to right**:
  1. Requested (blue) / Overdue (red)
  2. Submitted (blue) / Incomplete (red)
  3. Accepted — all three turn **green** when accepted
  - Unreached rectangles are gray/empty.
- Below the indicator: message area showing the *why* when a doc is incomplete
  (this is the client's per-requirement rejection reason — visible to the sub).
- Re-upload on an incomplete doc creates a new version, resets status to
  `submitted`, and clears the visible incomplete message.

### Client app
- **Dashboard** — card per subcontractor showing each document + current status.
  "Add subcontractor" button → modal collecting name, email, and a due date for
  their documents.
- **Subcontractor page** — editable name/email/due date; per-subcontractor
  internal note (NOT visible to the sub); one Document Card per required doc
  type (whether or not a file exists) with:
  - status, download button (signed URL), AI review results
  - "Mark accepted" and "Mark incomplete" buttons when a version exists
  - Marking incomplete REQUIRES a reason before saving
- **Settings** — AI review configuration (see [ai-review.md](ai-review.md)):
  per-doc-type additional instructions + a +/- requirements table.

## Status model

Stored enum on the document request: `requested | submitted | incomplete | accepted`.

- **Overdue is derived, never stored**: `status == requested && now > due_date`.
- Lifecycle: `requested → submitted → (accepted | incomplete)`;
  `incomplete → submitted` on re-upload. Loop repeats until accepted.
- All presentation (rectangle colors) derives from the enum + due date.

## Decision log

1. **Resubmission loop with version history.** Every upload is an immutable
   version; prior versions are retained. The audit trail (what was submitted,
   when, what was rejected and why) is the compliance asset.
2. **Document requests as first-class rows** (not columns on subcontractor), so
   recurring docs (weekly payroll, monthly workforce) are a follow-up feature,
   not a rewrite. Demo shows one slot per doc type.
3. **PII handling even in demo**: W-9s contain SSN/EIN. Private storage bucket,
   short-lived signed URLs for downloads, no public file URLs, no document
   contents in logs. Files go to Gemini server-side only.
4. **AI is advisory, human decides.** AI review runs automatically on upload and
   renders on the Document Card, clearly marked as AI-generated. The user can
   correct it per requirement; we store the AI's verdict and the human's
   decision as parallel data. Accept/incomplete is always a human action (AI
   reason can prefill the incomplete message).
5. **Per-doc-type AI configuration**, not one global instruction blob.
6. **Due date stored per document request**, initialized from the sub-level due
   date collected in the add-subcontractor modal (which remains the only due
   date UI for now).
7. **Email via Resend** (API key to be provided by Jake). Every send is logged
   (type, timestamp, recipient) — the request/follow-up history is itself the
   good-faith-efforts paper trail the FAR framework cares about.
   If no key present, emails are logged/previewed instead of sent.
8. **Per-subcontractor internal note**, separate from per-document incomplete
   reasons (which are sub-visible).
9. **Insurance expiry surfaced**: AI extracts COI expiration date; card flags
   accepted-but-expiring/expired certs.

## Explicitly out of scope (for now)

- Subcontractor auth (magic-link token only)
- Recurring document periods (schema-ready, no UI)
- Table/list dashboard view at scale

Tech stack is decided — see [tech-stack.md](tech-stack.md): everything on
Railway (one service serving SPA + API), Vite/React/shadcn, Hono, Drizzle,
Zod v4, `@google/genai`, Resend, Yarn workspaces.
