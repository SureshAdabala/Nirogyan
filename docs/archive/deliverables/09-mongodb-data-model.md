# MongoDB Data Model — Reusable Health Calculator Platform

> Deliverable 14 of the final deliverable set. Design goal: **new calculators must not require schema redesign**. All calculator-specific behaviour lives in *data* (configuration documents), not in *code* or *schema shape*.

---

## 1. Design Principles

1. **Configuration is data.** A calculator is a document, not a code module. Adding a calculator = inserting documents.
2. **Versions are immutable snapshots.** A published `CalculatorVersion` embeds the complete runnable configuration (parameters, rules, formulas, result categories, UI config). Once published it is never mutated — edits create a new version. Every stored result references the exact version that produced it → full auditability.
3. **The biomarker library is platform-level and reusable.** Calculators *reference* biomarkers; biomarker knowledge (description, ranges, source attribution) is maintained once and reused by any calculator.
4. **Source traceability is first-class.** Every biomarker range/threshold and every scoring rule carries a `source` block: `niro` | `external` | `needs-clarification`.
5. **Embed what is read together; reference what is shared.** A calculator version's config is always read as a unit → embed. Biomarkers are shared across calculators → reference.

---

## 2. Collection Overview

| Collection | Purpose | Written by | Read by |
|---|---|---|---|
| `calculators` | Calculator identity + lifecycle | Admin Builder | Public API, Admin |
| `calculator_versions` | Immutable full config snapshots | Admin Builder | Engine, Renderer, Admin |
| `biomarkers` | Platform biomarker library + source attribution | Admin (seeded from dataset) | Renderer, Engine, Biomarker pages |
| `assessments` | One user submission (inputs, demographics) | Public assess API | Result API, Admin analytics |
| `results` | Computed output + full calculation trace | Calculation Service | Result API, Admin analytics |
| `admin_users` | Builder/admin accounts | Auth service | Auth service |
| `audit_logs` | Who changed which config, when | All admin writes | Admin |

Relationships:

```
Calculator 1 ──── * CalculatorVersion          (identity → snapshots)
CalculatorVersion.parameters[].biomarkerKey ──→ Biomarker   (optional reference)
Assessment * ────→ 1 CalculatorVersion         (exact config that ran)
Result 1 ────────→ 1 Assessment                (computed output + trace)
Biomarker ───────→ Domain (embedded key)       (domain is config data, not schema)
```

---

## 3. `calculators`

```js
{
  _id: ObjectId,
  slug: "niro-cws",                  // stable public identifier, unique index
  name: "Niro Comprehensive Wellness Score",
  shortDescription: "…",
  purpose: "…",
  tags: ["wellness", "biomarkers"],
  status: "published",               // draft | published | archived
  currentVersion: 3,                 // pointer to the live version number
  draftVersion: 4,                   // version being edited (nullable)
  createdBy: ObjectId(admin_users),
  createdAt: ISODate, updatedAt: ISODate
}
```

Indexes: `{ slug: 1 } unique`, `{ status: 1 }`.

---

## 4. `calculator_versions` — the heart of the platform

One document = one complete, runnable calculator definition.

