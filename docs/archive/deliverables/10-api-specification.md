# API Requirements & Specification

> Deliverable 15. Only the APIs the platform actually needs. Express.js REST, JSON bodies, versioned under `/api/v1`. Two surfaces: **Public** (render + assess) and **Admin** (builder, JWT-protected).

## Conventions

- Envelope: success → `{ data: … }`; error → `{ error: { code, message, fields? } }`
- Validation errors: HTTP 422 with `fields: { <paramKey>: "message" }`
- All public config reads are cacheable (`ETag` on `slug@version`)
- Admin auth: `Authorization: Bearer <JWT>`; roles: `admin`, `editor`

---

## 1. Public APIs

### 1.1 List published calculators
`GET /api/v1/calculators`
- **Purpose:** calculator listing page
- **Response:** `{ data: [ { slug, name, shortDescription, tags, version } ] }`
- **Validation:** none. **Depends on:** `calculators` (status=published)

### 1.2 Get renderable calculator config
`GET /api/v1/calculators/:slug`
- **Purpose:** everything the Dynamic Renderer needs to draw the form
- **Response:** published `CalculatorVersion` projection: `{ slug, name, version, parameters[], uiConfig, resultCategories(display bands only), disclaimers }` — scoring internals (points) are **stripped** so the client can't trivially reverse-engineer scoring and, more importantly, so scoring stays server-authoritative
- **Errors:** 404 unknown/unpublished
- **Depends on:** `calculator_versions` cache

### 1.3 Run an assessment
`POST /api/v1/calculators/:slug/assess`
- **Purpose:** validate → normalize → execute engine → persist → return result
- **Request:**
```json
{
  "inputs": { "sex": "male", "age": 44, "hdl": { "value": 0.98, "unit": "mmol/L" }, "smoking": "current" },
  "omitted": ["il-6"],
  "sessionId": "anon-uuid",
  "contact": { "email": null }
}
```
- **Response 200:**
```json
{
  "data": {
    "assessmentId": "…", "resultId": "…",
    "finalScore": 23.4,
    "category": { "label": "Fair", "color": "#fee08b", "message": "…" },
    "domainScores": [ { "domain": "cardiovascular", "label": "Cardiovascular", "score": 38.1, "weight": 0.25, "weighted": 9.53 } ],
    "keyContributors": [ { "domain": "cardiovascular", "topParams": [ { "key": "hdl", "interpretation": "low" } ] } ],
    "parameterResults": [ { "key": "hdl", "value": 37.9, "unit": "mg/dL", "interpretation": "low" } ],
    "adjustments": [ { "label": "Current smoker", "delta": 10 } ],
    "recommendations": [ "…" ],
    "calculatorVersion": 3
  }
}
```
- **Validation:** full config-driven input validation; unknown param keys rejected; unit must be in the allowed table
- **Depends on:** Validation Service, Engine, `assessments`, `results`

### 1.4 Retrieve a stored result
`GET /api/v1/results/:resultId`
- **Purpose:** shareable/revisitable result page (deep link)
- **Response:** same shape as 1.3 response
- **Errors:** 404. **Depends on:** `results`, `assessments`

### 1.5 Biomarker library
`GET /api/v1/biomarkers?domain=&search=` and `GET /api/v1/biomarkers/:key`
- **Purpose:** biomarker browsing + detail pages (NirogGyan-style reference), and "learn more" links from form fields/results
- **Response (detail):** `{ key, displayName, altNames, domain, description, whatItMeasures, whyItMatters, units, referenceModel, interpretationText, sources[] }`
- **Depends on:** `biomarkers`

---

## 2. Admin APIs (JWT)

### 2.1 Auth
`POST /api/v1/admin/auth/login` → `{ token }` (email + password, bcrypt, rate-limited)

### 2.2 Calculator lifecycle
| Method & path | Purpose |
|---|---|
| `POST /api/v1/admin/calculators` | Create calculator (basic details) → auto-creates draft version 1 |
| `GET /api/v1/admin/calculators` | List all incl. drafts/archived |
| `GET /api/v1/admin/calculators/:id` | Detail incl. version history |
| `PATCH /api/v1/admin/calculators/:id` | Rename/describe/tag/archive |

### 2.3 Version (configuration) editing
| Method & path | Purpose |
|---|---|
| `GET /api/v1/admin/versions/:versionId` | Full draft config |
| `PUT /api/v1/admin/versions/:versionId` | Save draft config (any subset: parameters, scoringRules, domains, adjustmentRules, formulas, resultCategories, uiConfig). Optimistic concurrency via `If-Match` rev. |
| `POST /api/v1/admin/calculators/:id/versions` | New draft from current published (edit-by-copy) |
| `POST /api/v1/admin/versions/:versionId/validate` | Run `configValidator` → `{ valid, problems: [ { path, severity, message } ] }` |
| `POST /api/v1/admin/versions/:versionId/preview` | Dry-run engine with sample inputs; nothing persisted. Request `{ inputs }` → full result **plus trace** (admin sees the trace; public API does not) |
| `POST /api/v1/admin/versions/:versionId/publish` | Validate (hard-fail on errors) → mark published → bump `calculators.currentVersion` → invalidate cache. Body: `{ changelog }` |
| `POST /api/v1/admin/versions/:versionId/retire` | Unpublish |

### 2.4 Biomarker library management
`POST/PUT/GET /api/v1/admin/biomarkers[...]` — CRUD + source-attribution editing; `status` transitions (`draft → verified` requires at least one source entry — enforced).

### 2.5 Assessments (read-only analytics)
`GET /api/v1/admin/assessments?calculator=&from=&to=` — volumes, score distribution (aggregation pipeline), lead-capture export.

---

## 3. Cross-cutting requirements

| Concern | Requirement |
|---|---|
| Input sanitation | `express-validator` at the boundary + config-driven validation inside; reject unknown fields |
| Rate limiting | Public assess endpoint per-IP limiter (lead-magnet abuse control) |
| CORS | Public GET/POST from configured origins |
| Errors | Central error middleware; no stack traces to clients |
| Health | `GET /healthz` (liveness), `GET /readyz` (Mongo ping) |
| Audit | Every 2.2–2.4 write appends to `audit_logs` |
| Versioning discipline | Published versions immutable — `PUT` on a published version returns 409 |

## 4. Dependency map

```
Public UI ──► 1.1 / 1.2 ──► config cache ──► calculator_versions
          ──► 1.3 ──► Validation ──► Engine ──► assessments + results
          ──► 1.4 / 1.5
Admin UI  ──► 2.2 / 2.3 ──► configValidator ──► calculator_versions (drafts)
          └─► 2.3 preview ──► SAME Engine (dogfooding — proves config before publish)
```
