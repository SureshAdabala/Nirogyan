# Generic Calculation Engine — Design

> Deliverable 18. The engine is **calculator-agnostic**: it interprets configuration primitives and never contains Niro-specific (or any calculator-specific) logic. Niro's CWS is *data* the engine executes.

---

## 1. Position in the architecture

```
POST /api/calculators/:slug/assess
        │
        ▼
┌─────────────────────────┐     ┌──────────────────────────────┐
│  Validation Service     │◄────│  CalculatorVersion (config)  │
└───────────┬─────────────┘     └──────────────┬───────────────┘
            ▼                                  │ (same config drives every stage)
┌─────────────────────────┐                    │
│  CALCULATION ENGINE     │◄───────────────────┘
│  (pure, deterministic)  │
└───────────┬─────────────┘
            ▼
   Result + full trace  ──►  results collection  ──►  Result/Insight API
```

Engine properties:

- **Pure function**: `execute(config, inputs) → result`. No I/O, no clock, no randomness. Same inputs + same config = same output, forever.
- **Deterministic & auditable**: every step appends to a trace; results store `calculatorVersionId` + `engineVersion`.
- **Separated from explanation**: the engine emits numbers + matched bands + contributors; the presentation/explanation layer turns them into copy. (Source: Niro brief §10 — deterministic engine separate from any AI/explanation layer.)

---

## 2. Execution pipeline (fixed order, config-driven behaviour)

```
1. VALIDATE        inputs against config.parameters[].validation
2. NORMALIZE       units → canonical (config.unit.allowed factors)
3. DERIVE          derived parameters via formulas (topologically sorted, cycle-checked)
4. CONTEXTUALIZE   resolve demographic context (sex, age, …) per parameter
5. SCORE           parameter → band match → points        (scoringRules)
6. AGGREGATE       domain score = Σ earned / Σ max × 100  (domains[].scoreFormula)
7. WEIGHT          raw score = Σ domainScore × weight     (formulas["raw-score"])
8. ADJUST          final = raw + Σ adjustment deltas      (adjustmentRules)
9. CATEGORIZE      final score → result band              (resultCategories)
10. EXPLAIN-DATA   rank contributors (domain & parameter) for the explanation layer
```

Each stage reads **only** configuration + the accumulating context object:

```js
// engine/context shape
{
  inputs: {…},            // canonical values
  derived: {…},
  parameterScores: [...], // {key, value, points, maxPoints, interpretation, bandMatched, contextMatched}
  domainScores: [...],
  rawScore, adjustments: [...], finalScore,
  category, keyContributors: [...], trace: [...]
}
```

---

## 3. Configuration primitives the engine understands

The engine's whole vocabulary — every calculator must be expressible with these, and nothing else:

| Primitive | Purpose | Example |
|---|---|---|
| `number/select/radio/boolean` inputs | Typed values | HDL = 38 mg/dL; smoking = "current" |
| Unit table | Normalization | mmol/L × 38.67 → mg/dL |
| **Condition** (JSON DSL) | Contexts, visibility, adjustments | `{all:[{param:"sex",op:"eq",value:"male"},{param:"age",op:">=",value:45}]}` |
| **Band** | Range → points/interpretation | `{min:40,max:60,points:1,interpretation:"acceptable"}` |
| **Options-points** | Select → points | `{value:"current",points:10}` |
| **Expression** | Derived values & score formulas | `"28.7 * hba1c - 46.7"` |
| **Weighted aggregate** | Domain roll-up | `Σ domainScore × weight` |
| **Adjustment action** | Additive post-processing | `{addToFinalScore: 10}` |
| **Category bands** | Final mapping | `<10 → Optimal` |
| **Missing-value policy** | Optional params | `exclude-from-max` |

### 3.1 Condition DSL

```js
Condition := { all: [Predicate|Condition] } | { any: [...] } | { not: Condition } | Predicate
Predicate := { param: "age", op: "eq|ne|gt|gte|lt|lte|in|between|exists", value: X }
```

Evaluated by a ~60-line interpreter. No `eval`, no code execution — conditions are data.

### 3.2 Expression evaluation (formulas)

- Parsed with a sandboxed math-expression parser (`expr-eval` or equivalent), **not** JS `eval`.
- Whitelisted functions only: `+ - * / ( ) min max round abs pow`, plus engine aggregates `sum() weightedSum()`.
- Variables resolve from the context object (inputs + derived); unknown identifiers are validation errors at **config-save time**, not run time.
- Derived parameters declare `dependsOn`; the engine topologically sorts and rejects cycles when the config is validated.

### 3.3 Band-edge semantics (correctness-critical)