```js
{
  _id: ObjectId,
  calculatorId: ObjectId,
  calculatorSlug: "niro-cws",
  version: 3,
  status: "published",              // draft | in-review | published | retired
  changelog: "Adjusted HDL female threshold per Niro sheet v2",
  publishedAt: ISODate, publishedBy: ObjectId,

  // ---- 4.1 PARAMETERS ----------------------------------------------------
  parameters: [
    {
      key: "hdl",                       // unique within calculator
      label: "HDL Cholesterol",
      biomarkerKey: "hdl-cholesterol",  // optional link into biomarker library
      group: "cardiovascular",          // grouping for UI + domain scoring
      inputType: "number",              // number | select | radio | boolean | derived
      unit: {
        canonical: "mg/dL",
        allowed: [                      // unit conversion table (config, not code)
          { code: "mg/dL", factor: 1 },
          { code: "mmol/L", factor: 38.67 }   // value * factor → canonical
        ]
      },
      validation: { required: true, min: 5, max: 150, decimals: 1 },
      missingPolicy: "exclude-from-max",   // exclude-from-max | zero-points | block
      options: null,                    // for select/radio: [{value,label,points}]
      derived: null,                    // for derived params: { formula: "28.7*hba1c-46.7", dependsOn:["hba1c"] }
      visibility: null,                 // conditional display, e.g. { all:[{param:"sex",op:"eq",value:"female"}] }
      help: { text: "…", learnMoreBiomarkerKey: "hdl-cholesterol" },
      order: 20
    },
    // … demographic parameters use the same shape:
    { key: "sex", label: "Sex", inputType: "select",
      options: [ { value: "male", label: "Male" }, { value: "female", label: "Female" } ],
      validation: { required: true }, group: "profile", order: 1 }
  ],

  // ---- 4.2 SCORING RULES -------------------------------------------------
  // Band-based parameter scoring. `when` selects the context (sex/age/etc.).
  scoringRules: [
    {
      parameterKey: "hdl",
      contexts: [
        {
          when: { all: [ { param: "sex", op: "eq", value: "male" } ] },
          bands: [
            { min: 60, max: null, points: 0, interpretation: "optimal",   source: { type: "niro", ref: "Risk Logic Sheet!B12" } },
            { min: 40, max: 60,  points: 1, interpretation: "acceptable", source: { type: "niro", ref: "Risk Logic Sheet!B13" } },
            { min: null, max: 40, points: 3, interpretation: "low",       source: { type: "niro", ref: "Risk Logic Sheet!B14" } }
          ]
        },
        { when: { all: [ { param: "sex", op: "eq", value: "female" } ] }, bands: [ /* … */ ] }
      ],
      bandEdges: "min-inclusive"        // explicit boundary semantics
    }
  ],

  // ---- 4.3 DOMAINS + WEIGHTS --------------------------------------------
  domains: [
    { key: "cardiovascular", label: "Cardiovascular", weight: 0.25,
      parameterKeys: ["total-cholesterol","hdl","ldl","triglycerides","systolic-bp","hscrp","apob-apoa-ratio"],
      scoreFormula: "sum(points) / maxPoints * 100" },   // documented Niro domain formula
    { key: "metabolic", label: "Metabolic", weight: 0.20, parameterKeys: [ /* … */ ] }
    // … weights must sum to 1.0 — enforced by config validator
  ],

  // ---- 4.4 ADJUSTMENT RULES ---------------------------------------------
  // Post-weighting additive rules (age / BMI / smoking / activity in Niro CWS)
  adjustmentRules: [
    {
      key: "smoking-adjustment",
      when: { all: [ { param: "smoking", op: "eq", value: "current" } ] },
      action: { addToFinalScore: 10 },       // exact value from Niro sheet
      label: "Current smoker",
      source: { type: "niro", ref: "Risk Logic Sheet!Adjustments" }
    }
  ],

  // ---- 4.5 FORMULAS (named, reusable in this calculator) ------------------
  formulas: [
    { key: "raw-score", expression: "weightedSum(domains)", description: "Σ domainScore × weight" },
    { key: "final-score", expression: "rawScore + sum(adjustments)" }
  ],

  // ---- 4.6 RESULT CATEGORIES ---------------------------------------------
  resultCategories: {
    scale: { min: 0, max: 100, direction: "lower-is-better" },
    bandEdges: "min-inclusive",
    bands: [
      { label: "Optimal",    min: null, max: 10, color: "#1a9850", message: "…", recommendations: ["…"] },
      { label: "Good",       min: 10,  max: 21, color: "#66bd63", message: "…", recommendations: ["…"] },
      { label: "Fair",       min: 21,  max: 31, color: "#fee08b", message: "…", recommendations: ["…"] },
      { label: "Suboptimal", min: 31,  max: 51, color: "#f46d43", message: "…", recommendations: ["…"] },
      { label: "Poor",       min: 51,  max: null, color: "#d73027", message: "…", recommendations: ["…"] }
    ]
  },

  // ---- 4.7 UI CONFIG ------------------------------------------------------
  uiConfig: {
    theme: { accent: "#0f766e" },
    steps: [                              // multi-step form definition
      { key: "profile", title: "About you", parameterGroups: ["profile", "lifestyle"] },
      { key: "labs",    title: "Your lab values", parameterGroups: ["cardiovascular","metabolic", "…"] }
    ],
    result: {
      layout: ["score-gauge","category","key-contributors","domain-breakdown","biomarker-details","recommendations"],
      showDomainRadar: true
    },
    disclaimers: ["This tool is educational and not a medical diagnosis."]
  }
}
```

Indexes: `{ calculatorId: 1, version: -1 }`, `{ calculatorSlug: 1, status: 1 }`.

