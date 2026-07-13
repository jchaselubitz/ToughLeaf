# AI Document Review (Gemini 2.5 Flash)

## Flow

1. Sub uploads a file → new `document_versions` row, request status → `submitted`.
2. Backend function (never the browser) sends the file to Gemini 2.5 Flash —
   PDFs/images natively supported.
3. Result is stored as `ai_review` on that specific version (a re-upload
   visibly triggers a fresh review).
4. Document Card renders the per-requirement pass/fail list, clearly labeled
   as AI-generated.
5. The user may correct any requirement verdict; corrections are stored in the
   parallel `human_review` field — we never overwrite what the AI said.
6. Accept / mark-incomplete remains a human action. Failed requirements prefill
   the incomplete reason (editable before saving; a reason is mandatory).
7. A manual "re-run AI review" button exists on the Document Card.

## Prompt composition (per document type)

1. **Base system prompt** (ours, hardcoded): role, document type, what the doc
   is, instruction to evaluate each requirement independently and cite what it
   sees; instruction to also extract metadata (e.g. COI expiration date).
2. **Requirements list**: all `requirements` rows for the doc type — seeded
   defaults plus user-added rows from the settings +/- table. Each row is sent
   with its id so results map back deterministically.
3. **Additional instructions**: the per-doc-type free-text field from settings.

## Enforced JSON via `responseSchema`

Dynamic requirement names can't be object keys in a fixed schema, so the
response is an **array of requirement results**:

```json
{
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "requirement_id": { "type": "string" },
          "requirement":    { "type": "string" },
          "pass":           { "type": "boolean" },
          "reason":         { "type": "string", "description": "Required when pass is false; cite what was seen or missing" }
        },
        "required": ["requirement_id", "requirement", "pass"]
      }
    },
    "extracted": {
      "type": "object",
      "properties": { "expiry_date": { "type": "string", "description": "ISO date, insurance certificates only" } }
    },
    "summary": { "type": "string" }
  },
  "required": ["results"]
}
```

Set `responseMimeType: "application/json"` + `responseSchema`; low temperature.

## Seeded default requirements (starting point, editable in settings)

- **Insurance Certificate**: names the subcontractor as insured; general
  liability coverage present with limits shown; additional insured
  endorsement; not expired / expiration date legible.
- **W-9**: current IRS revision; legal name and TIN present; tax
  classification checked; signed and dated.
- **Certified Payroll (WH-347)**: project and contractor identified; payroll
  number and week ending date present; employee classifications and rates
  listed; statement of compliance signed.
- **Monthly Workforce Report**: reporting month identified; workforce counts
  present; totals internally consistent.
- **Diversity Certification**: issuing agency identified; certification type
  (DBE/MBE/WBE/SBE) stated; business name matches; not expired.

## Failure handling

- Gemini error or unparseable response: version saved normally, `ai_review`
  left null with the error noted; card shows "AI review unavailable — retry";
  human review proceeds regardless (AI is advisory, never blocking).
- Timeouts: review runs async after upload; the card shows a pending state.
