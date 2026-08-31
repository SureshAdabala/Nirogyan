# Niro Health Calculator Platform — MERN Implementation Plan

**Prepared:** 2026-08-20 · **P0A reconciled:** 2026-08-21 · **Derived from:** complete analysis of all 66 files in `C:\athnect`, including current and backup catalog data, every deliverable/archive/config/research/transcript, the Risk Analysis PDF/XLSX, all Office artifacts, and all utility scripts.
**Companion files:** [Claude-Context.md](Claude-Context.md) — condensed project context; [packages/contracts/README.md](packages/contracts/README.md) — normative P0A schemas, semantic contracts, validation report, discrepancy matrix, and architecture decisions. Where this plan's older implementation detail conflicts with the P0A package, the P0A package governs.

---

## 1. Project Understanding

**What this is.** A public, SEO-optimized hub of health/risk calculators for Niro (NirogGyan) — a "smart, patient-friendly blood reports" company (B2B primary, B2C tool secondary). The client's own words (Audio 2/3): it is a **lead magnet** to attract organic search traffic, modeled on their programmatic biomarkers pages (which won SEO on long-tail terms) and loosely on Omni Calculator ("it's all purana [old]" — build **smaller, smarter, interlinked**).

**The single strongest architectural directive** (Audio 2, verbatim): _"back-end should also be such that creating a new calculator becomes very straightforward and even a non-tech guy can do that — calculator as well as associated content."_ → **Calculators are configuration data, not code.** One generic engine + one generic renderer execute any calculator defined as a versioned JSON config. Adding the Nth calculator is a data event: no new pages, services, or deploys.

**Current calculator artifacts (five; publication status reconciled in P0A):**

| Calculator                                         | Source                                                                            | Status                                                                                                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comprehensive Wellness Score (CWS)                 | `data/sources/risk-analysis/Comprehensive Wellness Score Framework...pdf` (18 pp) | ⚠️ PDF carries comment **"This has been rejected because of no stratified ranges available for client"** → build fully, hold publish until Niro confirms (clarification **N1**) |
| Heart Risk ("Modified Cardiovascular Risk Engine") | `data/sources/risk-analysis/Risk calculators.xlsx` → sheet "Heart "               | Source-designated ACTIVE; P0A publish-blocked pending discrepancy closure, full tests/content, and medical review                                                               |
| Diabetes Risk (IDRS-based)                         | same XLSX → sheet "Diabetes"                                                      | Source-designated ACTIVE; P0A publish-blocked pending discrepancy closure, full tests/content, and medical review                                                               |
| Hypothyroid Risk                                   | same XLSX → sheet "Hypothyroid"                                                   | Source-designated ACTIVE; P0A publish-blocked pending discrepancy closure, full tests/content, and medical review                                                               |
| COVID-19 Risk Check (demo)                         | `data/fixtures/config-samples/covid-risk.config.json`                             | Internal draft fixture only; point values are illustrative/non-clinical and it is not the Reusability Gate calculator                                                           |

**Scope boundaries (Audio 3):** standalone from NirogGyan's existing codebase for the assignment, but integration-quality code because it may be merged later. Client permits 2–3 live calculators at launch; the architecture must scale to a large catalog.

**Prior work in the archive.** The `docs/archive/deliverables/` folder is a complete design pass (data model, API spec, engine design, admin-builder design, testing strategy, 5 draft config samples). This plan **adopts and extends** that design — it does not restart it. Known staleness: files `01/04/05/06` and `data/fixtures/config-samples/biomarker-dataset.json`'s `niroScoring` blocks still say "Niro Risk Logic Sheet NOT PROVIDED"; that predates the 2026-08-18 arrival of the Risk Analysis folder. **Authoritative for Niro scoring:** the `data/sources/risk-analysis/` PDF/XLSX originals; `docs/research/niro-risk-logic-extraction.md` and `data/fixtures/config-samples/*.config.json` are derived transcriptions and never override an original-source discrepancy.

---

## 2. Requirements Identified from the Files

### From the client audio (highest authority)

- R1. SEO-optimized public hub of interlinked calculators; per-page programmatic meta info (proven pattern from biomarkers pages; target long-tail/offbeat terms).
- R2. Every calculator page pairs the interactive calculator with **associated content** (heart-risk calculator + heart-risk article is the canonical example).
- R3. Non-technical people create calculators **and their content** through an admin tool.
- R4. **Partial risk score** when only questionnaire inputs exist; full score when lab biomarkers exist ("partial risk score is normal" — Niro behavior).
- R5. Implement 2–3 calculators; scale-ready architecture; "simple backend"; standalone; lead magnet; looks good.
- R6. Process: approach + deadline + questions before output; optional Claude/MCP keyword research to plan the calculator roadmap (C11 — content roadmap, out of platform-build scope).

### From the master brief (`NIRO_Project_Source_Context_and_Implementation_Brief.txt`)

- R7. Deterministic wellness/risk engine strictly separated from explanation/presentation; auditable, predictable, testable.
- R8. Do not invent clinical rules — every threshold/weight/formula from source files; unknowns marked **Needs Clarification**, never assumed.
- R9. Result hierarchy (fixed): RESULT → CATEGORY → WHY/KEY CONTRIBUTORS → DOMAIN DETAILS → BIOMARKER DETAILS → RECOMMENDATIONS.
- R10. Sex/context-dependent rules, units and conversions, demographic inputs.

### From the Risk Analysis sources (scoring truth)

- R11. CWS: 9 weighted domains (25/20/15/10/10/5/5/5/5), ~40 parameters (38 lab biomarkers + SBP vital + derived eAG counted variously as "38"), point bands per parameter (incl. negative protective points for HDL and physical activity), domain score = Σpoints/maxPoints×100, raw = weighted sum, final = raw + adjustments (age 0–4, BMI 0–4 U-shaped, smoking 0–4, activity −2..+2), categories <10 Optimal / 10–20 Good / 21–30 Fair / 31–50 Suboptimal / >50 Poor (lower-is-better).
- R12. Diabetes: IDRS factors + **glycemic index = max(HbA1c, FBS, PP scores)** ("Take only maximum"); Age mandatory; waist imputed 10 when glycemic ≥10; activity defaults Moderate(3); categories <40/40–70/>70 with escalation overrides (glycemic 10 ⇒ ≥Moderate, 20 ⇒ High).
- R13. Heart: modified Framingham points (treated/untreated/missing SBP variants; HbA1c-derived diabetic criterion; triglycerides addition) → 24-row points→risk% lookup (≤−2, −1, 0…20, 21+; note: deliverables 02/13 say "26-row" — the actual table in the XLSX/extraction/config has 24 entries) → adjusted = base × S_lipid × M_young → **final = max(adjusted, floor penalty)**; isolated high-cholesterol floors with verbatim dual patient messaging; categories <10 Low / 10–19 Intermediate / >20 High.
- R14. Hypothyroid: additive factor points (5–20 each), categories 0–15 Low / 16–35 Medium / >35 High, max 85.
- R15. Verbatim patient messaging strings from the sources must surface in the UI.

### From the deliverables (platform design)

- R16. Immutable versioned calculator configs; results reference exact `calculatorVersionId` + `engineVersion`; full reproducibility.
- R17. Three-class source traceability on every medical value: `niro | external | needs-clarification` — conflicts surfaced side-by-side, never merged (19+ recorded inter-authority conflicts).
- R18. Server-authoritative scoring (public config API strips points/bands); admin preview runs the SAME engine with trace.
- R19. Reusability Gate: a genuinely new calculator built via Admin UI only, with CI-verified byte-identical `packages/engine/`, `apps/client/.../renderer/`, and `apps/client/.../result/`.
- R20. Performance: assess round-trip p95 < 300 ms; anonymous-first (no login, optional email lead capture, never gating results).

### New requirements from this assignment (your prompt)

- R21. Admin Login + Admin Dashboard with meaningful analytics (visitors, sessions, engagement, feature usage, growth, security events, app health) — designed for what this app actually is (anonymous-first public tool + small admin team). See §8.

---

## 3. Functional Features

**Public site**

1. Calculator directory (cards, categories, search) — `/`
2. Calculator page — intro/content + multi-step dynamic form (config-driven steps, unit switching, inline validation, and a missing/not-applicable control only where the declared policy permits it) — `/c/:slug`
3. Result page — score gauge, category, key contributors, domain breakdown, biomarker drill-in, recommendations, dynamic coverage notices (`scoredCount` of `applicableScoredParameterCount`, with measured-lab coverage reported separately), random-capability share link `/results/:shareToken`, retake, optional email capture
4. Biomarker library — browse by domain/A–Z, search, detail pages with reference ranges, conflicts shown per organization, "where does this range come from?" provenance reveal — `/biomarkers`, `/biomarkers/:key`
5. SEO: per-page meta (title/description/OG/JSON-LD), sitemap.xml, interlinking calculators ↔ biomarkers ↔ related calculators
6. Educational disclaimers per calculator; "your lab's ranges take precedence" caveat

**Engine (pure module)** 7. Dependency-ordered pipeline: validate → normalize → derive/contextualize/score/aggregate/impute/formula evaluation as a validated DAG → weight/adjust/floor → categorize → explain-data (+ trace) 8. Primitives: numeric bands (mixed edge semantics), option points, condition DSL (all/any/not; eq/ne/gt/gte/lt/lte/in/between/exists/missing), demographic contexts, derived params (topo-sorted `dependsOn`), unit conversion, weighted domains, additive adjustments, direction-aware categories, missing policies (`exclude-from-max | zero-points | block | impute-rule | default-option | exclude-from-group`) 9. Extended primitives (required by real Niro calculators): `max()` group aggregation, lookup tables (`lookup('key', value)` with orBelow/orAbove + display strings), multiplicative/ternary expressions, imputation rules, floor rules + category overrides (`minCategory`)

**Admin (Calculator Studio / Admin Builder)** 10. JWT login (roles: `admin`, `editor`), account lockout, session handling 11. 7-step builder: ① Basic details ② Parameters (biomarker picker) ③ Scoring & rules (visual band editor, context tabs, condition builder) ④ Domains & formulas (live weight-sum meter) ⑤ Result categories (coverage bar) ⑥ UI layout + content/SEO fields ⑦ Preview (real engine + trace) → Validate → Test cases → Publish 12. Version lifecycle: draft (edit-by-copy) → validate → publish (immutable, cache-invalidated, audited) → retire; one-click rollback (= republish as new version) 13. Biomarker library CRUD with mandatory source attribution (draft → verified requires ≥1 source) 14. Saved test cases per calculator (`{name, inputs, expected {score?, category?}}`); "Run all"; required/source/golden failures block publish while explicitly optional tests may warn 15. **Admin Dashboard + analytics** (see §8): traffic, funnels, score distributions, leads, security, ops health 16. Audit log viewer; version history with diff summaries

---

## 4. Non-Functional Requirements

| Category        | Requirement                                                                                                                    | Source                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Performance     | assess p95 < 300 ms server-side; immutable config cache keyed `slug@version` with cross-instance invalidation/version checking | 07 §6, 16; P0A ADR-025 |
| Determinism     | engine pure (no I/O/clock/randomness); results reproducible from versionId + engineVersion + inputs                            | brief §10, 13          |
| Traceability    | 100% of medical values tagged niro/external/NC (CI-enforced integrity script)                                                  | 05, 16 §5              |
| Reusability     | zero calculator-specific engine/renderer code; CI grep: no "niro"/"covid" strings in `engine/`                                 | 16 §3                  |
| Security        | server-authoritative scoring; JWT + bcrypt; rate limiting; sanitation; no stack traces to clients                              | 07, 10                 |
| Privacy         | anonymous-first; no PII required; optional email only; configurable TTL retention on assessments                               | 07 §6                  |
| SEO             | per-page meta, crawlable public pages, sitemap, fast LCP                                                                       | Audio 1/2              |
| Accessibility   | labels/aria, keyboard-completable flow, focus management, text equivalents for charts; axe scan clean                          | 11, 16                 |
| Compliance      | educational disclaimers; not-a-diagnosis language; lab-variance caveats                                                        | configs                |
| Maintainability | monolith (no microservices — brief warns against over-engineering); engine extractable as pure module                          | 07 §5                  |

---

## 5. Recommended MERN Architecture

**Shape: a modular monolith, two deployable units + two shared packages (`contracts` and the pure `engine`).**

```
                        ┌────────────────────────────────────────────┐
   Visitor ──────────►  │  WEB (React)                               │
   Admin ────────────►  │  public: directory / calculator / results  │
                        │          biomarker library  (SEO-rendered) │
                        │  admin:  Calculator Studio (CSR SPA)       │
                        └───────────────┬────────────────────────────┘
                                        │ REST /api/v1  (JSON, ETag)
                        ┌───────────────▼────────────────────────────┐
                        │  API (Node + Express)                      │
                        │  routes → controllers → services           │
                        │  ├─ Config Service (cache, versions)       │
                        │  ├─ Validation Service (runtime, config-   │
                        │  │   driven)                               │
                        │  ├─ ENGINE (pure pkg, dependency DAG)     │
                        │  ├─ Config Validator (shared w/ builder)   │
                        │  ├─ Result/Insight Service                 │
                        │  ├─ Auth (JWT, roles) · Audit · Analytics  │
                        │  └─ Jobs (scheduler/lease: rollups,        │
                        │      checks, backups)                      │
                        └───────────────┬────────────────────────────┘
                                        │ Mongoose
                        ┌───────────────▼────────────────────────────┐
                        │  MongoDB                                   │
                        │  calculators · calculator_versions ·       │
                        │  biomarkers · assessments · results ·      │
                        │  admin_users · audit_logs ·                │
                        │  analytics_events · analytics_daily ·      │
                        │  leads · login_attempts                    │
                        └────────────────────────────────────────────┘
```

**Monorepo layout**

```
niro-platform/
├─ package.json               # npm workspaces
├─ packages/
│  ├─ contracts/              # P0A schemas/specs/registers; P0B adds TS types + validator package
│  └─ engine/                 # PURE — zero deps on server/client; the reusability-gate hash target
│     ├─ src/{index,validate,normalize,derive,conditions,expressions,
│     │        score,aggregate,adjust,categorize,contributors,trace}.ts
│     ├─ src/configValidator.ts     # shared by publish + builder Validate
│     └─ test/  (unit + golden files + auto-generated boundary matrix)
├─ apps/server/
│  ├─ src/
│  │  ├─ app.ts  server.ts  config/env.ts  db/connect.ts
│  │  ├─ routes/        (public/, admin/)
│  │  ├─ controllers/   services/   models/   middleware/
│  │  ├─ jobs/          (aggregateDaily, retention, linkCheck)
│  │  └─ seed/          (biomarkers, configs, admin user)
│  └─ test/  (supertest integration)
├─ apps/client/                    # public site + admin (see §9 for SSR decision)
│  └─ src/{app,api,engine-types,renderer,result,biomarkers,directory,admin,analytics}
├─ data/fixtures/config-samples/ # existing 5 untouched drafts; expected-diagnostic fixtures only
└─ .github/workflows/ci.yml
```

