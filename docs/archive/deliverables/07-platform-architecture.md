# Reusable Platform Architecture + Module Breakdown

> Deliverables 10 & 13. The architecture that makes the platform's core promise true: **new calculators are configuration, not code.**

---

## 1. The two-layer principle

```
╔══════════════════════════════════ CORE PLATFORM (code — built once) ══════════════════════════════════╗
║  Dynamic Renderer · Field/Block Registries · Validation Service · Rule/Formula Engine ·                ║
║  Calculation Service · Config Validator · Versioning · Public & Admin APIs · Auth · Persistence        ║
╚═══════════════════════════════════════════════▲═══════════════════════════════════════════════════════╝
                                                │ interprets (never contains)
╔═══════════════════════════════ CONFIGURABLE CALCULATOR DATA (documents) ══════════════════════════════╗
║  Calculator definitions · Parameters · Units · Scoring bands · Conditions · Adjustment rules ·         ║
║  Formulas · Domain weights · Result categories · UI layout · Biomarker library + source attributions   ║
║                                                                                                        ║
║   e.g.  [ Niro CWS v3 ]   [ COVID-19 Risk v1 ]   [ future calculator — just another document ]         ║
╚════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

Adding the Nth calculator touches **only the bottom layer**. The top layer changes only when a genuinely new *primitive* is needed (a new input kind, a new result visual) — and those land in registries, available to all calculators at once.

---

## 2. End-to-end runtime flow

```
 User
  │ browse / fill form
  ▼
 React Dynamic Calculator UI  ── GET /calculators/:slug ──►  Config cache ──► calculator_versions
  │ POST /calculators/:slug/assess                                                (published, immutable)
  ▼
 Express API layer (routes, rate limit, sanitation)
  ▼
 Validation Service  ◄─── parameter definitions (config)
  ▼
 CALCULATION ENGINE  ◄─── scoring bands · conditions · formulas · weights · adjustments · categories (config)
  │    normalize → derive → score → aggregate → weight → adjust → categorize → contributors (+trace)
  ▼
 Persistence: assessments + results (with calculatorVersionId + engineVersion)
  ▼
 Result / Insight layer  ──►  score · category · why · domain detail · biomarker detail · recommendations
  ▼
 React result page (block registry)
```

Admin path:

```
 Admin ──► Builder UI ──► Admin API ──► draft calculator_versions
              │                              │
              │   validate ──► Config Validator (same rules the engine trusts)
              │   preview  ──► SAME Engine (dry-run + trace)
              │   test     ──► saved test-case runner
              └── publish  ──► immutable version + cache invalidation + audit log
```

---

## 3. Module breakdown

### 3.1 Frontend (React)

| Module | Responsibility | Depends on |
|---|---|---|
| Calculator Directory | List published calculators (cards, categories) | Public API |
| **Dynamic Calculator Renderer** | Render any calculator from config: steps, fields, units, visibility, client validation | Field Registry, config |
| Field Registry | inputType → component map (number/select/radio/boolean) | — |
| **Result Renderer** | Render any result from config layout | Block Registry, result payload |
| Result Block Registry | gauge, category, contributors, domain breakdown, biomarker details, recommendations | — |
| Biomarker Views | Library list/search/category + detail pages; "learn more" targets | Public API |
| Admin Calculator Builder | 7-step builder: details, parameters, scoring, domains, categories, UI, preview/validate/test/publish | Admin API |
| Shared UI kit | form primitives, layout, theming | — |

### 3.2 Backend (Node/Express)

| Module | Responsibility | Depends on |
|---|---|---|
| Calculator API | Public config reads (projection, ETag) | Config Service |
| Assessment API | POST assess orchestration | Validation, Engine, Persistence |
| Result API | Stored result reads | Persistence |
| Biomarker API | Library reads (+admin CRUD) | Persistence |
| Admin API | Drafts, validate, preview, publish, auth, audit | Config Service, Validator, Engine |
| Config Service | Load/cache published versions; draft CRUD; version lifecycle | MongoDB |
| **Config Validator** | Static config correctness (weights, band coverage, formula parse, cycles) | Expression parser |
| Validation Service | Runtime input validation from config | Config |
| **Rule / Formula Engine** | The 10-stage deterministic pipeline (see 13-calculation-engine-design.md) | Config only |
| Result/Insight Service | Contributor ranking, recommendation resolution, result assembly | Engine output, config |
| Auth | JWT admin auth, roles | admin_users |
| Audit | Config-change log | MongoDB |

### 3.3 Database (MongoDB)

`calculators`, `calculator_versions`, `biomarkers`, `assessments`, `results`, `admin_users`, `audit_logs` — full schemas in [09-mongodb-data-model.md](09-mongodb-data-model.md).

---

## 4. "Add a COVID Risk Calculator tomorrow" — the actual process

1. Admin → **New Calculator** → name/description/disclaimer (2 min)
2. **Parameters**: age, sex, symptoms (multi/boolean), comorbidities (boolean), vaccination status (select) — from library or custom (15 min)
3. **Scoring**: points per option / age bands via band editor; no domains needed → single implicit domain (15 min)
4. **Result categories**: Low / Moderate / High with messages + next-step advice (10 min)
5. **UI**: one or two steps, pick result blocks (5 min)
6. **Preview** with sample personas → **Validate** → **Test cases** → **Publish**

No React page created. No backend service written. No deploy. The same renderer and the same engine serve it immediately at `/c/covid-19-risk`.

---

## 5. Architectural decisions & rationale

| Decision | Rationale |
|---|---|
| Monolith MERN app (not microservices) | Assignment-scale; brief explicitly warns against over-engineering. Engine is a pure module — extractable later if ever needed. |
| Config snapshots embedded per version | Audit-grade reproducibility; single read; no join fan-out. |
| Engine = pure function, config in / result out | Deterministic, unit-testable, no hidden state; satisfies brief §10 (separate deterministic engine from explanation). |
| Same validator + engine used by builder preview | Eliminates "worked in admin, broke in prod" class of bugs. |
| Scoring internals stripped from public config API | Server-authoritative scoring; prevents client tampering/scraping of proprietary Niro thresholds. |
| Biomarker library separate from calculators | Knowledge maintained once; NirogGyan-style reference pages; source attributions live with the data they justify. |
| Anonymous-first assessments | Matches lead-magnet positioning; email capture optional, never blocking. |

---

## 6. Non-functional requirements

- **Performance:** config cached in memory (invalidate on publish); engine executes in ms; assess round-trip target < 300 ms server-side.
- **Security:** JWT admin auth, bcrypt, rate limiting on public endpoints, input sanitation, no scoring data leaked publicly, no PII required to use.
- **Compliance posture:** educational disclaimers configured per calculator; assessments anonymized by default; retention policy via TTL index (configurable).
- **Observability:** request logging, engine trace retained per result, audit log for config changes.
- **Testability:** engine 100% unit-testable; config validator prevents bad publishes; per-calculator test cases stored as data.
