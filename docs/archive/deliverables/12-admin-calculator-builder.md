# Admin / Calculator Builder — Design

> Deliverable 17. The self-serve surface that makes "adding a calculator as easy as publishing a blog post" true. Authorized users create and modify calculators **entirely through configuration** — no code, no deploy.

---

## 1. Personas & permissions

| Role | Can do |
|---|---|
| `editor` | Create/edit drafts, validate, preview, run test cases |
| `admin` | Everything + publish/retire, biomarker library edits, user management |

---

## 2. Builder workflow (wizard + workspace hybrid)

A new calculator starts as a 7-step wizard; an existing calculator opens the same steps as a tabbed workspace. **Same screens for create and edit** — editing opens a new draft version of the published config (edit-by-copy), so the live calculator is never touched until publish.

```
① Basic Details ─ ② Parameters ─ ③ Scoring & Rules ─ ④ Domains & Formula
        ─ ⑤ Result Categories ─ ⑥ UI Layout ─ ⑦ Preview → Validate → Test → Publish
```

### Step ① Basic Details
Name, slug (auto, editable while draft), short description, purpose, tags, disclaimers.

### Step ② Parameters
- Table of parameters with add/edit/reorder (drag), grouped by parameter group.
- **Add from Biomarker Library**: picking "HDL Cholesterol" pre-fills label, unit + conversions, validation bounds, help text, and links `biomarkerKey` (single source of biomarker truth; editable per-calculator).
- **Add custom parameter**: manual definition for non-biomarker inputs (age, smoking status, symptoms…).
- Per-parameter editor: input type, unit + allowed conversions, validation (required/min/max/decimals), missing-value policy, visibility condition (condition builder — see below), help text, order.
- Derived parameters: formula field with live syntax check + dependency picker (e.g. eAG from HbA1c; BMI from height/weight).

### Step ③ Scoring & Rules
- Per parameter: **Band editor** — visual number-line of bands (min/max/points/interpretation); context tabs when demographic-dependent (e.g. Male / Female bands side-by-side); band-edge semantics shown explicitly ("40 belongs to this band").
- Per select/boolean parameter: points per option inline.
- **Adjustment rules**: list of condition → action rows built with the condition builder (`IF smoking = current THEN final score +10`).
- **Source tagging on every band/rule** (`niro | external | needs-clarification` + reference) — the builder nags on untagged medical thresholds; this is how source traceability survives editing.

**Condition builder**: nestable ALL/ANY groups of `parameter · operator · value` rows — serializes 1:1 to the engine's condition DSL. No free-text logic.

### Step ④ Domains & Formula
- Define domains, assign parameters (unassigned-parameter warnings), set weights with a live "weights sum = 100%" meter (hard block if ≠ 100%).
- Score formula per domain (default `sum(points)/maxPoints*100`) and final-score formula (default `weightedSum(domains) + adjustments`) — editable expressions for calculators that need different math; validated by the same expression parser the engine uses.
- Calculators without domains (simple ones) can skip this step → single implicit domain.

### Step ⑤ Result Categories
- Scale definition (min/max, direction: lower-is-better / higher-is-better).
- Band table with labels, colors, messages, recommendations; live coverage bar showing gaps/overlaps (validator hard-blocks both).

### Step ⑥ UI Layout
- Step/section composer: arrange parameter groups into form steps.
- Result page block toggles + order (gauge, category, contributors, domain breakdown, biomarker details, recommendations).
- Theme accent, intro copy, disclaimers.

### Step ⑦ Preview → Validate → Test → Publish
- **Preview**: the real public renderer + real engine run against the draft (via the admin preview endpoint) with editable sample inputs; admins see the full calculation trace step-by-step — value → band → points → domain → weight → adjustment → category.
- **Validate**: runs `configValidator`; problems listed with jump-to-step links. Severity `error` blocks publish, `warning` doesn't (e.g. missing help text).
- **Test cases**: a saved table of `{name, inputs, expected: {score?, category?}}` per calculator. "Run all" executes them against the draft; red/green results. Publishing warns if any test fails. This is how Niro's known worked examples from the source sheet become regression tests inside the product.
- **Publish**: changelog prompt → version becomes immutable → goes live instantly (config cache invalidation). One-click **rollback** = republish a previous version as a new version.

---

## 3. Why this cannot break the platform

1. **Drafts are isolated** — the public API serves only published, immutable versions.
2. **The validator is the same module the engine trusts** — a config that passes validation cannot hit engine runtime errors (band coverage, weight sums, formula parse, dependency cycles all checked statically).
3. **Preview runs the production engine** — what the admin sees is what users get.
4. **Versioning + audit log** — every publish is attributable and reversible.

---

## 4. Screens inventory (React admin area)

| Screen | Key components |
|---|---|
| Calculator list | status chips, version, "new calculator" |
| Builder workspace | step nav, autosave draft, validation sidebar |
| Parameter editor drawer | biomarker picker, unit editor, condition builder |
| Band editor | visual number-line, context tabs, source tag |
| Preview | live renderer + trace inspector panel |
| Test cases | table + run-all + diff on failure |
| Version history | list, diff summary, rollback |
| Biomarker library manager | CRUD + source attribution editor + verification status |

---

## 5. Build-vs-defer (assignment scope guidance)

Must-have to prove the concept: steps ①–⑤ + ⑦ (validate/preview/publish), biomarker picker, condition builder, band editor, version publish/rollback.
Nice-to-have: drag reordering, test-case runner UI (API can exist first), audit-log viewer, rich theming (⑥ can start as JSON editing with schema hints).