**Why embed the whole config?** It is always read/executed as a unit; snapshot semantics give audit-grade reproducibility; typical size is tens of KB (Niro CWS ≈ 40 parameters → well under MongoDB's 16 MB limit).

---

## 5. `biomarkers` — platform library

```js
{
  _id: ObjectId,
  key: "hdl-cholesterol",              // unique index
  displayName: "HDL Cholesterol",
  altNames: ["High-Density Lipoprotein", "HDL-C"],
  domain: "cardiovascular",            // default domain classification
  description: "…",
  whatItMeasures: "…",
  whyItMatters: "…",
  units: { canonical: "mg/dL", conversions: [{ code: "mmol/L", factor: 38.67 }] },

  referenceModel: {
    // Interpretation bands INDEPENDENT of any calculator's scoring —
    // used by biomarker detail pages and generic interpretation.
    contexts: [
      {
        when: { sex: "male" },
        referenceRange: { low: 40, high: null, unit: "mg/dL" },
        optimalRange:   { low: 60, high: null, unit: "mg/dL" },
        bands: [
          { label: "Low",     max: 40 },
          { label: "Normal",  min: 40, max: 60 },
          { label: "Optimal", min: 60 }
        ]
      },
      { when: { sex: "female" }, /* … */ }
    ]
  },

  interpretationText: { low: "…", normal: "…", optimal: "…" },
  recommendations: { low: ["…"], high: ["…"] },

  // ---- SOURCE TRACEABILITY (mandatory) ----
  sources: [
    {
      claim: "Low HDL threshold <40 mg/dL (men)",
      type: "external",                        // niro | external | needs-clarification
      organization: "NIH / MedlinePlus",
      title: "HDL: The 'Good' Cholesterol",
      url: "https://medlineplus.gov/hdlthegoodcholesterol.html",
      section: "What are optimal levels?",
      accessedAt: "2026-08-18"
    },
    { claim: "Scoring points 0/1/3", type: "niro", ref: "Niro Risk Logic Sheet", note: "exact cell pending sheet access" }
  ],
  status: "verified"                    // verified | needs-clarification | draft
}
```

Indexes: `{ key: 1 } unique`, `{ domain: 1 }`, text index on `displayName, altNames` for search.

---

## 6. `assessments`

```js
{
  _id: ObjectId,
  calculatorSlug: "niro-cws",
  calculatorVersionId: ObjectId,        // EXACT config that was executed
  sessionId: "anon-uuid",               // anonymous-first (lead-magnet flow)
  contact: { email: null },             // optional lead capture — never required to see results
  inputs: {                             // canonical-unit values AFTER normalization
    sex: "male", age: 44,
    hdl: { value: 38, unit: "mg/dL", enteredValue: 0.98, enteredUnit: "mmol/L" },
    // …
  },
  omittedParameters: ["il-6"],          // explicit record of what was skipped
  clientMeta: { locale: "en-IN", userAgent: "…" },
  createdAt: ISODate
}
```

Indexes: `{ calculatorSlug: 1, createdAt: -1 }`, `{ sessionId: 1 }`, TTL index optional for anonymous data-retention policy.

---

## 7. `results`

Kept separate from `assessments` so recalculation (e.g., after a config fix) can produce a second result for the same submission without mutating history.

```js
{
  _id: ObjectId,
  assessmentId: ObjectId,
  calculatorVersionId: ObjectId,
  engineVersion: "1.2.0",               // platform engine semver
  finalScore: 23.4,
  category: { label: "Fair", color: "#fee08b" },
  rawScore: 21.4,
  domainScores: [
    { domain: "cardiovascular", score: 38.1, weight: 0.25, weighted: 9.53,
      maxPoints: 21, earnedPoints: 8, includedParams: 7, omittedParams: 0 }
    // …
  ],
  parameterScores: [
    { key: "hdl", value: 38, unit: "mg/dL", points: 3, maxPoints: 3,
      interpretation: "low", bandMatched: { min: null, max: 40 },
      contextMatched: { sex: "male" } }
    // …
  ],
  adjustments: [ { key: "smoking-adjustment", applied: true, delta: 10 } ],
  keyContributors: [                     // explanation layer input
    { domain: "cardiovascular", contribution: 9.53, topParams: ["hdl","ldl"] }
  ],
  trace: [                               // ordered engine steps for audit
    "normalize: hdl 0.98 mmol/L → 37.9 mg/dL",
    "score: hdl → band(low, <40, male) → 3 pts", "…"
  ],
  computedAt: ISODate, computeMs: 12
}
```

Indexes: `{ assessmentId: 1 }`, `{ calculatorVersionId: 1, computedAt: -1 }`.

---

## 8. `admin_users` and `audit_logs`

```js
// admin_users
{ _id, email, passwordHash, role: "admin" | "editor", createdAt }

// audit_logs
{ _id, actorId, action: "version.publish", entity: "calculator_versions",
  entityId, calculatorSlug, diffSummary: "…", at: ISODate }
```

---

## 9. How the model satisfies the success criteria

| Success criterion | How the schema answers it |
|---|---|
| New calculator without core rewrite | Insert 1 `calculators` + 1 `calculator_versions` doc. No schema change, no code change. |
| Modify calculator via configuration | New draft version → edit config JSON → validate → publish. |
| Parameters dynamic | `parameters[]` is data; renderer iterates it. |
| Rules/formulas configurable | `scoringRules`, `adjustmentRules`, `formulas` are data interpreted by the engine. |
| Same UI renders multiple calculators | UI reads `parameters` + `uiConfig`; nothing calculator-specific in components. |
| Same engine executes different logic | Engine interprets config primitives (bands, conditions, expressions, weights). |
| Niro representable generically | §4 shows Niro CWS expressed purely as configuration. |
| Second calculator via config | Another `calculator_versions` doc using the same primitives. |
| Medical values traceable | `sources[]` on biomarkers + `source` on every scoring band. |
| Calculation auditable | `results.trace` + immutable `calculatorVersionId` + `engineVersion`. |

---

## 10. Mongoose modelling notes

- Config subdocuments use `strict: false` schemas *validated by the platform's own config validator* (JSON-Schema based), because config shape must be able to evolve without migrations.
- `calculator_versions` uses optimistic concurrency (`versionKey`) to protect concurrent admin edits of drafts.
- All public reads of published config go through a projection that strips admin metadata; heavy read paths use `lean()` and an in-memory config cache keyed by `slug@version` (invalidated on publish).