**Key architectural decisions (adopted from 07 §5, confirmed here)**

1. Monolith MERN; engine as a pure workspace package (extractable later for NirogGyan integration).
2. Calculator versions embed every runtime scoring/content/measurement dependency needed for audit-grade reproducibility. `biomarkerKey` and measurement revision IDs link to the shared authoring/library record, but a later library edit never changes an old version or result.
3. Same `configValidator` + same engine for builder preview and production ("worked in admin, broke in prod" prevention).
4. Public config API strips scoring internals (Niro thresholds are proprietary; scoring is server-authoritative).
5. Anonymous-first; persistent pseudonymous `visitorId` is distinct from inactivity/session-scoped `sessionId`; email never blocks results and is submitted separately.
6. No `eval` anywhere: conditions use an interpreted DSL and formulas use the P0A-constrained parser contract (allowlisted syntax/functions, declared identifiers, AST/resource limits). The exact parser library remains a P0B/P2 selection under ADR DEF-006.

---

## 6. MongoDB Setup and Database Design

_(Written for someone new to MongoDB.)_

### 6.1 What MongoDB is, in this project's terms

MongoDB stores JSON-like **documents** in **collections** (≈ tables without fixed columns). This project is an ideal fit: a calculator config _is_ a JSON document; versioning is "insert a new document"; no JOIN-heavy relations. You access it from Node via **Mongoose** (schemas, validation, indexes in code).

### 6.2 Development database setup — MongoDB Atlas (canonical)

This project uses MongoDB Atlas through its browser/cloud service for development and staging. MongoDB server software is not installed locally. Create an Atlas project, deploy a development cluster (M0 Free where available, or the smallest transaction-capable paid tier), create a least-privilege database user, and add the developer's current public IP as a `/32` project access-list entry. Atlas deployments provide the replica-set topology required by the P0A transaction contract; use the SRV URI supplied by Atlas rather than a standalone local URI.

The exact browser walkthrough and troubleshooting checklist are in the delivery summary for P1 Task 1. The repository only stores `.env.example` placeholders; the real URI and password remain in the ignored root `.env` file or a secrets manager.

### 6.3 Environment configuration

```text
# Project-root .env (MongoDB Atlas; never commit this file)
NODE_ENV=development
PORT=4000
CLIENT_PORT=3000
MONGODB_URI=mongodb+srv://<dbUser>:<urlEncodedPassword>@<cluster-host>/niro_dev?retryWrites=true&w=majority&appName=niro-platform
MONGODB_DB_NAME=niro_dev
AUTH_ACCESS_SECRET=<independent high-entropy secret>
AUTH_REFRESH_SECRET=<different independent high-entropy secret>
CORS_ORIGINS=http://localhost:3000
ASSESSMENT_RETENTION_DAYS=<approved positive integer>
ANALYTICS_HASH_SECRET=<independent high-entropy secret>
ANALYTICS_IDENTITY_KEY_VERSION=<approved non-secret version label>
ANALYTICS_EVENTS_RETENTION_DAYS=<approved positive integer>
ANALYTICS_REPORTING_TIMEZONE=Asia/Kolkata
ANALYTICS_JOB_LEASE_SECONDS=<approved positive integer>
ANALYTICS_MIN_COHORT_SIZE=<approved integer from 2 through 100>
ANALYTICS_VISITOR_PERSISTENCE_ENABLED=false
ANALYTICS_VISITOR_RETENTION_DAYS=
ANALYTICS_VISITOR_CONSENT_VERSION=
LEAD_RETENTION_DAYS=
LEAD_CONSENT_VERSION=

# Browser-exposed policy/origin values (never secrets)
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE=Asia/Kolkata
NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED=false
NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS=
NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION=
NEXT_PUBLIC_LEAD_CAPTURE_ENABLED=false
NEXT_PUBLIC_LEAD_CONSENT_VERSION=
NEXT_PUBLIC_LEAD_CONSENT_TEXT=
```

Server development and CLI entry points resolve the ignored project-root `.env` deterministically; deployment injects the same names through its secret manager. `MONGODB_URI`, authentication secrets, and `ANALYTICS_HASH_SECRET` are server-only. The matching non-secret `NEXT_PUBLIC_ANALYTICS_*` and `NEXT_PUBLIC_LEAD_*` policy switches are documented in `.env.example`; they do not replace the required server policy. Configuration validation remains fail-closed. Commit `.env.example`, never `.env` or a credential-bearing environment file.

### 6.4 Collections (18 implemented collections)

The original documents proposed 11 collections. P0A retains them as a baseline and requires explicit session, visitor-state, and job persistence. Required test cases, content, review hashes, and measurement snapshots live inside immutable calculator versions in v1.

| #   | Collection                        | Purpose                                                                                                                                                          | Growth                                                              |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | `calculators`                     | Identity + lifecycle pointer per calculator (slug, status, currentVersion, draftVersion)                                                                         | tiny                                                                |
| 2   | `calculator_versions`             | **Immutable** config + content + citation + review/test evidence snapshots governed by `packages/contracts`                                                      | small                                                               |
| 3   | `biomarkers`                      | Versioned measurement/biomarker revisions; mutable current pointer is never a runtime scoring dependency                                                         | ~40–250 docs                                                        |
| 4   | `assessments`                     | Submitted inputs (entered + canonical + conversion hashes), omitted/not-applicable fields, visitorId, sessionId, expiry, clientMeta; no embedded contact email   | high                                                                |
| 5   | `results`                         | Engine output, coverage, trace, dependency hashes, expiry, and hashed random share-capability state                                                              | high (exactly 1:1 with assessments in v1; `assessmentId` is unique) |
| 6   | `admin_users`                     | email, passwordHash, roles/permissions including medical reviewer, lockout fields                                                                                | tiny                                                                |
| 7   | `audit_logs`                      | Every admin write: actorId, action (`version.publish`…), entity, entityId, diffSummary, at                                                                       | medium                                                              |
| 8   | `analytics_events`                | Raw telemetry beacons (see §8.3) — TTL-expired                                                                                                                   | very high                                                           |
| 9   | `analytics_daily`                 | Pre-aggregated per-day/per-calculator rollups the dashboard reads                                                                                                | small                                                               |
| 10  | `leads`                           | Captured emails only: normalized email, consent/version, createdAt, TTL expiry; v1 prohibits visitor/calculator/assessment/result/share/health linkage (ADR-032) | low                                                                 |
| 11  | `login_attempts`                  | Admin auth attempts with minimized/hashed network evidence and TTL; feeds lockout/security                                                                       | low                                                                 |
| 12  | `admin_sessions`                  | Hashed rotating refresh-token families, device/session metadata, expiry, revoke/reuse-detection state                                                            | low                                                                 |
| 13  | `anonymous_visitors`              | Pseudonymous firstSeen/lastSeen and retention-window state only when approved for analytics; no health values                                                    | medium                                                              |
| 14  | `job_runs`                        | Durable scheduler/rollup/link-check status, lease/idempotency key, retries, errors, started/finished times                                                       | low                                                                 |
| 15  | `analytics_materialization_locks` | Short-lived per-timezone/reporting-day distributed mutex for rollup replacement; lease owner, heartbeat, and expiry only; released after each run                | tiny/transient                                                      |
| 16  | `analytics_attribution_claims`    | TTL-bound HMAC session evidence used as an atomic, cross-instance first-attribution claim; contains no raw session, referrer, UTM, identity, or health value     | high/transient                                                      |
| 17  | `admin_governance_locks`          | Singleton lease used to serialize governance-sensitive administrative work without weakening MongoDB transaction boundaries                                      | tiny/transient                                                      |
| 18  | `cache_invalidation_events`       | Durable publish/retire/rollback invalidation outbox with retry state, calculator scope, audit linkage, and TTL cleanup                                           | low                                                                 |

**Representative historical sketches (non-normative):** the snippets below came from the pre-P0A design and remain illustrative only. The exact config/content/measurement structures are the schemas in `packages/contracts/schemas/`; result persistence must follow the semantic trace/snapshot contract. Never use the illustrative numeric values as scoring truth.

```js
// calculator_versions
{ _id, calculatorId, calculatorSlug, version: 3, status: 'draft|in-review|published|retired',
  changelog, publishedAt, publishedBy,
  parameters: [{ key, label, group, biomarkerKey?, inputType: 'number|select|boolean|derived',
                 unit: { canonical, allowed: [{code, factor}] },
                 validation: { required?, min?, max?, decimals? },
                 missingPolicy?, defaultOption?, options?, derived?: {formula, dependsOn},
                 visibility?, help?, order, source }],
  scoringRules: [{ parameterKey, bandEdges: 'min-inclusive',
                   contexts: [{ when: null|{all:[{param,op,value}]},
                                bands: [{min?, max?, minExclusive?, maxInclusive?, points, interpretation?, source}] }] }],
  parameterGroupsAggregation?: [{ key, aggregate: 'max', parameterKeys }],
  lookupTables?: [{ key, map: [{points, riskPct, orBelow?, orAbove?, display?}] }],
  imputationRules?: [...], floorRules?: [...],
  domains: [{ key, label, weight, parameterKeys, aggregateKeys?, scoreFormula }],
  adjustmentRules: [...], formulas: [{key, expression, scope?}],
  resultCategories: { scale: {min, max, unit?, direction}, bandEdges, bands: [...], overrides?: [...] },
  uiConfig: { theme, steps, result: { layout, informationHierarchy } },
  content?: { intro, body, faq, seo: { title, description, keywords } } }   // R2/R3: page content lives with the version

// results (example values from 09 §7)
{ _id, assessmentId, calculatorVersionId, engineVersion: '1.2.0',
  finalScore: 23.4, rawScore: 21.4, category: {label:'Fair', color:'#fee08b'},
  domainScores: [{domain:'cardiovascular', score:38.1, weight:0.25, weighted:9.53,
                  maxPoints:21, earnedPoints:8, includedParams:7, omittedParams:0}],
  parameterScores: [{key:'hdl', value:38, unit:'mg/dL', points:3, maxPoints:3,
                     interpretation:'low', bandMatched:{...}, contextMatched:{sex:'male'}}],
  adjustments: [{key:'smoking-adjustment', applied:true, delta:10}],
  keyContributors: [...], trace: ['normalize: hdl 0.98 mmol/L → 37.9 mg/dL', ...],
  createdAt, computeMs: 12 }
```

### 6.5 Relationships / references

- `calculators` 1—* `calculator_versions` (by `calculatorId`; `currentVersion` int points at the live one).
- `calculator_versions.parameters[].biomarkerKey` →optional→ `biomarkers.key` is an authoring/provenance link; the immutable version's embedded parameter/unit/bounds/help/source snapshot and recorded measurement revision/hash are runtime-authoritative.
- `assessments` *→1 `calculator_versions` (exact executed config); `results` 1→1 `assessments` in v1, enforced by the unique `results.assessmentId` index. A future multi-result/recalculation model would require a versioned persistence/API decision rather than silently changing this cardinality.
- `visitorId` connects only approved retention-window anonymous analytics; `sessionId` connects only one visit/session. The v1 lead record is deliberately unlinked from visitor, calculator, assessment, result, share capability, and health data (ADR-032).
- Rule of thumb applied throughout: **embed what is read together** (version config), **reference what is shared** (biomarkers).

### 6.6 Indexing strategy

```js
calculators:          { slug: 1 } unique · { status: 1, updatedAt: -1 }
calculator_versions:  { calculatorId: 1, version: -1 } unique · { calculatorSlug: 1, status: 1 }
biomarkers:           { key: 1, revision: 1 } unique · { status: 1, key: 1, revision: -1 }
                      · { status: 1, 'definition.domainKeys': 1, key: 1, revision: -1 }
                      · text index on displayName, key, and definition.aliases
assessments:          { calculatorSlug: 1, createdAt: -1 } · { calculatorVersionId: 1, createdAt: -1 }
                      · { sessionId: 1, createdAt: -1 } · { expiresAt: 1 } absolute TTL
results:              { assessmentId: 1 } unique · { calculatorVersionId: 1, createdAt: -1 }
                      · { expiresAt: 1 } absolute TTL · { shareTokenHash: 1 } sparse unique
audit_logs:           { createdAt: -1 } · { actorId: 1, createdAt: -1 }
                      · { entityType: 1, entityId: 1, createdAt: -1 }
analytics_events:     { eventId: 1 } unique · { occurredAt: -1, type: 1 }
                      · { calculatorSlug: 1, occurredAt: -1 }
                      · { sessionIdHash: 1, occurredAt: 1 } · { visitorIdHash: 1, occurredAt: 1 }
                      · { identityKeyVersion: 1, occurredAt: 1, expiresAt: 1 }
                      · { expiresAt: 1 } absolute TTL
analytics_daily:      { day: 1, timezone: 1, scope: 1, scopeKey: 1, identityBasis: 1, identityKeyVersion: 1 } unique
                      · { day: -1 }
                      · { calculatorSlug: 1, day: -1 }
                      · { timezone: 1, day: 1, scope: 1, calculatorSlug: 1 }
leads:                { email: 1 } · { createdAt: -1 } · { expiresAt: 1 } absolute TTL
admin_sessions:       { tokenFamilyId: 1 } unique · { adminUserId: 1, expiresAt: 1 } · { expiresAt: 1 } absolute TTL
anonymous_visitors:   { visitorIdHash: 1 } unique · { expiresAt: 1 } absolute TTL
job_runs:             { job: 1, scheduledFor: 1 } unique · { status: 1, startedAt: -1 }
                      · { leaseExpiresAt: 1 } · { status: 1, nextRetryAt: 1 } · { scheduledFor: -1 }
analytics_materialization_locks: { _id: 1 } intrinsic unique · { leaseExpiresAt: 1 }
analytics_attribution_claims: { _id: 1 } intrinsic unique HMAC session claim · { expiresAt: 1 } absolute TTL
cache_invalidation_events: { status: 1, createdAt: 1 } · { calculatorSlug: 1, createdAt: -1 }
                           · { expiresAt: 1 } absolute TTL
login_attempts:       { accountHash: 1, createdAt: -1 } · { createdAt: -1, success: 1 }
                      · { createdAt: 1 } fixed 90-day TTL
```

Principles: index exactly what queries filter/sort on (check with `.explain()` in Compass); TTL indexes are the retention mechanism (no cron delete code); text index only where search exists (measurements). Historical overview, engagement, funnel, score-intelligence, and lead trend reads hit `analytics_daily`; only the explicitly bounded five-minute live-session value reads raw events. Security, operations, detailed audit, and capped CSV endpoints may perform bounded reads of their own retained/operational collections. Admin refreshes never rebuild materialized product metrics or trigger unbounded source scans.

### 6.7 Mongoose usage notes (from 09 §10)

- Database config storage may be flexible internally, but every write/publish validates against an immutable versioned schema. Schema evolution requires an explicit new version and migration; `strict:false` is never permission to bypass contracts.
- Optimistic concurrency (`versionKey` + `If-Match` rev) on draft saves.
- Public reads: `.lean()` + projection stripping scoring internals; any local cache is keyed by immutable version and paired with cross-instance invalidation/version polling.
- Publishing commits version status/current pointer, audit, review/test hashes, and revalidation event atomically. Use a Mongo transaction. Local development therefore runs a replica set; an explicitly designed idempotent state machine is the only acceptable alternative.