Every band set declares `bandEdges: "min-inclusive"` (default) → a value `v` matches band `[min, max)` where `min ≤ v < max`; `null` = unbounded. The config validator rejects overlapping or gapped bands. This makes threshold boundaries (e.g. Niro category edges 10/21/31/51) explicit and testable rather than implied.
**Note:** the Niro documented categories (<10, 10–20, 21–30, 31–50, >50) contain apparent boundary ambiguities (is exactly 20.5 "Good" or "Fair"?). The configuration stores an explicit interpretation; the ambiguity is flagged in the clarification register until confirmed against the Niro sheet.

### 3.4 Missing values

Per-parameter `missingPolicy`:
- `exclude-from-max` — parameter contributes neither points nor max points (domain score computed over provided params only)
- `zero-points` — counts as best case (rarely correct; available for completeness)
- `block` — required; assessment cannot run without it

Which policy Niro intends for skipped labs is **Needs Clarification**; the default `exclude-from-max` is the only option that doesn't bias the score, and is used until confirmed.

---

## 4. Module layout (backend `engine/` package)

```
engine/
├── index.js            execute(config, inputs) — orchestrates the 10 stages
├── validate.js         input validation from config (types, ranges, required)
├── normalize.js        unit conversion
├── derive.js           derived params (expression eval + topo sort)
├── conditions.js       condition DSL interpreter
├── expressions.js      sandboxed expression evaluator (whitelist)
├── score.js            band & option matching → points
├── aggregate.js        domain scores, weighted raw score
├── adjust.js           adjustment rules
├── categorize.js       final category mapping
├── contributors.js     contribution ranking for explanations
├── trace.js            structured trace builder
└── configValidator.js  static validation of a CalculatorVersion (used by admin
                        builder: weights sum to 1, bands contiguous, formulas
                        parse, dependsOn acyclic, options non-empty, …)
```

~700 lines total, zero external state, 100% unit-testable. `configValidator.js` is shared with the Admin Builder's "Validate" step so a config that publishes is a config that runs.

---

## 5. Error model

| Failure | Stage | Behaviour |
|---|---|---|
| Missing required input | validate | 422 with per-field errors (config-defined messages) |
| Out-of-range input | validate | 422, field-level |
| Unknown unit | normalize | 422 |
| Config invalid (should never reach runtime) | any | 500 + alert; publish-time validator prevents this class |
| No band matched | score | 500 + trace (validator guarantees full coverage, so this indicates config corruption) |

---

## 6. Extended primitives required by the ACTIVE Niro risk calculators (Risk Analysis folder)

Analysis of the real Niro Risk Logic (`Risk calculators.xlsx` — Hypothyroid, Diabetes, Heart) adds five primitives to §3. All remain generic config-interpreted mechanisms:

| Primitive | Demanded by | Config shape |
|---|---|---|
| **Group aggregation `max()`** | Diabetes: glycemic index = max(HbA1c, FBS, PP scores) — "Take only maximum" (verbatim) | `parameterGroupsAggregation: [{aggregate:"max", parameterKeys:[…]}]` |
| **Lookup table** | Heart: Framingham points → 10-year risk % (26-row map) | `lookupTables` + `lookup('key', value)` expression function |
| **Multiplicative composition** | Heart: adjusted risk = base × S_lipid × M_young | already covered by expressions; ternary added to whitelist (`cond ? a : b`) |
| **Missing-data imputation rules** | Heart: SBP missing → age-banded points (0/1/2); Diabetes: waist missing → 10 pts if glycemic ≥10; defaults (activity→Moderate) | `imputationRules` + `missingPolicy: "impute-rule" / "default-option"` |
| **Floor/penalty rules + category overrides** | Heart: final = max(adjusted, LDL/TC floor) with dual messaging; Diabetes: glycemic 10 ⇒ ≥Moderate, 20 ⇒ High | `floorRules` (condition-gated tier table) · `resultCategories.overrides` (`minCategory`) |

Pipeline placement: imputation runs inside stage 5 (score) for missing params; group aggregation between stages 5–6; lookups/multiplicative formulas in stages 6–8; floors and category overrides between stages 8–9. The config validator gains checks: lookup completeness over the reachable points range, override categories must exist, floor tiers non-overlapping.

## 7. Why this engine generalizes (reusability argument)

Niro CWS: banded scoring with sex/time contexts + **negative protective points** + weighted domains + additive/negative adjustments + lower-is-better categories.
Niro Hypothyroid: pure option-points sum + 3 higher-is-worse categories.
Niro Diabetes: option/band points + `max()` glycemic aggregation + imputation + category escalation overrides.
Niro Heart: Framingham point bands (treated/untreated BP contexts) + lookup table + multiplicative young-age correction + conditional floor penalty + `max()` finalization.
COVID demo: option-points + simple sum.

Five structurally different calculators, one primitive vocabulary, zero calculator-specific engine code — each shipped as a validated configuration in `config-samples/`.
