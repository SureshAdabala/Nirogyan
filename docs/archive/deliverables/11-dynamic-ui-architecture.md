# Dynamic React UI Architecture + UI/UX Flow

> Deliverables 16 & 20. One React application renders **every** calculator from configuration. No calculator-specific components, pages, or routes are ever added.

---

## 1. UX reference synthesis (what we take, what we don't)

| Reference | What we adopt | What we don't |
|---|---|---|
| **NirogGyan Biomarkers** (niroggyan.com/biomarkers) | Biomarker knowledge model: browse by category/A–Z, search with popular terms, card → detail progressive disclosure, related-tests cross-links | Their visual identity/implementation |
| **Niro Health** (niro.health) | Product experience: simple upload/enter → analyze → understand flow; single-page focus; result-first hierarchy; plain-language explanations; trust cues (disclaimers, accuracy claims kept honest) | Report-upload/OCR scope (out of scope — manual entry first) |
| **Omni Calculator** (omnicalculator.com/health) | Interaction pattern: inputs visible with instant validation, one obvious calculate action, result adjacent to inputs, "how it works" explanation below, calculator directory grouped by category with one-line descriptions | 439-calculator taxonomy complexity |

Documented Niro information hierarchy (from the brief) governs the result page:

```
RESULT → CATEGORY → WHY / KEY CONTRIBUTORS → DOMAIN DETAILS → BIOMARKER DETAILS → RECOMMENDATIONS
```

---

## 2. Public user flow

```
Calculator Directory ──► Calculator Intro ──► Multi-step Dynamic Form ──► Calculating ──► Result Page
      │                     (what/why/            (steps from uiConfig,       (engine)       │
      │                      disclaimer)           inline validation,                        ├─ Score gauge + category
      │                                            unit switching,                           ├─ Key contributors ("why")
      └──────────► Biomarker Library ◄── "learn more" links from fields ◄────────────────────┤─ Domain breakdown
                   (browse/search/detail)                                                    ├─ Biomarker-level detail drill-in
                                                                                             ├─ Recommendations / next steps
                                                                                             └─ Share / retake / (optional email capture)
```

Key flow rules:
- Anonymous-first: no login to run an assessment; results shareable by link (`/results/:id`).
- Optional parameters are skippable with an explicit "I don't have this value" — the omission is shown on the result ("computed from 31 of 38 markers").
- Result is never blocked behind email; lead capture is a polite optional step.
- Every medical figure on screen can reveal its source ("where does this range come from?").

---

## 3. Component architecture

```
src/
├── app/                    routes: /, /c/:slug, /results/:id, /biomarkers[...], /admin[...]
├── api/                    typed API client (fetch wrappers)
├── engine-types/           shared TS types / JSDoc for config & result shapes
│
├── renderer/               ★ THE generic calculator renderer
│   ├── CalculatorRenderer  orchestrates: config → steps → fields → submit
│   ├── StepNav             progress across uiConfig.steps
│   ├── FieldRegistry       inputType → component map  ◄── THE extension point
│   │     number   → NumberField (unit switcher, min/max hints)
│   │     select   → SelectField ─ radio → RadioGroupField
│   │     boolean  → ToggleField ─ derived → (never rendered; computed)
│   ├── FieldShell          label, help popover, "learn more" biomarker link,
│   │                       validation message, skip control (optional params)
│   ├── visibility.js       client-side condition DSL evaluator (same semantics as engine)
│   └── validation.js       config-driven client validation (mirror of server rules)
│
├── result/                 ★ generic result renderer (block registry)
│   ├── ResultRenderer      iterates uiConfig.result.layout
│   ├── blocks/ScoreGauge   score + category color (direction-aware)
│   ├── blocks/Category     label + message
│   ├── blocks/Contributors "why" — top domains/params in plain language
│   ├── blocks/DomainBreakdown  bars/radar from domainScores
│   ├── blocks/BiomarkerDetails per-parameter interpretation chips → drill-in panel
│   └── blocks/Recommendations
│
├── biomarkers/             library pages (list, search, category filter, detail)
├── directory/              calculator listing (cards from GET /calculators)
└── admin/                  builder (see 12-admin-calculator-builder.md)
```

**Two registries make the UI "closed for modification, open for extension":**
1. `FieldRegistry` — a new *input kind* (e.g. slider) is one new component + one registry entry, available to every calculator.
2. `ResultBlockRegistry` — a new *result visual* likewise. Neither touches existing calculators.

Renderer contract: components receive `(parameterConfig, value, onChange, error)` — they never know which calculator they belong to.

---

## 4. State & data

- Server state: React Query (config fetch, assess mutation, result fetch) — caching, retries, loading states for free.
- Form state: single `useReducer` keyed by parameter key: `{ values, units, skipped, errors, currentStep }`.
- No global store needed; admin builder uses the same pattern per draft.
- Progress persisted to `sessionStorage` (long lab forms survive accidental refresh).

## 5. Validation UX

- On blur: field-level (type, range, unit) from config.
- On step next: required-check for the step's parameters.
- On submit: server is authoritative; 422 field errors map back onto fields.
- Biological-bounds warnings (soft) vs hard errors (config `min`/`max`): out-of-range-but-possible values warn ("HDL 200 mg/dL is unusual — double-check"), impossible values block. Soft/hard bounds both come from config validation settings.

## 6. Accessibility & responsiveness

- All fields labelled + described (`aria-describedby` for help/error), keyboard-completable multi-step flow, focus moved to step heading on navigation, gauge/charts have text equivalents (score, category, domain values render as text first, visual second).
- Mobile-first single-column form; result blocks stack; touch-friendly unit switcher.

## 7. Content states

Loading (config skeleton), empty directory, calculation spinner (sub-second but visible), assess failure (retry, inputs preserved), partial data result (omitted-parameter notice), retired-calculator result view (banner: "assessed with version N").