### 6.8 Dev / test / prod management

| Concern        | Development                                                                                                 | Testing/CI                                                                                         | Production                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Instance       | MongoDB Atlas, DB `niro_dev`; no local MongoDB server                                                       | transaction-capable Atlas URI; guarded suites use uniquely named owned databases or scoped records | Atlas transaction-capable deployment sized for the target workload                                                         |
| Data           | source-preserving, unreviewed draft core-measurement revisions + guarded fixtures/imports + admin bootstrap | synthetic fixtures with ownership checks and scoped cleanup                                        | migrations + validated, reviewed seeds only; never hand-edited; no catalog bulk import                                     |
| Schema changes | code-first via Mongoose + configValidator                                                                   | same                                                                                               | `migrate-mongo` for the rare data migration (e.g., backfilling a new analytics field); migrations committed + run in CI/CD |
| Backups        | none needed (seedable)                                                                                      | none                                                                                               | Atlas continuous backup + daily snapshot; test a restore once before launch                                                |
| Access         | least-privilege Atlas SCRAM user, developer `/32` IP access-list entry, TLS                                 | least-privilege test credentials and explicit write intent                                         | SCRAM user with least privilege, IP allowlist/VPC peering, TLS enforced                                                    |
| Monitoring     | Compass                                                                                                     | —                                                                                                  | Atlas metrics + alerts (connections, replication lag, disk, slow queries)                                                  |

---

## 7. Authentication and Authorization Architecture

**Two distinct populations — do not conflate them:**

### Public visitors — anonymous by design (source-mandated)

- No accounts and no login. A consent/legal-reviewed persistent pseudonymous `visitorId` may provide retention-window continuity; a separate inactivity/session-scoped `sessionId` measures one visit. Share access uses an independent random capability token.
- Optional email capture on the result page → `leads` (consent flag stored). Results never gated.
- **FINAL DECISION (2026-08-20): public visitors never have accounts or logins.** Users access every calculator directly, with zero registration. The only login in the entire system is the Admin login below. Do not build visitor auth, "save my results" accounts, or social login — this is a settled requirement, not an open option. (It also matches the documented lead-magnet/anonymous-first positioning in the source material.) If Niro ever reverses this, a `users` collection + `userId` on assessments would slot in without disturbing anything else — but that is out of scope by decision.

### Admin (Calculator Studio)

