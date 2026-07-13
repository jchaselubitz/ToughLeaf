# Data Model

Three-layer document model: **type → request → version**. Status and due date
live on the *request* (the slot exists and is `requested` before any file
does). Files, AI output, and human review live on immutable *versions*.

```
subcontractors 1──* document_requests *──1 document_types
                          │
                          1──* document_versions
subcontractors 1──* email_log
document_types 1──* requirements
```

## Tables

### `subcontractors`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | |
| email | text | |
| portal_token | text unique | long random; identifies the sub portal URL |
| note | text | internal, never shown to sub |
| certification_type | text nullable | e.g. DBE/MBE/WBE/SBE — future dashboard rollup |
| created_at | timestamptz | |

The due date collected in the add-subcontractor modal is written onto the five
document requests created at insert time (no due date column here).

### `document_types` (seeded)
| column | type | notes |
|---|---|---|
| id | text pk (slug) | `insurance_certificate`, `w9`, `certified_payroll`, `workforce_report`, `diversity_certification` |
| name | text | display name |
| description | text | shown on portal cards |
| recurring | boolean | informational for now; no period UI in demo |
| sort_order | int | card ordering |

### `document_requests`
One row per subcontractor × document type, created when the sub is added.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| subcontractor_id | uuid fk | |
| document_type_id | text fk | |
| status | enum | `requested \| submitted \| incomplete \| accepted` |
| due_date | date | initialized from modal; **overdue is derived**, not stored |
| period | text nullable | unused in demo; reserved for recurring docs |
| created_at / updated_at | timestamptz | |

Unique on (subcontractor_id, document_type_id, period).

### `document_versions`
Immutable. A new upload = new row; the request's status flips to `submitted`.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| request_id | uuid fk | |
| storage_path | text | private bucket; downloads via short-lived signed URL |
| filename / mime_type / size_bytes | | upload metadata |
| ai_review | jsonb nullable | full AI result (see ai-review.md), tied to THIS version |
| ai_reviewed_at | timestamptz nullable | |
| extracted | jsonb nullable | AI-extracted metadata, e.g. `{ "expiry_date": "2026-09-01" }` for COIs |
| human_review | jsonb nullable | parallel per-requirement decisions (see below) |
| decided_at / decided_status | timestamptz / enum nullable | outcome of review of this version (`accepted` or `incomplete`) |
| uploaded_at | timestamptz | |

The "current" version is the latest by `uploaded_at`. The sub-visible
incomplete message is derived from the current version's `human_review`
failed requirements (falling back to a free-text reason field within it).

#### `ai_review` / `human_review` shape (stored verbatim, parallel keys)
```json
{
  "results": [
    { "requirement_id": "uuid-or-builtin-slug",
      "requirement": "Additional insured endorsement present",
      "pass": false,
      "reason": "No additional insured box checked on the certificate." }
  ],
  "summary": "..."
}
```
`human_review` mirrors `results` with the user's corrected pass/fail + reason
per requirement, so we always retain what the AI said vs. what the human decided.

### `requirements` (settings +/- table)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| document_type_id | text fk | |
| text | text | one requirement, one row; sent to Gemini per doc type |
| seeded | boolean | shipped defaults; user can edit/delete |
| created_at | timestamptz | |

### `settings`
Key/value (or one row per doc type): per-doc-type free-text **additional
instructions** appended to our base prompt. Requirements rows come from the
table above.

### `email_log`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| subcontractor_id | uuid fk | |
| kind | enum | `request \| follow_up` |
| to_email / subject | text | |
| resend_id | text nullable | null when running without a Resend key (preview mode) |
| sent_at | timestamptz | |

This log doubles as the good-faith-efforts paper trail.