- **Login:** email + password. bcrypt (cost 12). Rate-limited endpoint. Account lockout: 5 failed attempts → 15-min lock (attempts recorded in `login_attempts`).
- **Tokens:** short-lived access JWT (15 min, payload: `sub`, `role`) + rotating refresh token (7 d) — both in `httpOnly; Secure; SameSite=Strict` cookies (immune to token theft via XSS; CSRF handled by SameSite + custom header check). `POST /admin/auth/refresh`, `POST /admin/auth/logout` (revokes refresh id stored on user doc).
- **RBAC (first four rows from deliverable 12; the analytics-dashboard and audit-viewer rows are this plan's additions for the new R21 scope):**

| Capability                                            | editor | admin |
| ----------------------------------------------------- | ------ | ----- |
| Create/edit drafts, validate, preview, run test cases | ✅     | ✅    |
| Publish / retire versions                             | ❌     | ✅    |
| Biomarker library edits                               | ❌     | ✅    |
| Admin user management                                 | ❌     | ✅    |
| Analytics dashboard (read)                            | ✅     | ✅    |
| Audit log viewer                                      | ❌     | ✅    |

- **Middleware chain:** `requireAuth` (verify JWT) → `requireRole('admin')` per route group. 401 unauthenticated / 403 wrong role. Every admin mutation appends to `audit_logs`.
- **Flow:** login → access+refresh cookies → SPA calls `/api/v1/admin/*` → silent refresh on 401-expired → logout revokes. Logout/login events also land in `login_attempts` (feeds the security panel, §8).

---

## 8. Admin Panel and Analytics Requirements

**Grounding rule:** this platform has **no public user accounts** — public traffic is anonymous visitor/session telemetry plus opt-in leads, alongside 2–10 admin users. Analytics below must preserve the visitor/session distinction and the approved retention window.

### 8.1 Dashboard pages

**A. Overview (landing)**

- Today/7d/30d: unique visitors, sessions, assessments completed, leads captured, top calculator
- DAU / WAU / MAU chart (unique approved pseudonymous `visitorId`s; fall back to sessions only and label honestly when visitor persistence is disabled)
- New vs returning visitors from durable retention-window firstSeen state, never from a session ID
- Visitor growth over time (daily uniques, 90-day line)
- Live now: sessions with an event in the last 5 minutes

**B. Engagement & behavior**

- Avg session duration (first→last event per session/day) and pages per session
- Most-used calculators: starts, completions, **completion rate, drop-off step** (funnel: page_view → calc_start → step_n → assess_submit → result_view)
- Most-viewed pages/sections (calculator pages, biomarker pages, directory)
- Canonical calculator/biomarker search identifiers and zero-result counts. Arbitrary entered text is collapsed to `[other]`; raw content-roadmap terms are intentionally unavailable in v1 under ADR-041.
- Share-link opens; retake rate
- Device / browser / OS / locale breakdown (parsed server-side from UA); referrer + UTM (organic-search performance is _the_ KPI for a lead magnet)

**C. Assessment intelligence (unique to this product — high value)**

- Score distribution per calculator (histogram from `results.finalScore`), category mix over time
- **Omitted-parameter frequency**: which biomarkers users most often lack (directly informs partial-scoring UX and content strategy)
- Unit-usage stats (mmol/L vs mg/dL — informs defaults)
- Avg computeMs (engine health), assess error rate (422s)
- Per-version adoption after publish (results by calculatorVersionId)

**D. Leads**

- Lead count over time, conversion rate (leads / results viewed), and CSV export. Per-calculator source is explicitly unavailable because ADR-032 forbids lead linkage and timestamp inference.

**E. Security & audit**

- Admin login/logout activity; failed-login trend and keyed opaque account/network groups (never raw email/IP); active lockouts
- Admin activity/audit trail (filter by actor/action/calculator) — from `audit_logs`
- Per-admin activity history ("user-wise activity history" — meaningful for admin users)
- Rate-limit trips on public endpoints (429 counts)

**F. Operational health**

- Dependency-aware service status and Mongo readiness (the separate `/healthz` process-liveness and `/readyz` deployment probes are monitored externally rather than sampled by the dashboard); API p50/p95 latency & error rate (from metrics middleware); event-ingest lag; last aggregation-job run; Mongo connection state; disk/collection sizes
- Config-cache hit rate; publishes in last 30 d

**Wishlist items mapped to honest equivalents:** "new registrations" → new pseudonymous visitors within the approved retention window + leads captured — there is no member registration to count; "most active users" → per-admin activity, while a most-active-anonymous-visitors leaderboard is deliberately not surfaced; "user-wise activity history" → per-admin audit/activity history.

**Deliberately NOT built:** registered-member counts, per-member history, or member retention cohorts. Visitor analytics are first-party pseudonymous aggregates under the privacy/retention policy; admin-user analytics cover the only real accounts.

### 8.2 What data is collected, and where

| Data                                                           | Collected how                                                                                                                                                                    | Stored in                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Page views, calc funnel steps, searches, shares, unit switches | client beacon `navigator.sendBeacon('/api/v1/events', batch)` on route change + key actions                                                                                      | `analytics_events`                |
| Visitor/session identity                                       | approved persistent pseudonymous `visitorId` plus separate inactivity/session-scoped `sessionId`                                                                                 | on events when policy allows      |
| Device/browser/locale                                          | server derives deliberately coarse fields with the bounded in-repository parser; raw UA/language is discarded and IP is transient rate-limit input only, never analytics storage | event props                       |
| Referrer/UTM                                                   | first event of session carries `document.referrer` + UTM params                                                                                                                  | event + session-scoped            |
| Assessments/results/scores/omissions                           | already persisted by the assess flow — **no extra collection needed; aggregate from `assessments` + `results`**                                                                  | existing collections              |
| Leads                                                          | result-page form                                                                                                                                                                 | `leads`                           |
| Admin auth events                                              | auth middleware                                                                                                                                                                  | `login_attempts`                  |
| Admin mutations                                                | audit middleware                                                                                                                                                                 | `audit_logs`                      |
| API latency/errors                                             | metrics middleware (in-process counters)                                                                                                                                         | scraped/logged, plus daily rollup |

**Event document:** `{ eventId, occurredAt, type: 'page_view|calc_start|step_view|assess_submit|assess_error|result_view|share_open|share|retake|search|unit_switch', visitorId?, sessionId, props: { path?, calculatorSlug?, step?, stepIndex?, query?, zeroResults?, action?, parameterKey?, unit?, referrerHost?, flatUtm? } }`. The server supplies coarse device/browser/OS/locale, HMACs identifiers, verifies calculator scope, and maps search text to a canonical published-calculator/verified-measurement identifier or `[other]`. There is no `lead_submit` event under ADR-032 and no free-text PII, health value, raw result ID, or share capability may enter telemetry.

### 8.3 How metrics are calculated (jobs + APIs)

- **Nightly rollup job** (platform scheduler or distributed lease): idempotent aggregation with durable `job_runs`, retries/backfill, reporting timezone, late-event policy, and reconciliation.
- **Live queries** (small windows only): "live now" = distinct active sessions where `occurredAt > now-5m`; reporting totals come from materialized daily rows. A separately scheduled, leased five-minute-bucket partial producer replaces the current-day row; dashboard refresh never triggers source scans.
- **Admin APIs:** `GET /api/v1/admin/analytics/overview?from&to`, `/engagement?from&to`, `/funnel/:slug?from&to`, `/scores/:slug?from&to`, `/leads?from&to`, `/security?from&to`, `/ops`, and `/metrics`. Historical product/engagement/assessment/lead panels read `analytics_daily`; only the labelled live-session value reads a bounded five-minute event window. Security/ops/audit and capped exports read only their purpose-specific retained or operational collections with bounded filters.
- **Admin-only exports:** `GET /api/v1/admin/analytics/exports/leads.csv?from&to` and `GET /api/v1/admin/analytics/exports/assessments.csv?from&to&calculator=<slug>` are capped, audited, formula-injection-safe, and deliberately excluded from editor access.
- **Retention:** TTL indexes do the physical pruning (events/assessments/results/leads/visitors use explicitly configured approved periods; login attempts 90 d); reads enforce logical expiry because TTL deletion is asynchronous. `analytics_daily` is permanent only after cohort and source-completeness gates.
- Existing spec hook: `GET /api/v1/admin/assessments?calculator=&from=&to=` (10-api-specification) is subsumed by these endpoints.

---

## 9. Frontend Architecture

### 9.1 SEO rendering decision — LOCKED in P0A

The deliverables assume a single React SPA. A pure SPA is the **weakest option for the stated #1 business goal (SEO lead magnet)**. P0A locks:

- **Next.js for `apps/client/`** (still MERN — React + Node; Express API stays separate). Public pages (directory, calculator intro/content, biomarker pages) are server-rendered/ISR with real meta tags + generated JSON-LD; the calculator form/result and the whole `/admin` studio remain client-rendered. Config fetches hit the Express API.

Everything below is renderer-framework-agnostic and unchanged either way.

### 9.2 Config-driven rendering (from 11-dynamic-ui-architecture.md — adopt as-is)

- **One renderer for all calculators.** `CalculatorRenderer` consumes the public config: steps from `uiConfig.steps`, fields via **FieldRegistry** (`number → NumberField` (unit switcher, min/max hints), `select`, `radio`, `boolean → Toggle`; `derived` never rendered), each wrapped in `FieldShell` (label, help popover, "learn more" biomarker link, validation message, skip control). Component contract: `(parameterConfig, value, onChange, error)` — components never know which calculator they serve.
- **ResultRenderer + Block Registry**: iterates `uiConfig.result.layout` → `ScoreGauge` (direction-aware), `Category`, `Contributors`, `DomainBreakdown` (bars/radar), `BiomarkerDetails` (chips → drill-in), `Recommendations`. Extension = add a registry entry (open for extension, closed for modification).
- **Client logic mirrors:** `visibility.ts` (same condition-DSL semantics as engine) + `validation.ts` (client mirror of config rules; server stays authoritative; 422 field errors map back onto fields).
- **State:** Next App Router server components/ISR own initial public list, config/content, and result reads; React Query owns browser-side directory/search refresh and shared-result cache state. The one-shot assessment transaction uses the typed API client directly so its payload-stable idempotency lifecycle stays inside `CalculatorRenderer`; one `useReducer` per form owns `{values, units, skipped, errors, currentStep}` and version-scoped progress in `sessionStorage`. No global store.
- **Routes:** `/`, `/c/:slug`, `/results/:shareToken`, `/biomarkers`, `/biomarkers/:key`, `/admin/*`.
- **Validation UX:** blur = field-level; step-next = required check; submit = server 422 mapping. Soft biological-bounds warnings vs hard blocks, both config-driven.
- **Content states:** config skeleton, empty directory, calc spinner, assess failure (retry, inputs preserved), partial-data notice, retired-version banner.
- **A11y & mobile:** aria-describedby help/errors, keyboard-completable steps, focus-to-heading on step change, text-first chart equivalents; mobile-first single column.

### 9.3 Admin SPA screens (from 12)

Calculator list (status chips) · Builder workspace (step nav, autosave, validation sidebar with jump-to-step) · Parameter drawer (biomarker picker pre-fills units/validation/help) · Band editor (visual number line, context tabs Male/Female, source tag nag) · Condition builder (nestable ALL/ANY rows, serializes 1:1 to DSL) · Preview (live renderer + trace inspector) · Test cases (run-all, diff on fail) · Version history (diff, rollback) · Biomarker manager · **Analytics dashboard (§8)** · Audit viewer.
Build-vs-defer: wizard ①–⑤+⑦, biomarker picker, condition builder, band editor, publish/rollback are must-have; drag-reorder, rich theming, audit viewer UI can trail (step ⑥ may start as JSON-with-schema-hints).

---

## 10. Backend Architecture

**Express layered structure — requests flow routes → middleware → controllers → services → (engine | models).**

Modules (from 07 §3.2, plus analytics):

| Module                         | Responsibility                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Calculator API                 | public config reads (projection strips scoring; ETag on `slug@version`)                                                                                                                                                                                                        |
| Assessment API                 | POST assess orchestration: Validation Service → Engine → persist assessments+results → Result/Insight assembly                                                                                                                                                                 |
| Result API / Biomarker API     | stored result reads; library reads                                                                                                                                                                                                                                             |
| Admin API                      | auth, calculator lifecycle, version editing, biomarker CRUD, analytics reads                                                                                                                                                                                                   |
| Config Service                 | load/cache immutable versions, draft CRUD, lifecycle, cross-instance invalidation/version checks, and publish-triggered Next.js revalidation                                                                                                                                   |
| Config Validator               | Implements the stable `STR-*`, `SEM-*`, `CLN-*`, and `PUB-*` rules: schema/reference integrity, explicit source-preserved gaps, overlap/context/DAG checks, formula symbols, missing/domain policies, reachable scale, evidence/review/tests, and computed publish eligibility |
| Validation Service             | runtime input validation from config (required/min/max/decimals/unit-in-table/unknown-keys-rejected)                                                                                                                                                                           |
| **Engine** (`packages/engine`) | pure `execute(config, inputs) → result`; validated dependency graph; v1 primitives; emits ordered trace                                                                                                                                                                        |
| Result/Insight Service         | contributor ranking, recommendation resolution, response assembly                                                                                                                                                                                                              |
| Auth / Audit                   | JWT+roles; audit_logs appender middleware                                                                                                                                                                                                                                      |
| Analytics Service + Jobs       | event ingest, rollups, dashboard queries (§8)                                                                                                                                                                                                                                  |

**Middleware stack (order):** requestId → pino-http logging → helmet → CORS (configured origins) → JSON body limit → express-rate-limit (public assess + events + admin login) → express-validator boundary sanitation (reject unknown fields) → routes → central error handler (typed errors → envelope, no stack traces) .

**Engine execution:** the apparent stages are a validated dependency graph, not declaration-order slots. Derived values, provisional/final aggregates, missing-target imputations, formulas, lookups, adjustments, floors, and overrides execute in topological order exactly as defined in `packages/contracts/specs/engine-semantics.v1.md`. Heart's declared chain is `base-points → base-risk → s-lipid/m-young → adjusted-risk → final`; Diabetes may compute a provisional glycemic aggregate before waist imputation and then finalize aggregation.

**Error model:** 422 per-field for invalid submissions (missing required, out-of-range, unknown unit) · a typed no-score/unscored result for a declared source-preserved gap or approved missing-domain policy · 404 unpublished/expired share · 401/403 auth · 409 editing a protected version · 429 rate limit · 500 + alert only for an unexpected config/runtime invariant breach.

---

## 11. API Design

Base `/api/v1` · envelope `{ data }` / `{ error: { code, message, fields? } }` · ETag on config reads.

### Public

| Method Path                                                | Purpose                                                                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET `/calculators`                                         | published list: slug, name, shortDescription, tags, version                                                                                                                    |
| GET `/calculators/:slug`                                   | published config **projection** (parameters, uiConfig, display bands, disclaimers, content) — points/weights stripped                                                          |
| POST `/calculators/:slug/assess`                           | idempotent `{ inputs (scalar or {value,unit}), omitted[], visitorId?, sessionId }` → sanitized result projection; contact email is not accepted here                           |
| GET `/results/:shareToken`                                 | public result projection authorized by random capability token; expiry/revocation enforced; `noindex`                                                                          |
| GET `/biomarkers?domain=&search=` · GET `/biomarkers/:key` | library                                                                                                                                                                        |
| POST `/events`                                             | telemetry batch (sendBeacon), fire-and-forget 202, rate-limited                                                                                                                |
| POST `/leads`                                              | separate v1 email capture `{email, consent:true, consentVersion}`; unknown linkage fields are rejected and no health/visitor/calculator/result association is stored (ADR-032) |
| GET `/healthz` · `/readyz`                                 | liveness / Mongo ping                                                                                                                                                          |
| GET `/sitemap.xml`                                         | SEO (served by web tier if Next.js)                                                                                                                                            |

### Admin (JWT; roles per §7)

| Group       | Endpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth        | POST `/admin/auth/login` · `/refresh` · `/logout`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Calculators | POST/GET `/admin/calculators` · GET/PATCH `/admin/calculators/:id` (rename/tag/archive)                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Versions    | GET/PUT `/admin/versions/:versionId` (draft save, `If-Match` rev; PUT on protected version → 409) · POST `/admin/calculators/:id/versions` (new draft from published — edit-by-copy) · POST `/admin/versions/:id/validate` → layer-specific stable diagnostics · `/preview` (same engine, result **+ trace**; trace never public) · `/publish` (all computed publish gates pass, then version/pointer/review hashes/audit/revalidation commit atomically; body `{changelog}`) · `/retire`; rollback creates/publishes a new immutable version |
| Test cases  | GET/PUT `/admin/versions/:id/testcases` · POST `/admin/versions/:id/testcases/run`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Biomarkers  | POST/PUT/GET `/admin/biomarkers[...]` (draft→verified requires ≥1 source; no DELETE anywhere — soft archive only, matching spec)                                                                                                                                                                                                                                                                                                                                                                                                              |
| Analytics   | GET `/admin/analytics/overview                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | funnel/:slug | scores/:slug | leads | security | ops` (+ CSV export) |
| Audit       | GET `/admin/audit?actor=&action=&slug=&from=&to=`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Users       | GET/POST/PATCH `/admin/users` (admin role only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Conventions: published versions immutable; rollback = republish old config as **new** version; DELETE endpoints intentionally absent; per-IP rate limit on assess/events/login; CORS from configured origins.

---

## 12. Security Architecture

1. **Scoring secrecy / server authority** — public config projection strips bands, points, weights, formulas, lookup tables (Niro's proprietary logic); assess runs server-side only; trace admin-only.
2. **Transport & headers** — HTTPS everywhere (HSTS), helmet defaults, strict CORS.
3. **AuthN/AuthZ** — §7: strong parameterized password hashing, lockout, short-lived access state + rotating hashed refresh-session families in httpOnly SameSite cookies, CSRF protection, revocation/reuse detection, and RBAC. Exact libraries are selected and pinned in P0B/P4.
4. **Input/content handling** — boundary schema validation rejects unknown fields and Mongo operators; body/array/string/depth limits apply. Content uses typed blocks/Markdown with raw HTML disabled, allowlist sanitization, and server-generated JSON-LD—never arbitrary admin HTML, JavaScript, iframe, or JSON-LD.
5. **No code execution from data** — conditions = interpreted JSON; formulas = whitelist expression parser; unknown identifiers rejected at config-save. This is the critical safety property of a user-authored-config platform.
6. **Rate limiting & abuse** — per-IP on assess, events, login; 429s surfaced in the security panel; lockout on brute force.
7. **Secrets** — env vars via host secret store; never in git; JWT secret rotation procedure documented.
8. **Privacy** — no PII required for assessment; optional email is collected separately with versioned consent. V1 explicitly prohibits lead↔visitor/calculator/assessment/result/share/health linkage; any future reversal requires a new versioned contract and security/privacy review. Public analytics do not persist raw IP; minimized/hashed admin-security network evidence has separate retention. Assessments and results have aligned, explicitly configured expiry. Share links use random hashed capability tokens, expiry/revocation/deletion, and `noindex`—never ObjectIds as secrets.
9. **Supply chain & ops** — `npm audit` in CI, Dependabot, lockfiles; least-privilege Mongo user; audit_logs append-only from middleware (not skippable per-route).
10. **Error hygiene** — central handler; no stack traces or internals to clients.

---

## 13. Logging, Monitoring, and Audit Strategy

| Layer                | Tooling                                                                                    | Notes                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| App logs             | `pino` + `pino-http`, JSON, requestId correlation                                          | levels by env; pretty-print in dev                                                 |
| Engine audit         | ordered `trace[]` persisted in `results`                                                   | every number reconstructable: versioned config + trace (success criterion #10)     |
| Admin audit          | `audit_logs` via middleware on every admin write                                           | action, entity, diffSummary, actor, timestamp                                      |
| Metrics              | in-process counters/histograms (`prom-client`) → `/metrics` (protected)                    | p50/p95 latency, error rate, assess computeMs, cache hit rate, event-ingest counts |
| Health               | `/healthz` (liveness), `/readyz` (Mongo ping)                                              | wired into host health checks + uptime monitor (UptimeRobot/BetterStack)           |
| Error tracking       | selected Sentry-equivalent backend (external selection pending)                            | release-tagged with engineVersion                                                  |
| DB monitoring        | Atlas metrics + alerts                                                                     | slow-query profiler in staging                                                     |
| App jobs             | platform scheduler/distributed lease: current-day/nightly analytics and cache invalidation | durable idempotent `job_runs`, retries/backfill, surfaced in ops panel             |
| External review jobs | scheduled CI/platform runs: rendered source-link liveness and Niro-vs-external divergence  | accountable source owner plus retained timestamped report/run artifacts            |
| Dashboards           | Admin ops panel (§8.1-F) reads metrics + job status                                        | single pane for a small team                                                       |

---

## 14. Phase-by-Phase Implementation Plan

**Canonical plan note:** the folder contains three inconsistent plans (4-phase `14-execution-plan.md`, 7-phase `word/` client doc, 12-phase inside `generate_pdf.py` — richest, but its rendered output was overwritten). This plan **supersedes all three**, keeps the 12-phase plan's engineering gates, the 7-phase plan's ordering, and adds the analytics/admin-dashboard scope you requested. Estimates assume one full-time developer; ranges are honest.

| Phase   | Name                                                                 | Duration                                                     | Definition of Done (gate)                                                                                                                                                                                                                                                                                                |
| ------- | -------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P0A** | Canonical contracts & discrepancy gate                               | complete 2026-08-21                                          | Real schemas and semantic/content/measurement contracts checked; all 5 untouched drafts structurally pass; semantic/clinical/publish failures and architecture decisions recorded in `packages/contracts/`                                                                                                               |
| **P0B** | Project setup & architecture skeleton                                | complete 2026-08-21                                          | `npm run dev` boots `apps/client` + `apps/server`; Atlas-ready environment/config foundation; CI runs lint+tests; `/healthz` green                                                                                                                                                                                       |
| **P1**  | Data model & contract validator implementation                       | complete 2026-08-23                                          | Persistence baseline, all four P0A validation layers, fixture validation, guarded initial-admin bootstrap, Atlas connectivity, and transaction integration are verified                                                                                                                                                  |
| **P2**  | Calculation engine (dependency-ordered stages + extended primitives) | complete 2026-08-23                                          | Pure deterministic v1 engine, stage helpers, complete coverage/max-point and source-gap matrices, all missing/domain policies, aggregate-dependent imputation, bounded expression semantics, contributor/trace output, and source-bound Heart/Diabetes goldens are green                                                 |
| **P3**  | Public APIs                                                          | complete 2026-08-23                                          | Published list/config projection, privacy-safe result/share reads, strict assess validation, durable idempotency, rate limiting, cache/ETag/304 behavior, exact version reproducibility, TTL/revocation enforcement, and live Atlas transaction/projection verification are green                                        |
| **P4**  | Admin auth & admin APIs                                              | complete 2026-08-23                                          | Session-bound auth/RBAC/CSRF, user and audit APIs, optimistic lifecycle, preview/tests, measurement review, transactional publish/rollback/retire, durable invalidation, and live Atlas acceptance are green                                                                                                             |
| **P5**  | Public frontend (renderer + results + directory)                     | complete 2026-08-25                                          | Next.js 16 SSR/ISR public shell, generic config-driven calculator, complete safe result/content renderers, capability sharing, SEO, accessibility, responsive browser acceptance, and optional unlinked lead capture are green                                                                                           |
| **P6**  | Biomarker library (data + pages)                                     | complete 2026-08-26                                          | Revision-3 drafts applied idempotently to Atlas, immutable v1/v2 audit history, shared semantic/public gates, source/conflict/provenance UI, deterministic integrity checks, isolated API/index/transaction acceptance, and desktop/mobile browser acceptance are green                                                  |
| **P7**  | Admin Builder UI (Calculator Studio)                                 | complete 2026-08-28                                          | Non-technical flow proven: create → parameters → scoring → categories → preview → validate → test → publish without code; band editor + condition builder serialize 1:1 to config                                                                                                                                        |
| **P8**  | Niro calculator reconciliation & golden verification                 | engineering complete 2026-08-28; clinical release blocked    | Drafts loaded through Studio without auto-publish; source discrepancies are carried as explicit hard blockers; only approved complete examples may become passing golden tests; CWS and COVID remain blocked as documented                                                                                               |
| **P9**  | Analytics & admin dashboard                                          | complete 2026-08-28                                          | Privacy-safe client/server telemetry, retention-aware durable rollups/backfills, leased jobs, aggregate dashboard APIs, six-panel admin UI, guarded exports, security/operations visibility, Atlas integration, and browser acceptance are green                                                                         |
| **P10** | Testing, hardening & **Reusability Gate**                            | complete 2026-08-30                                          | Production-mode standalone Next/Atlas Studio-only journey, protected hashes, axe/keyboard/desktop/tablet/mobile checks, expected-negative and zero-unexpected browser errors, ETag/privacy behavior, guarded cleanup, final k6 20/20 checks at 113.152975 ms assess p95, and independent 132.16 ms p95 sampling all pass |
| **P11** | Deployment & monitoring                                              | repository preparation complete; external acceptance blocked | Render native Node is selected and its Blueprint/process/recovery/monitoring assets are tested; account sync, staging/production, backups/restore drill, fleet monitoring, alerts, DNS/TLS, and incident evidence remain external                                                                                        |
| **P12** | Production readiness & launch                                        | repository preparation complete; launch blocked              | Clone→run→Studio handover, readiness register, and launch-decision template are complete; clinical/policy/environment gates remain unchecked and therefore the current launch decision is NO-GO                                                                                                                          |

**Total: ~10.5–13.5 working weeks strictly solo** (the phase ranges above sum to 52–68 working days, serial). **~8–10 weeks becomes realistic only if a second developer takes P5/P6/P9 in parallel** (see §16 and risk #8). Plan on ~12 weeks solo as the honest midpoint.

---

## 15. Detailed Tasks Inside Each Phase

### P0A — Canonical contracts & discrepancy gate — COMPLETED 2026-08-21

1. Added strict Draft 2020-12 calculator, measurement, and content schemas in `packages/contracts/schemas/`.
2. Locked deterministic engine semantics, directional unit conversion, structured content/governance, and four validation layers.
3. Validated all five untouched configs: structural PASS; documented semantic/clinical/publish blockers remain.
4. Added the complete source/config discrepancy matrix and architecture decision register. P0A does not authorize publishing or silent clinical corrections.

### P0B — Setup & skeleton — COMPLETED 2026-08-21

1. TypeScript monorepo (npm workspaces: `packages/contracts`, `packages/engine`, `apps/server`, `apps/client`); ESLint+Prettier; commit hooks.
2. Express app skeleton: env loader, pino, helmet, CORS, `/healthz` and `/readyz`.
3. Client scaffold (Next.js per locked §9.1 decision) with routes stubbed.
4. Atlas-ready `.env.example`, GitHub Actions (lint, test, build, audit), workspace build/typecheck/lint/test scripts, and no local MongoDB installation requirement.

### P1 — Data model & config schema

1. **Task 1 complete:** Mongoose baseline for calculator identities/versions, lifecycle and immutable published-version guards, embedded version payload/content/review/test/measurement snapshots, biomarker revision references, admin sessions, anonymous visitors, and durable job runs; indexes and transaction helpers are implemented in `apps/server/src/persistence/`.
2. Package/code-generate from the P0A schemas and implement the locked version/lifecycle/migration interfaces; do not redefine schema meaning in application code. **Done:** `contracts:generate` emits typed schema artifacts and lifecycle/persistence guards remain in `apps/server/src/persistence/`.
3. `configValidator`: implement all `STR-*`, `SEM-*`, evidence hooks for `CLN-*`, and computed `PUB-*` gates from `packages/contracts/specs/validation-layers.v1.md`. **Done:** `packages/contracts/src/validation/calculator.ts` returns layer-specific findings and publish eligibility.
4. Craft 20+ invalid configs as validator fixtures. Add a reviewed core-measurement seed, a dev/test-only loader for the five untouched draft fixtures, and an initial-admin bootstrap; do not bulk-import the quarantined catalog. **Done:** 21 invalid fixtures and `fixtures:validate` are green; the guarded admin bootstrap command, Atlas ping, and transaction integration all pass. Reviewed measurement seeding and live fixture loading remain gated on explicit reviewed input.
5. Treat the five configs as draft validator fixtures. Do not seed them as published and do not silently add clinical values. Missing policies, domain policy, boundaries, scale, and source gaps must match the P0A report/discrepancy register.

### P2 — Engine (implementation status)

1. Core deterministic orchestrator, trace, input normalization, derived DAG, conditions, scoring, aggregation, formulas, categories, and no-eval expression interpreter are implemented in `packages/engine/`.
2. Unit normalizer and affine conversion, option points, mixed band edges, negative points, defaults, and unknown-input diagnostics are covered by engine tests.
3. **Complete:** stage helpers in `packages/engine/src/stages.ts` centralize aggregate, coverage/max-point, and source-gap matrix calculations; runtime results report parameter/domain coverage, earned/possible points, applicable/scored counts, and source clarification references.
4. **Complete:** all seven parameter missing policies, all four domain missing-domain policies, zero-denominator behavior, aggregate empty policies, visibility/applicability, and aggregate-dependent imputation ordering are covered by nonclinical tests and a Diabetes source-bound fixture.
5. **Complete:** expression limits/domain errors, decimal half-away-from-zero `round`, finite/magnitude assertions, explicit scale clamp semantics, isolated per-domain formula scope, contributor ordering, and sequence-numbered stage trace are implemented without `eval` or calculator-specific code.
6. **Complete:** the source Heart base-stage worked example is loaded from the untouched fixture and asserts 13 base points → 10% lookup risk; the final adjusted score is deliberately not asserted because the source example omits LDL (HRT-16).

### P3 — Public APIs (implementation status)

1. `apps/server/src/modules/public.ts` implements published list/config projection, ETag/304, biomarker reads, assess input validation, and a rate limiter with injected catalog/biomarker/assessment sources for deterministic tests.
2. Durable assessment/result writes now have transaction-safe Mongoose models/store (`assessments`, `results`) with exact calculator-version references, entered/canonical inputs, omission snapshots, conversion hashes, and one-way idempotency-key hashes. Duplicate durable keys cannot create a second assessment/result pair; same-process requests replay the original response and conflicting reuse returns 409.
3. Public boundary hardening is complete: strict slug/body/query/identifier validation, configuration-vs-input error mapping (503 vs 422), bounded in-memory per-IP limiting with `Retry-After`, public cache headers, list/config ETags with 304, and no-store/noindex/pragma headers on every result response including misses.
4. Public projections are allowlisted/sanitized so formulas, scoring rules/weights/points, lookup/floor/adjustment internals, raw traces, hashes, and other protected implementation fields are never returned. Persisted results retain the full audit projection/trace for authorized future use; share reads expose only the safe result hierarchy.
5. Added `scripts/public-api-integration.ts` (`npm run public:integration`) for live Atlas coverage: creates a uniquely named temporary published version, exercises HTTP config/list/ETag, assessment/result transaction persistence, exact `calculatorVersionId` and engine-version reproducibility, idempotent replay, share read privacy, revocation, expiry, and cleanup. No quarantined catalog data is imported.
6. Added automated public API tests for config/list projections, protected-field stripping, ETag/304, result privacy headers on success/miss, malformed JSON, validation, idempotency replay/key reuse, rate-limit retry behavior, and cache invalidation. Pino request logging redacts authorization, cookies, and idempotency keys; central parsing errors are bounded 400/413 responses.
7. Atlas validation is green: `db:ping`, `db:integration`, and `public:integration` all pass against `niro_dev`; the existing five fixture hashes/clinical values and all P0A validation outcomes remain unchanged.

### P4 — Admin auth & APIs — COMPLETED 2026-08-23

1. **Complete:** bcrypt password hashing, persisted lockout, short-lived access JWTs, seven-day rotating hashed refresh-session families, session-bound access checks, reuse revocation, current-user/current-role enforcement, HttpOnly SameSite cookies, custom-header CSRF enforcement for cookie writes, bearer automation exemption, credential redaction, CORS credentials, and role gates for `admin`, `editor`, and distinct `medical-reviewer` accounts.
2. **Complete:** admin user list/create/update, password/status/role session revocation, self-disable protection, and a transaction-serialized last-active-admin invariant with append-only success/rejection audits. Added bounded admin-only audit querying.
3. **Complete:** calculator identity/version list, draft creation and edit-by-copy, strong ETag/`If-Match` guards with Mongoose optimistic concurrency, four-layer validation, explicit review submission, medical-reviewer hash-bound approval, immutable publication and retirement, and stable 401/403/409/422/423/428/429/503 boundaries.
4. **Complete:** admin preview runs the exact production engine with authorized trace; saved P0A-shaped test cases are ETag-protected, approval-invalidating, auditable, and executed with per-expectation diffs. Required failures block approval/publication without changing expected or clinical values.
5. **Complete:** biomarker/measurement draft CRUD, verified/retired immutability, medical-reviewer-only verification, resolved-source and directional affine-conversion gates, claim linkage checks, review hashes, and audit records. The quarantined catalog and full P6 dataset migration remain outside P4.
6. **Complete:** rollback always creates a new version. Immediate rollback revalidates current review/tests and transactionally creates/publishes the new immutable version, retires the old current version, advances the pointer, writes audits, and writes a durable cache/revalidation event; draft rollback does not change public state. Publish/retire use the same transaction/outbox ordering and invoke process-local/provider hooks after commit.
7. Added the normative `packages/contracts/specs/admin-api.v1.md`, expanded auth/admin/model tests, and added `scripts/admin-api-integration.ts` plus root `admin:integration`. Local `npm run check` passes 60 tests, build and fixture validation pass, and all five protected fixture hashes still match P0A. The integration harness uses a verified, randomly named Atlas test database so last-admin governance can be exercised without reading or mutating the configured bootstrap administrator, and removes only that generated database after the run.
8. **Live acceptance complete:** `db:ping` returned `status: ok` for `niro_dev`; `db:integration` committed and cleaned its replica-set transaction; `admin:integration` passed 401/403, lockout, cookie/CSRF, user lifecycle and last-admin governance, ETag conflicts, preview/tests, approval/publish, immediate transactional rollback, safe draft rollback, measurement verification, audit, durable invalidation, and scoped cleanup. `public:integration` also passed as a P3 regression. The live rollback run exposed a Mongoose requirement for `ordered: true` on multi-document `create()` calls inside a session; the transaction options were corrected and the complete suite reran green.
9. **Security follow-up:** `npm audit --omit=dev` reports three high findings in Next 15 transitive PostCSS/Sharp packages. npm offers only a breaking Next 16 upgrade. Do not use `--force`; evaluate and test that upgrade in the frontend/hardening work before production.

### P5 — Public frontend — COMPLETED 2026-08-25

1. **Complete:** the generic `FieldRegistry`, `FieldShell`, and `CalculatorRenderer` support the three v1 authored input types (`number`, `select`, `boolean`), ordered steps/groups, canonical-value condition evaluation, fail-safe hidden unsupported dependencies, affine unit switching without intermediate rounding, hard errors, separate soft warnings, policy-gated omission, deterministic payloads, first-error focus, and strict `inputs.<key>` API-error mapping. Derived/server-only parameters never render.
2. **Complete:** form state is one reducer over values/units/skipped/errors/current step. Progress is sanitized, calculator-version-scoped, and tab-only in `sessionStorage`; start-over and successful assessment clear only that exact record. SSR and the first hydration render are deterministic, then the saved step/value snapshot restores after hydration without a mismatch.
3. **Complete:** `ResultRenderer` implements all six allowlisted blocks in configured order, four score-direction explanations, parameter/domain coverage, explicit omissions, biomarker search links, recommendations, retake, and a temporary capability-share link. The immutable server-created presentation snapshot supplies display labels/layout/disclaimers for exact-version reproducibility; formulas, points, weights, raw traces, hashes, and persistence metadata never enter the public projection.
4. **Complete:** the optional lead form is polite and non-blocking, requires explicit versioned consent, writes to a separate TTL collection, and cannot accept or persist assessment/result/visitor/health linkage. It is fail-closed unless the approved server retention/consent variables and public client consent copy/version are all configured.
5. **Complete:** the Next.js 16 application provides an ISR calculator directory, SSR calculator/content pages, safe Markdown/GFM and every P0A structured content block, claim-level citations, reviewed-only FAQ/Breadcrumb JSON-LD, sitemap/robots metadata, a biomarker-library entry page, and dynamic private result routes. Loading, empty, error, not-found, and retired states are distinct; result routes set no-store/noindex/no-referrer defenses.
6. **Complete:** Next server components/ISR own initial reads; React Query owns browser directory/search refresh and shared-result cache state; the calculator reducer and typed direct assessment transaction own form/idempotency state. Typed shared public DTOs and `ApiError` preserve status/code/field findings/`Retry-After`; assessment idempotency is payload-stable for retries and renews after input changes or success.
7. **Complete:** responsive styles, skip navigation, native labelled controls, keyboard focus movement, live status/error regions, component axe coverage, SSR hydration tests, API/component/unit tests, and a guarded nonclinical browser fixture cover desktop/mobile and the partial-lab → result → share journey. The temporary fixture is never catalog or clinical data and is removed after acceptance.
8. **Complete:** Next.js was upgraded from the vulnerable v15 dependency line to tested v16.3.2; the production dependency audit is clean and the Next ESLint flat configuration is active. Production retention (DEF-001), canonical host/social assets (DEF-003), and final legal/privacy/consent copy (DEF-005) remain explicit release decisions, not inferred implementation values; public byline visibility remains the product decision allowed by the P0A content contract.
9. **Complete:** public calculator and biomarker responses use exact nested DTO allowlists, with adversarial tests proving that unknown fields, deprecated notes, internal source refs, governance/owner IDs, derived expressions, formulas, weights, traces, and hashes cannot cross the public boundary. Capability-token URL redaction covers query strings, trailing slashes/path suffixes, absolute public result URLs, and `Referer` headers; production ingress/CDN logs must enforce the same rule.
10. **Complete:** assessment/result retention has no hidden production default. `ASSESSMENT_RETENTION_DAYS` is validated, the store requires an explicit positive value, production fails closed when MongoDB is configured without it, and local assessment persistence remains unavailable until the value is configured. Final acceptance passed `npm run check` (126 tests), all-workspace production build, fixture integrity, zero-vulnerability production audit, Atlas ping/transaction/public/admin integrations, and a cleaned production-browser synthetic journey.

### P6 — Biomarker library — COMPLETED 2026-08-26

1. **Implementation complete:** transform `biomarker-dataset.json` into immutable draft revision 3 while preserving every source/value/conflict/NC artifact and recording `niro-cws.config.json` v2 plus the extraction research as current scoring provenance. Rejected Atlas draft revisions 1/2 are fingerprinted in `data/seeds/core-measurements.audit-history.v1.json`; they are never rewritten or published.
2. **Implementation complete:** library UI supports domain/A–Z/alias search, latest-reviewed-only detail pages, same-domain and current-published-calculator interlinks, exact range boundaries/context, organization-specific conflicts, claim-linked provenance, safe source URLs, no-universal-range state, and the full lab/assay/method/population/individual caveat.
3. **Implementation complete:** CI integrity is deterministic and enforces 40 records / 117 raw sources / 45 config references / 565 evidence tags / 29 raw provenance-only conversions / zero canonical unresolved conversions or inferred claim links, schema formats, source preservation, DAG/quarantine rules, and exact seed idempotency.
4. **Implementation complete:** non-derived measurement verification and public reads share one structural/semantic/source/review/hash/expiry gate; verified history is persistence-immutable; derived measurements fail closed in v1 pending a versioned SEM-055 dependency/evaluator contract.
5. **Complete:** synthetic API/browser fixtures require explicit write intent and an isolated `niro_p6_<30 lowercase hex>` temporary database. The 120-bit nonce preserves collision resistance while keeping the full database name within MongoDB's 38-byte limit. Canonical nonclinical calculator snapshots, exact measurement revision IDs/hashes, collisions, unknown commits, and ownership-scoped cleanup are tested.
6. **Live Atlas acceptance complete:** all 80 seed-owned draft-history rows across rejected revisions 1 and 2 matched their immutable fingerprints. The first revision-3 apply inserted 40 draft records; the second apply inserted none and returned 40 exact no-ops. The isolated P6 API/index/transaction suite passed and dropped its verified temporary database. No seed write overwrote, deleted, verified, or published a measurement.
7. **Browser and release acceptance complete:** desktop and 375 px browser checks passed directory filters, alias/A–Z behavior, conflict/detail/provenance rendering, keyboard disclosure, safe links, protected-field privacy, and a clean console after the local icon asset was added. The 375 px document had zero horizontal overflow and kept the A–Z strip usable through internal scrolling. Local verification totals 195 passing tests (168 workspace tests plus 27 root safety tests); root `npm test` and CI include all 27 through `test:scripts`. Build, typecheck, lint, formatting, seed integrity, unchanged five-fixture validation, and the production dependency audit are green.
8. The real 40-record core dataset remains `draft`, unreviewed, and publish-blocked. P6 does not confer medical approval, and the quarantined 62-calculator/79-measurement research catalog remains unimported.

### P7 — Admin Builder UI — COMPLETED 2026-08-28

1. **Complete:** the authenticated Calculator Studio provides list/create/import, seven workspace tabs, draft-only debounced autosave, optimistic ETag conflict recovery, read-only lifecycle states, and an authoritative validation sidebar whose findings jump to their owning step. Admin access/refresh cookies are `HttpOnly`; CSRF, role, no-store/noindex, and protected-field boundaries remain enforced.
2. **Complete:** the parameter drawer and verified-revision biomarker picker prefill only authoring-safe label/unit/hard-bound/help fields. The server, not the browser, creates exact immutable measurement snapshots and rejects missing, duplicate, stale, or mismatched revision bindings.
3. **Complete:** structured editors cover numeric bands and visual interval ownership, demographic/context tabs, per-rule/per-band source nags, option points, adjustments, and nested `ALL`/`ANY`/`NOT` conditions. Every interval now renders the frozen P0A effective semantics, including `[min,max)` defaults and explicit per-bound overrides; the engine regression found during browser acceptance now honors `minExclusive` identically.
4. **Complete:** domains expose parameter assignment warnings and a fraction-backed 100% meter; categories expose editable edge semantics and exact gap/overlap coverage; layout, result order, calculator/content pairing, claims/citations, authorship, medical review, SEO/publication, governance, and advanced contract fields are editable without executable-code authoring.
5. **Complete:** preview uses the production engine and exposes trace only inside the authorized admin response. Saved tests can be edited and run as a suite. Draft submission, independent medical-reviewer approval evidence, changelog publication, immutable history, edit-by-copy, and rollback-as-new-draft use the existing transactional lifecycle API.
6. **Complete:** persistence now derives reviewer/editor identity and measurement snapshots server-side, enforces published/retired immutability across document and query updates, makes create/version/review/publish/rollback transaction-safe, and keeps role-safe rollback, nested payload safety, audit/outbox, cache invalidation, and CORS/ETag behavior covered by regression tests.
7. **Complete:** a guarded nonclinical fixture creates exactly two synthetic roles, one verified synthetic measurement, and one publish-eligible calculator only in an owned `niro_p7_<30 hex>` database. Real-browser acceptance covered autosave, biomarker prefill, all editor steps, corrected boundary display, preview, saved tests, four-layer validation, independent review, transactional publish, public rendering/projection privacy, responsive no-overflow layout, clean consoles, and rollback to a new draft. The exact temporary database was ownership-verified and dropped.
8. No P7 operation changed a clinical value, approved P0A meaning, source fixture, real measurement lifecycle, or quarantined catalog record.

### P8 — Niro configuration & verification — ENGINEERING COMPLETE 2026-08-28; CLINICAL RELEASE BLOCKED

1. **Complete:** deterministic metadata-only overlays attach every applicable N1–N9, C4, C5, and C7 clarification/discrepancy ID plus an exact source locator to exactly four allowlisted Niro drafts. Clinical/scoring fields, COVID paths, catalog paths, invented evidence, and source-hash drift are rejected before output.
2. **Complete to the available evidence boundary:** the supplied Heart 13-points → 10% base-stage example is committed as a partial golden and explicitly cannot satisfy `PUB-007`. No complete final-input worked examples exist in the supplied sources for the four calculators, so complete source/golden suites remain fail-closed pending source-owner evidence; the build does not invent them.
3. **Complete:** CWS remains a draft with its N1 rejected-source/stratified-range banner and all remaining clarification flags. Neither it nor any other Niro calculator was approved, published, exposed by the public API, or used to change measurement review state.
4. **Complete:** the deterministic Niro-versus-external divergence source, JSON report, and Markdown report contain the reviewed 11-row discrepancy set; check mode detects drift and explicit write mode is the only report regeneration path.
5. **Complete:** the guarded live importer loads only version-1 drafts through the local Admin API after exact environment/database, loopback, credentials, source hashes, core measurement revision-3 hashes, biomarker coverage, and existing-state preflight. The first `niro_dev` run created `diabetes-risk`, `heart-risk`, `hypothyroid-risk`, and `niro-cws`; the second run returned four exact no-ops. Heart binds 5 and CWS binds 40 exact unapproved draft measurement revisions; Diabetes/Hypothyroid preserve their source configs with zero invented biomarker bindings. Prohibited lifecycle actions performed: zero.
6. **Complete:** validation now additionally gates clinical/source governance, scoped review evidence, expiry, citation verification/licensing, authorship/reviewer identity, SEO/content publication, measurement snapshots, supported engine version, and complete boundary/golden evidence. All five immutable fixtures remain structurally valid and semantic/clinical/publication invalid with counts 21/16/15/19/33; all four live Niro drafts return public 404.
7. **Complete:** reconciliation/import/report commands are deterministic, rerunnable, credential-redacted, and covered by fail-closed tests for drift, partial state, response loss, and no-op replay. The import harness uses the persistence layer's canonical measurement hash rather than a local JSON serialization variant.
8. The five fixture files and both original Niro source artifacts remain byte-identical. The 62-calculator/79-measurement catalog remains quarantined and unimported. Closing the documented clinical/source discrepancies, approving real measurement revisions, and supplying full worked examples are manual evidence decisions required before any Niro draft may move toward publication.
9. **Complete:** the non-executable P8 evidence-request register now ties all 56 current calculator-specific external blocker IDs to 20 source-owner, measurement-review, complete-worked-example, content/governance, and independent-medical-review requests. CWS-17 is separately locked as a completed revision-3 engineering disposition without clinical approval. Its deterministic readiness report revalidates the four draft candidates, records zero publication-eligible and zero accepted-evidence states, rejects fabricated approval/executable fields, and preserves the Heart partial golden as `PUB-007`-ineligible. Evidence remains externally supplied and may be applied only through a new reviewed Studio draft.
10. **Final acceptance:** `npm run check` passed all four workspace typechecks, ESLint, formatting, and 263 tests across 45 files (contracts 24, engine 17, server 73, client 91, scripts 58). The production build, zero-vulnerability production audit, seed/fixture/reconciliation/divergence checks, Atlas ping/transaction/public/admin integrations, isolated cleanup, and real-browser acceptance are green.

### P9 — Analytics & dashboard — COMPLETED 2026-08-28

1. **Complete:** `POST /api/v1/events` accepts idempotent 1–50 event batches, enforces event-specific allowlists and published-config-authoritative calculator/step/parameter/unit/path semantics, rejects capability/query/IP-literal leakage, filters bots, rate-limits with bounded transient network state, and derives only coarse UA/locale fields. Visitor/session values are domain-separated HMACs with explicit key versions; raw identifiers, IPs, user agents, health values, result IDs, and share tokens are never persisted. A TTL-bound `analytics_attribution_claims` row keyed only by HMAC session evidence makes first-session attribution atomic across application instances; retained pre-marker events are seeded safely during a rolling upgrade.
2. **Complete:** the browser emitter covers non-admin page views, first calculator interaction, ordered steps, successful/error assessments, results, share opens/successful copies, retakes, searches, and unit switches. It is StrictMode-safe, uses a 30-minute inactivity session with in-memory fallback, sends attribution once per valid session event, retries boundedly, and enables a sliding persistent visitor only when matching retention/consent settings and usable local storage exist.
3. **Complete:** public search telemetry is server-canonicalized to a current published-calculator or verified-measurement identifier; unknown/free text becomes `[other]`. Calculator-scoped events require an authoritative published identity at ingestion, and later rollups resolve the retained calculator identity (including retired history), preventing fake-scope rollup poisoning without duplicating mutable verification flags into event rows. Attribution retains only referrer host plus UTM source/medium/campaign; term/content are rejected. This privacy decision intentionally defers raw zero-result query discovery.
4. **Complete:** `analytics_daily` uses timezone/day/scope/identity-key partitions, non-reversible HLL sketches, deterministic replacement, dynamic score bins, exact calculator-version adoption, per-day category trends, and permanent small-cell suppression with explicit unavailable/suppressed disclosures for page-path, search, attribution, and clinical dimensions. Score/category distributions, including each trend day, require both eligible assessment and result cohorts. Visitor-backed and session-fallback events remain separate across policy changes. Every replacement proves exact UTC/DST-aware source-retention completeness, including zones whose local midnight is skipped, so expired/disabled source absence cannot erase history; key generations are never merged and mixed totals are labelled as upper bounds.
5. **Complete:** guarded rollup/backfill commands require explicit write intent plus exact database and environment identity. Durable `job_runs` provide per-invocation leases, heartbeats, bounded retries, stale-worker takeover, attempt caps, safe failures, reconciliation, and idempotent reruns. A separate `analytics_materialization_locks` reporting-day lease serializes current-day, nightly, and backfill replacement across instances so older buckets cannot overwrite newer snapshots. P11 must attach the command to the selected platform scheduler.
6. **Complete:** authenticated admin APIs expose overview, engagement/funnel, score intelligence, unlinked leads, security, operations, protected Prometheus metrics, and capped admin-only CSV exports. Responses are no-store/noindex, duplicate/unknown queries fail closed, editor/admin RBAC is enforced, exports are whitespace/control/formula-injection-safe and audited, and no formula, weight, trace, event HMAC, health value, identity, IP, or email crosses the dashboard boundary (except the explicit admin-only lead CSV).
7. **Complete:** `/admin/analytics` implements Overview, Engagement, Assessment intelligence, Leads, Security & audit, and Operational health with timezone/date/calculator controls, honest session/visitor/key-rotation labels, privacy suppression states, responsive internal table/navigation scrolling, accessible names/status, and loading/error/empty states.
8. **Complete:** authentication security evidence is keyed at write for attempted account and network values; disabled/locked attempts are counted; startup one-way-scrubs legacy raw-email attempt rows while preserving opaque grouping evidence. Request logging strips headers, URL queries, raw network data, request bodies, credentials, and capability values so privacy cannot be bypassed through logs.
9. **Complete:** unit/API/client tests, guarded isolated Atlas integration, transaction/idempotency/dual-lease/retention/DST/RBAC/export/privacy verification, real-browser dashboard/public-emitter acceptance, and the repository-wide gates are green. Production retention/consent, the external scheduler, fleet metrics scraper, and cross-instance invalidation provider remain explicit P11/P12 configuration decisions rather than hidden defaults.

### P10 — Testing, hardening, Reusability Gate

1. **Repository implementation complete:** the full local pyramid covers the workspace and script suites, including a structurally independent second nonclinical renderer configuration. Fixture-derived matrices traverse all five immutable drafts for authored scoring/option/category/adjustment/floor/imputation boundaries, context-selector combinations, missing scenarios, and coverage denominators without approving a clinical value. Gaps and absent contexts remain explicit diagnostics.
2. **Safety defects closed against frozen semantics:** the Heart SBP age-50 imputation overlap now emits `SEM-023` and fails closed at runtime; no side is selected. Optional derived values with missing dependencies follow their declared exclusion policy rather than producing a derivation error. Unresolved aggregate imputations fail explicitly. User-correctable required-input errors return 422 without allowing downstream configuration cascades to turn them into 503; configuration-only failures remain 503.
3. **Reusability Gate complete locally:** durable terminal evidence under `docs/operations/evidence/p10/p10-1e255924438c4d8ef8c3a63f19b3d5-0b7e75fd/` proves blank-draft Studio authoring, editing, review, publication, public use/share, protected-source identity, production standalone packaging, axe/keyboard/desktop/tablet/mobile/no-overflow behavior, expected negative-path classification, zero unexpected console/page errors, ETag/privacy headers, k6 and Node performance, and ownership-checked cleanup. Its self-generated archive manifest identifies the local operator, runtime, release ID, official k6 version, protected hash, and 43 retained artifacts with sizes/SHA-256. CI builds first, rejects a skipped live gate, installs pinned official k6, and archives terminal evidence. The protected engine hash targets `packages/engine/src` so build caches cannot cause false drift.
4. **Hardening complete locally:** authz/rate/injection tests, source-safe link crawling, generated-contract drift, root-tool typechecking, exact fixture-diagnostic baselines, restore-verifier collection coverage, and quarterly external-link workflow wiring pass. Both main CI and the dedicated P10 workflow make the live Atlas/k6 path explicit.
5. **Live acceptance passed:** after the owner added the current IP, Atlas ping succeeded. The latest owned fixture database was guarded-cleaned, its exact Next cache was removed, and the terminal run completed with cleanup. Cleanup drains model initialization, drops the owned namespace, and verifies it is absent from Atlas; a separate post-run Atlas listing also confirmed absence. Official k6 1.7.1 was checksum-verified locally; all 20 checks passed, ETag revalidation returned 304, zero HTTP requests failed, and assess p95 was 158.69 ms against the strict `<300 ms` threshold. The independent 18-request Node sampler passed at 233.83 ms p95.

### P11 — Deployment & monitoring

Tasks in §18. Restore-drill from Atlas backup is a task, not a hope.

**Repository-side P11 preparation implemented; P11 is not complete.** Render's managed native Node runtime is selected for the API and finite jobs without Docker or Kubernetes. Root `render.yaml` defines the API, a validated native Next fallback, and three UTC-scheduled jobs in Singapore with automatic deployments disabled. The preferred frontend target is Vercel via `apps/client/vercel.json`, which builds the same Next workspace from the lockfile; external values remain prompted/generated instead of committed. The workspace also has production-only environment/release/privacy/origin/secret validation; release-aware liveness and Mongo/shutdown-aware readiness; bearer-protected fleet metrics; graceful drain; exact native API/Next standalone contracts; leased jobs; artifact and provider checks; signed revalidation; read-only deployment/restore verification; and deployment/recovery/rollback runbooks. Retained OCI/Kubernetes files are non-selected historical references.

The phase remains externally blocked until staging and production are actually deployed and smoke-tested; the selected Next host proves shared cache or all-replica invalidation; Atlas production access/backups/PITR are enabled and an isolated restore plus application rollback drill meets approved RPO/RTO; scheduler executions, fleet metrics, log/error backend (including the planned Sentry-equivalent decision), uptime/alert destinations, and a test incident are evidenced; and DNS/TLS/HSTS, secret-manager, retention/consent/legal, and on-call owner decisions are approved. Templates and local tests do not satisfy those gates.

### P12 — Readiness & launch

The repository implementation and verification baseline is documented: the root README covers clone/install/configure/validate/seed/run and safe Studio authoring; `docs/operations/handover.md` covers reviewer, database, P10, deployment, recovery, and clinical handoff; `docs/operations/launch-readiness.md` is the owner/evidence register; and `docs/operations/launch-decision-template.md` prevents placeholders from being treated as approval. This baseline is not production or deployment acceptance.

P12 is not launch-complete. The register is deliberately NO-GO while every clinical candidate is blocked, all 40 measurements are draft, policy values are unapproved, and no production deployment/restore/monitoring/incident evidence exists. Open items are carried with exact owner/config/evidence requirements rather than silently closed.

---

## 16. Dependencies Between Phases

```
P0B ─► P1 ─► P2 ─► P3 ─► P4 ─► P7 ─► P8 ─► P10 ─► P11 ─► P12
        │     │     │           ▲
        │     │     └─► P5 ─────┤   (P5 needs P3 contracts)
        │     └───────► (P5 preview vs sample data possible early)
        └─► P6 ──────────────────┘   (P6 parallel to P2–P5; feeds P7 picker & P8)
P9 needs P3 (events off public flow) + P4 (admin shell); ideal slot after P8, before P10 hardening.
```

- **Critical path:** P0B → P1 → P2 → P3 → P4 → P7 → P8 → P10 → P11 → P12.
- **Parallel tracks:** P5 UI exploration once P1 implements the immutable v1 contract; P6 (biomarker data/pages) anytime after P1; P9 after P4.
- **Contract freezes:** `calculator-version.v1` semantics froze at P0A; P1 packages and implements that immutable contract without redefining it. Public API shapes freeze at the end of P3.
- The brief's own rule stands: no downstream implementation on assumptions; source rules confirmed before engine coding (already satisfied — extraction docs + configs exist).

---

## 17. Testing Strategy

(Adopts `16-testing-strategy.md` wholesale; tooling per layer.)

| Layer               | Tool                                   | Coverage                                                                                                                                           |
| ------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine unit         | Vitest                                 | every stage; condition DSL ops; expression whitelist (incl. rejection cases); unit conversions round-trip/invertible                               |
| Boundary matrix     | Vitest fixture matrices                | min−ε / min / max−ε / max per band set; **regenerates when Niro resolves C4**                                                                      |
| Demographic matrix  | Vitest fixture matrices                | 10 sex-split params × age bands × menopausal status; cortisol draw-time                                                                            |
| Missing-data matrix | Vitest                                 | 0/1/several/all-but-required/all omitted; denominator shrink; block→422; diabetes imputations; heart SBP-missing                                   |
| Golden files        | Vitest fixtures                        | config+inputs → full result JSON incl. trace, committed; output change fails CI loudly; only complete approved source worked examples lock outputs |
| configValidator     | Vitest                                 | invalid configs rejected; all five immutable sample configs retain their locked diagnostic baselines                                               |
| API integration     | Vitest + fetch/Express/Atlas harnesses | 422 field mapping, unknown params, unit table, 404, 401/403, 409 immutability, 429, ETag 304, cache invalidation on publish                        |
| Components          | Vitest + React Testing Library         | renderer + result blocks against ≥2 different sample configs (calculator-agnosticism proof)                                                        |
| E2E                 | Playwright                             | public journey (partial labs → hierarchy → share); admin journey (edit→preview trace→publish→live); a11y keyboard-only run                         |
| Reusability Gate    | procedure + CI hash check              | §15-P10 — the flagship acceptance test                                                                                                             |
| Performance         | k6                                     | assess p95 < 300 ms local; cold vs warm cache                                                                                                      |
| Data integrity      | standalone script in CI                | 100% source tags; JSON-schema on biomarker dataset; conversion invertibility                                                                       |
| Ongoing             | scheduled CI/platform jobs             | source-link review/liveness; Niro-vs-external divergence report with accountable owners and retained external evidence                             |
| Analytics           | Vitest + fixture events                | rollup idempotency; funnel math; TTL configs asserted                                                                                              |

CI (GitHub Actions): lint/static analysis → unit/security/integrity gates (including the calculator-name grep and dependency audits) → fail-closed guarded Atlas integrations → production build/native artifact verification → live P10 standalone browser/k6 gate. QA exit = P10 gate in §14. The quarterly rendered-link workflow is separate and remains externally blocked until its deployed-site variable and first retained run exist.

---

## 18. Deployment Strategy

**Environments:** local → staging (manual deployment of the exact green commit) → production (manual promote/tag). Render automatic deployment is disabled so no unverified branch head can bypass the release decision.

| Piece         | Recommendation                                                                                                                                                                                    | Alternative                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| MongoDB       | **Atlas** — M0 staging, M10 production (backups, metrics, TLS built in; region near India audience e.g. `ap-south-1`)                                                                             | self-hosted Mongo on VPS (only if cost-driven; you own backups) |
| API (Express) | Render native Node in Singapore, pinned to Node 24 LTS/npm 11.6.1, with runtime secrets and `/readyz` health checks                                                                               | Self-managed Node process + Caddy (no containers)               |
| Web           | **Vercel** Next.js project rooted at `apps/client`, using the checked-in workspace install/build contract; Render native Next remains a single-instance fallback until shared-cache/fan-out proof | Render native Node standalone artifact                          |
| CI/CD         | GitHub Actions: fail-closed test/integration/build/P10 gates; release engineer manually deploys the exact green commit to staging, then manually promotes the accepted release to production      | —                                                               |
| DNS/TLS       | platform-managed certs; apex + `www`; HSTS                                                                                                                                                        | —                                                               |

**Release flow:** merge → CI green → select the exact green commit → deploy the API/jobs to Render and the frontend to the Vercel staging project → remote Playwright/security/k6 smoke against staging → manually promote the accepted release. **Published calculator configuration changes need no application deploy** (that's the platform's point) — only engine/renderer code rides releases; `engineVersion` bumps semver and golden files must be consciously re-locked on any output-affecting change.
**Rollback:** app = restore the previous immutable native deployment/artifact ID; calculator = Studio rollback (republish old version); DB = Atlas point-in-time restore (drilled in P11).
**Ops config:** secrets in host store; log drain; selected release-tagged error-tracking backend per environment (selection remains external); uptime monitor on `/healthz` + one public page.

---

## 19. Production Readiness Checklist

**Correctness** — ☐ all suites green ☐ golden files locked ☐ worked examples reproduce exactly ☐ boundary/demographic/missing matrices pass ☐ Reusability Gate evidence archived
**Config & content** — ☐ only calculators with closed discrepancies, passing required tests, and valid medical review are published ☐ CWS held in draft while its blockers remain ☐ COVID kept internal/non-clinical ☐ every open clarification carried with owner + UI label ☐ disclaimers on every published calculator ☐ per-page SEO meta + sitemap + robots verified
**Security** — ☐ HTTPS/HSTS ☐ helmet/CORS ☐ rate limits verified (429s) ☐ lockout works ☐ authz matrix tested ☐ no scoring data in public payloads (verified by test) ☐ npm audit clean/waived ☐ secrets in store, none in git
**Data** — ☐ Atlas backups on + restore drill done ☐ TTL retention live (assessments/events/login_attempts) ☐ integrity script 100% ☐ indexes verified with explain on top queries ☐ least-privilege DB user
**Ops** — ☐ /healthz+/readyz wired to platform + uptime alerts ☐ selected error tracker receiving ☐ p95 < 300 ms on staging load test ☐ rollup job scheduled + observable ☐ link-check and divergence jobs scheduled with retained evidence ☐ log retention configured
**Docs & handover** — ☑ README clone→install→seed→run and synthetic custom-calculator workflow ☐ external walkthrough completes two independently approved calculators end to end (pending eligible clinical candidates and accountable reviewers) ☐ architecture + runbook docs ☐ clarifications register handed to Niro ☐ launch-scope decision memo signed off

---

## 20. Risks, Assumptions, and Technical Recommendations

### Top risks

| #   | Risk                                                                                                                                                                                                                                                                                                        | Mitigation                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **N1 — CWS framework internally REJECTED** ("no stratified ranges available for client") yet fully configured                                                                                                                                                                                               | Keep CWS `draft` and publish-blocked until Niro confirms. The initial public set is only the subset of Heart/Diabetes/Hypothyroid whose own discrepancy, test, content, and review gates have closed; there is no default publication count |
| 2   | Source defects in XLSX (diabetes age-35 double-band; max 110 vs scale 100; Moderate activity=3 vs IDRS 20 — possible typo; PP cutoffs absent (N3); heart 19–20% category gap; LDL floor "12%–15%" (N7); hypothyroid symptom row unpointed (N5); unisex Framingham (N6); Vascular Age cited but absent (N8)) | Transcribe as-written with flags (already done in configs); one consolidated clarification list to Niro; every interim choice is config data, swappable via Studio without deploy                                                           |
| 3   | Band gaps/unbanded regions (N9: magnesium >2.5, zinc >120, BUN <7, albumin 3.5–3.6, creatinine sub-floor, hemoglobin above ceiling; afternoon cortisol (N2); postmenopausal estradiol (N4); continuous-edge seams like FBS 125–126)                                                                         | Engine treats unbanded as no-score + trace note + result-page transparency; validator allows only flagged `asWritten` gaps; boundary tests regenerate on resolution                                                                         |
| 4   | SEO goal vs SPA rendering                                                                                                                                                                                                                                                                                   | Resolved in P0A: Next.js SSR/ISR for public content; client rendering for interactive forms and Admin Studio                                                                                                                                |
| 5   | Negative-sum or missing-domain normalization is clinically undefined                                                                                                                                                                                                                                        | No implicit clamp, zero, or renormalization; preserve negatives and require an explicit `domainAggregationPolicy` before execution/publication, with clinical review and regenerated tests                                                  |
| 6   | Category boundary semantics (C4: fractional 20–21/30–31/50–51) and missing-value policy (C5) are unconfirmed                                                                                                                                                                                                | Preserve the untouched draft, return declared gap/no-score diagnostics where applicable, and block publication until the discrepancy IDs are resolved; do not install an interim engine default                                             |
| 7   | Medical liability / trust                                                                                                                                                                                                                                                                                   | educational-only disclaimers, provenance-on-every-value UI, lab-variance caveats, conflicts shown never merged, no diagnosis language                                                                                                       |
| 8   | Single-developer schedule slip                                                                                                                                                                                                                                                                              | phase gates are demo-able increments; P5/P6/P9 parallelizable if a second dev joins; scope valve: step-⑥ JSON editor, defer audit-viewer UI                                                                                                 |
| 9   | Unverified external values (Mayo IL-6/anti-TPO/estradiol phases, CDC BMI class bounds, ES 264)                                                                                                                                                                                                              | marked re-verify-before-production in dataset; quarterly link-check job; never hard-coded                                                                                                                                                   |
| 10  | Conversion-factor drift (38.67 library vs 38.61 heart XLSX)                                                                                                                                                                                                                                                 | honor each calculator's own source factor in its config; library documents both; flagged to Niro                                                                                                                                            |

### Assumptions (all flagged, none silent)

- MERN confirmed (brief; audio doesn't name a stack). Monolith, no microservices. English UI first (`en-IN` locale noted).
- The original "2–3 calculators live" target is conditional: Heart, Diabetes, and Hypothyroid may launch only after their individual P0A blockers and approvals close; CWS remains excluded until separately resolved.
- Analytics are first-party; visitor persistence, local storage, consent, and retention require explicit privacy/legal approval. No Google Analytics dependency is assumed.
- Admin users provisioned by seed + admin management; no self-registration.
- Keyword/SEO roadmap research (C11) is a content-planning activity outside the build critical path.

### Technical recommendations

- Use a supported Node LTS and P0B-pinned dependency versions. Select the expression parser only after it passes the P0A whitelist, AST, identifier, and resource-limit tests; exact library/provider choices remain ADR DEF-006/DEF-007.
- Keep `packages/engine` dependency-free (except the expression parser) — it is both the reusability-gate hash target and the future NirogGyan integration surface.
- Treat the five config samples as untouched draft validator fixtures and expected-diagnostic corpus. They are not publishable seed data or passing golden calculators; only approved worked examples may become passing goldens.
- Use `packages/contracts/registers/source-config-discrepancy-matrix.md` as the canonical clarification register. Mirror resolved IDs in future config clarification references without duplicating or silently rewriting the register.

---

## 21. Complete Final Development Roadmap

_Solo timeline (~12 weeks — matches the §14 phase sums; compress toward 8–10 weeks only with a second developer on P5/P6/P9):_

```
Week 1–1.5    P0B Setup ▸ P1 Data model + contract-validator implementation
Week 2–3      P2 Engine (dependency-ordered v1 primitives, trace, approved goldens)
Week 3.5–5    P3 Public APIs ▸ P4 Admin auth + APIs
Week 5–6.5    P5 Public frontend (renderer, results, SEO)
Week 6.5–7    P6 Biomarker library (data + pages)
Week 7–8.5    P7 Admin Builder (Calculator Studio)
Week 9        P8 Niro calculator configuration + golden verification
Week 10       P9 Analytics + Admin Dashboard
Week 11       P10 Testing, hardening, Reusability Gate
Week 12       P11 Deploy + monitoring ▸ P12 Readiness + launch
```

**Milestones:** M1 (mid W2) validator reproduces the P0A structural passes and exact semantic/clinical diagnostics for all five drafts · M2 (end W3) the nonclinical fixture passes and Heart base-stage reproduces 13→10%, while unresolved full calculators fail/no-score as specified · M3 (end W7) full anonymous user journey works on staging with approved fixtures · M4 (mid W9) a non-developer can validate/preview a contract-valid calculator and publish only when all gates are satisfied · M5 (end W10) dashboard runs on representative data · M6 (end W11) genuinely-new-calculator Reusability Gate evidence · M7 (W12) platform production readiness, with only the clinically/content-approved calculator subset public.

**Definition of project done** (synthesized from word/ plan + generate_pdf.py gates): all four Niro calculators entered and correct with explainable results; a new calculator can be created and published through the Studio without a developer; every medical value answers "where did this come from?"; every published result is reproducible from versionId + engineVersion + inputs; admin dashboard reports traffic, funnels, leads, security, and health; test suite + Reusability Gate evidence archived; open clarifications formally handed to Niro.

---

## 22. Health Test & Calculator Catalog Expansion (beyond the Niro sources)

The client's growth thesis is a **large catalog of interlinked calculators capturing long-tail search traffic**. This section defines how the platform grows past the 4 Niro calculators to the tests and measurements commonly available on real-world health platforms today — as **data, never code**.

### 22.1 Deliverable files (in `data/catalog/`) — RESEARCH COMPLETE, IMPORT QUARANTINED by P0A

- **[data/catalog/health-calculator-catalog.json](data/catalog/health-calculator-catalog.json)** — **62 post-dedup research calculator records** (not contract-valid calculator versions), with merged provenance under `mergedFrom`, legacy-key aliases, a **73-entry platform inventory**, and **144 tracked issues**. Pre-cleanup originals are in `data/catalog/backup-2026-08-20/`.
- **[data/catalog/measurements-reference-extension.json](data/catalog/measurements-reference-extension.json)** — **79 legacy measurement research records: 65 proposed analytes + 14 `libraryMerge` enrichments**. P0A found at least 20 reversed conversion factors plus malformed zero/temperature/composite conversions and incomplete merged-host materialization; none may be bulk imported before the measurement integrity gates pass.
- **[data/catalog/Health-Test-Catalog.md](data/catalog/Health-Test-Catalog.md)** — human-readable companion: full tiered catalog, engine-extension gate, licensing register, and the pre-publish re-verification list.

### 22.2 Sourcing rules (hard constraints, identical to the existing platform policy)

Every threshold/formula/range in the catalog comes **only** from: WHO, CDC, NIH family (MedlinePlus/ODS/NIDDK/NHLBI), NCBI (StatPearls/PMC), AHA/ACC, ADA, NKF/KDIGO, ATA, ACOG, USPSTF, FDA, NHS, NICE, Mayo Clinic, Cleveland Clinic, Dietary Guidelines/health.gov, and MDCalc **with its primary-literature citation carried alongside**. Each value records `{org, title, url, accessed, verification: fetch-verified | search-verified | blocked-cited}`. Values that cannot be verified are marked `needs-verification` and are **blocked from publish** by the builder until resolved. Conflicting authorities are recorded side-by-side, never merged. No blogs, SEO sites, forums, or unsourced memory — ever.

### 22.3 Catalog scope (category map)

| Category                           | Representative calculators/tests (researched)                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body & anthropometry               | BMI (WHO + WHO Asian cutoffs — India-relevant), BSA (Mosteller/Du Bois), waist circumference risk, waist-to-hip ratio (WHO), waist-to-height ratio (NICE), body fat % (US Navy method), ideal body weight (Devine), lean body mass (Boer), BMR (Mifflin-St Jeor / Harris-Benedict), TDEE & calorie needs                                                             |
| Cardiovascular & vitals            | BP category (ACC/AHA, incl. diastolic), MAP, pulse pressure, resting HR, max HR (220−age / Tanaka), target HR zones (Karvonen), cholesterol ratios (TC/HDL, non-HDL, LDL/HDL), ASCVD 10-yr risk (tiered — needs ln/exp)                                                                                                                                              |
| Metabolic & diabetes               | HOMA-IR, QUICKI, FINDRISC, ADA risk test, metabolic syndrome criteria (harmonized, Asian waist cutoffs), OGTT categories                                                                                                                                                                                                                                             |
| Kidney & hydration                 | eGFR CKD-EPI 2021 (race-free), Cockcroft-Gault CrCl, KDIGO G/A staging, BUN:creatinine ratio, daily fluid intake                                                                                                                                                                                                                                                     |
| Liver & alcohol                    | FIB-4, APRI, AST/ALT ratio, standard drinks & low-risk limits (NIAAA/NHS), AUDIT-C                                                                                                                                                                                                                                                                                   |
| Respiratory & smoking              | Pack-years (+ USPSTF lung-screening eligibility), predicted peak flow, FEV1/FVC interpretation, SpO2 ranges, respiratory rate                                                                                                                                                                                                                                        |
| Women's & reproductive             | Due date (Naegele/ACOG), gestational age, ovulation/fertile window, pregnancy weight gain (IOM/NAM by BMI), cycle normals; growth percentiles (tier-3, needs LMS dataset primitive)                                                                                                                                                                                  |
| Mental health, sleep, lifestyle    | PHQ-9, GAD-7 (public domain; crisis-resource disclaimers mandatory), PSS-10, sleep duration by age, caffeine limits (FDA/ACOG); Epworth flagged (licensed — tier 3)                                                                                                                                                                                                  |
| Lab panel extension (measurements) | CBC extras (RBC, Hct, MCH, MCHC, RDW, differential), iron studies (iron, TIBC, transferrin saturation), electrolytes (Na/K/Cl/CO₂), calcium (+corrected-calcium formula), phosphate, non-HDL / Friedewald LDL / VLDL, ALP, direct bilirubin, total protein/globulin, amylase/lipase, LDH, CK, PSA (with screening-controversy caution), vitals (temp, DBP, SpO2, RR) |

Tiering: **Tier 1** = high-SEO consumer tools aligned with the lab-report identity (BMI family, BMR/TDEE, BP category, cholesterol ratios, eGFR, HOMA-IR, FINDRISC, due date, PHQ-9/GAD-7, pack-years, water intake). **Tier 2** = solid additions (BSA, WHtR, body fat, FIB-4, APRI, AUDIT-C, ovulation, sleep, Cockcroft-Gault). **Tier 3** = needs new primitives, licensing, or clinical caution (ASCVD, growth percentiles, Epworth, PSA tools).

### 22.4 Post-quarantine authoring algorithm — reviewed research record ➜ live calculator

This pipeline starts only after the relevant ADR-026 measurement, conversion, merged-host, source, licensing, and mapping gates pass. A legacy catalog row is never executable merely because it exists.

1. **Select and re-verify** one record; close its `search-verified`, `blocked-cited`, conversion, licensing, applicability, and open-issue blockers.
2. **Migrate/author manually in the Studio** into the versioned calculator/content/measurement contracts. Legacy fields are mapped with review; they are not assumed to be 1:1. A medical parameter links to a stable measurement identity/revision and embeds its approved runtime snapshot.
3. **Validate all four layers** using the stable P0A rules. Source-preserved gaps remain explicit; publish eligibility is computed.
4. **Test** with reviewer-approved source examples and generated boundary/missing/context cases. If no complete source example exists, authors must obtain one; the catalog does not manufacture an expected result.
5. **Preview → review → publish atomically** only after content, claim citations, required tests, source evidence, and medical review pass. Related measurement/calculator links feed the SEO interlinking contract.

The bulk importer is deferred under ADR DEF-011 and is not part of P0B–P12. After a record is migrated to a supported schema/semantic version, it runs through the same pure dependency-ordered engine with **zero calculator-specific code**; records needing unsupported primitives wait for a later versioned contract.

**Engine extensions required (final list from the research pass — versioned, small, one-time):**

| Extension                                                                                                          | Needed by                                                                                                                                                 | When                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Implement the v1 allowlisted `ln()`, `exp()`, `log10()`, `sqrt()` and fractional/negative finite `pow()` semantics | FIB-4 (√ALT), TyG (ln), QUICKI (log10), US Navy body fat (log10), BSA Du Bois (pow 0.725), CKD-EPI 2021 (pow −0.241/−1.200), later ASCVD/PREVENT (ln+exp) | **P2** — semantics already locked in P0A; implementation + tests only                                       |
| Implement v1 affine unit conversion (`canonical = entered × factor + offset`)                                      | body temperature °F↔°C and all linear conversions                                                                                                         | **P2** — schema/semantics already locked; bad legacy factors stay quarantined                               |
| Piecewise/coefficient-set formulas                                                                                 | CKD-EPI (sex × creatinine band), Hankinson PEF polynomials, ASCVD tables                                                                                  | expressible today via nested ternaries + contexts; add `coefficientSets` sugar later if authoring gets ugly |
| Date arithmetic (`date` input type; `dateAdd`, `dateDiff`, weeks+days formatting)                                  | due date, gestational age, ovulation, trimester — the pregnancy SEO cluster                                                                               | engine **v1.1** (post-launch)                                                                               |
| 2-D / composite-key lookup                                                                                         | KDIGO G×A risk heat-map (workaround today: 18 nested conditions)                                                                                          | v1.1 convenience                                                                                            |
| Bulk dataset lookup (`datasetRef`: WHO/CDC growth LMS) + normal CDF + interpolation                                | child growth percentiles, GLI z-scores, Martin-Hopkins LDL                                                                                                | only when tier 3 is scheduled                                                                               |
| Iterative simulation                                                                                               | NIDDK Body Weight Planner                                                                                                                                 | **rejected** — not config-expressible; link out                                                             |
| Crisis-interstitial UI block (product feature, not math)                                                           | PHQ-9 item-9 escalation + 988-resources block on every mental-health tool                                                                                 | required before any mental-health calculator ships                                                          |

**Governance additions from the research:** licensing register (Epworth/FRAX/STOP-BANG/CAT blocked without license; PSS-10 commercial permission unresolved; ADA test and AHA "Life's Essential 8" branding checks) and a pre-publish re-verification list of 403-blocked primary pages (CDC, NICE, WHO IRIS, ACOG, NIAAA, dietaryguidelines.gov, heart.org, PCE coefficient appendix) — both enumerated in `data/catalog/Health-Test-Catalog.md`; every affected value is marked `search-verified`/`blocked-cited` in the JSON and blocked from publish until captured verbatim.

**Rollout:** catalog calculators are post-core selective authoring work only after the quarantine/integrity gates close. They do not extend the P0B–P12 core build timeline and are not auto-imported. Date arithmetic, 2-D lookup, and datasets require later versioned schema/semantic decisions. Keyword research (C11) may order clinically/licensing-approved candidates; India-context rules ship as labeled, cited context branches, never merged defaults.

## 23. Current execution gate (2026-08-29)

P0A–P7, P9, and the canonical local P10 Atlas-backed browser/Reusability/k6 gate are complete; P8 engineering reconciliation is complete and clinically blocked. Render API/jobs and the Vercel frontend contract are repository-configured for P11, but real provider deployment, recovery, operations, policy, clinical, and launch gates remain external and unchecked. The current control-plane audit is `docs/operations/provider-access-audit-2026-08-30.md`.

No Niro calculator is published or eligible. The four source-labeled candidates remain application drafts; the 40 core measurement revisions remain draft and unreviewed; COVID remains internal/nonclinical; and the quarantined 62-calculator/79-measurement research catalog remains unimported. Catalog bulk import is not permitted by this plan, and selective post-launch authoring cannot begin until the affected source/licensing/measurement/clinical gates close.

**Historical checkpoint (superseded; retained for provenance):** on 2026-08-26, P0A through P6 were complete, Atlas connectivity and the P6 isolated acceptance passed, and P7 was the next approval-gated phase. The completed P7–P9 records in §15 and the current paragraph above supersede that execution state.

## 24. P8/P9 closeout appendix (2026-08-28)

### Preservation and functional inventory

- No source, configuration, schema, dataset, historical artifact, or clinical value was intentionally deleted or overwritten during P8/P9. Original Niro sources and all five immutable configuration fixtures remain byte-preserved; generated reconciliation/divergence artifacts are additive and reproducible.
- P8 functional artifacts are grouped under `data/reconciliation/`, `data/goldens/heart-base-stage.v1.json`, `packages/contracts/reports/niro-external-divergence.v1.{json,md}`, the P8 validators, and the guarded `scripts/reconcile-niro-drafts*`, `scripts/generate-niro-divergence-report*`, and `scripts/import-niro-drafts-live*` command/test families.
- P9 functional artifacts are grouped under `packages/contracts/src/analytics-api.ts`, `packages/contracts/specs/analytics.v1.md`, `apps/server/src/analytics/`, the analytics server modules and persistence models, `apps/client/src/analytics/`, `apps/client/src/admin/analytics/`, and the guarded `scripts/analytics-rollup*` and `scripts/p9-analytics-integration.ts` command/test families. Root environment examples, package scripts, READMEs, this plan, and `Claude-Context.md` record the integration boundary.
- This is a functional inventory, not a forensic version-control diff: the supplied workspace does not contain repository `.git` metadata. Historical files are therefore retained and labeled rather than treated as deletable duplicates.

### Manual policy, clinical, and production actions

1. The clinical/source owner must resolve and cite Diabetes DIA-01–04, DIA-06–07, and DIA-09–14; Heart HRT-01–14, HRT-16–18, and HRT-20; Hypothyroid HYP-01–07; and CWS N1, CWS-01, CWS-03–16, and CWS-18–20. Complete worked examples are still required; the supplied Heart base-stage example is partial only.
2. An authorized reviewer must review the 40 draft measurement revisions, and a named independent medical reviewer with accepted credentials/jurisdiction must approve each publish candidate. No implementation task may infer either approval.
3. Product/legal owners must approve retention periods, analytics cohort/identity/consent policy, lead consent/version, privacy notice, disclaimers, publication copy, canonical production host, and production assets. Set the corresponding server-only and `NEXT_PUBLIC_*` policy variables through the ignored project-root `.env` for local acceptance and the deployment secret manager for hosted environments; never commit values or put server secrets in a browser variable.
4. P11 must select and configure the external current-day/nightly/reconciliation scheduler, fleet metrics scraper/backend, cross-instance cache-invalidation provider, deployment secret manager, Atlas production access/network policy, backups, and restore drill.

### Final verification record

- **`npm run check`: PASS.** All four workspace typechecks, ESLint, and repository formatting passed; 364 tests across 54 files passed (contracts 25/7 files, engine 17/3, server 129/14, client 131/22, scripts 62/8).
- **`npm run build`: PASS.** Contracts, engine, Express server, and the optimized Next.js production application built successfully; all static and dynamic routes completed page-data generation.
- **Atlas and persistence: PASS at the recorded phase checkpoints.** The final ping returned `status: ok` for `niro_dev` with ready state 1; transaction/public/admin/P6/P7/P8 acceptance remained green. The final isolated P9 integration passed atomic attribution, indexes/TTL, transactions, retention, rollups, leases, RBAC, exports, and cleanup in owned database `niro_p9_a589059604b840bbb7aa8937408229`.
- **Responsive browser/accessibility acceptance: PASS for the completed P8/P9 scope.** The P9 fixture rendered all six dashboard panels, accepted a public event with 202, produced no console errors or document-level overflow, and retained the existing automated accessibility checks. Full Playwright journeys, axe/keyboard E2E, and the genuinely-new-calculator Reusability Gate remain P10 work.
- **Dependency/security audit: PASS.** Both `npm audit` and `npm audit --omit=dev` reported zero vulnerabilities; the independent P8/P9 audit returned GREEN with no release blocker.

### Historical next phase (superseded 2026-08-29)

P10 was next at this checkpoint. The current state is recorded in §23 and §25; no P10 implementation remains independent of the external Atlas/live environment.

## 25. P10–P12 blocked-state closeout (2026-08-29; reconciled 2026-08-30)

### Settled repository verification

- `npm run check`: PASS — all workspace and root-tool typechecks, ESLint, formatting, and 471 tests passed (contracts 27, engine 30, server 154, client 138, scripts 122) across 76 files.
- `npm run build`: PASS — contracts, engine, Express server, and the optimized Next.js 16 application built; all static/dynamic route generation completed.
- P10 focused static gate: PASS — 41 tests across fixture matrices, security hardening, fixture ownership, hash protection, performance harness, link safety, and workflow/evidence wiring.
- Generated contract drift, all five locked fixture diagnostics, 40-record measurement integrity, P8 divergence, P8 publication readiness, calculator-name engine grep, and both dependency audits pass. The Heart locked fixture total is now 16 because the preserved age-50 imputation overlap is explicitly diagnosed; the fixture itself and its clinical values did not change.
- Automated component accessibility checks pass against two structurally independent nonclinical configurations. The live production-standalone Playwright specification passed axe, focus-visible keyboard traversal, 375×812 layout/no-overflow, public partial-input/share behavior, Studio authoring/review/publication, public projection privacy, and protected-source hashes.

### External and manual boundary

- Atlas development ping and guarded live integrations succeed. Final terminal run `p10-1e255924438c4d8ef8c3a63f19b3d5-0b7e75fd` under `docs/operations/evidence/p10/` records `guardedAtlasCleanup: completed`, protected hash `78dafa32c62a692b4bbaf2367636554ae133fd17c672bf6d33f8a1b8519840b1`, the staged standalone server, and a self-generated 43-artifact manifest. Every manifest hash/size passed and a separate name-only Atlas listing verified the exact owned database absent; earlier P10 archives remain retained for provenance.
- Official checksum-verified k6 1.7.1 passed 20/20 checks with zero failed requests, warm configuration 304, and 113.152975 ms assess p95; the independent 18-request sampler passed at 132.16 ms p95.
- Native server/client builds, standalone asset packaging/direct startup, health behavior, worker wiring, Render Blueprint semantics, and deployment contracts pass locally. The focused production/deployment/restore/CI-wiring set passes 33 tests; the provider-specific Render Blueprint suite is tracked separately. Docker/Kubernetes are explicitly non-selected; no container action occurred. Render is signed out; Vercel is authenticated but has no `athnect` project. No authoritative Git restore/push, protected GitHub environment/secret/variable or required-status configuration, full hosted CI artifact, production Atlas, Render/Vercel staging or production deployment, remote browser/security/k6 acceptance, top-query explain-plan capture, backup/restore drill, application rollback drill, DNS/TLS/HSTS configuration, external link/divergence scheduler execution, fleet monitoring, alert delivery, or test incident is claimed.
- The exact clinical, policy, hosting, and operations owners/actions are maintained in `docs/operations/launch-readiness.md`. Until evidence is attached, the launch decision remains NO-GO.
