# Rule / Formula Mapping

> Deliverable 8. Maps every documented Niro rule and formula to its platform representation, with source class per element. This is the bridge between "what Niro defined" and "how the generic engine executes it".

## 1. The documented Niro CWS calculation flow → engine stages

| # | Niro-documented step (source) | Platform representation | Engine stage |
|---|---|---|---|
| 1 | Biomarker results as inputs (brief §2) | `parameters[]` with units + validation | validate, normalize |
| 2 | Biomarker identification & normalization (brief §2) | unit conversion tables per parameter | normalize |
| 3 | Biomarker interpretation (brief §2) | scoring bands with `interpretation` labels per context | contextualize, score |
| 4 | Parameter values → parameter points (brief §7) | `scoringRules[].contexts[].bands[].points` | score |
| 5 | Domain score = Σ points / max points × 100 (brief §7, NIRO formula) | `formulas["domain-score"] = "sum(points)/maxPoints*100"` | aggregate |
| 6 | Domain weights 25/20/15/10/10/5/5/5/5 (brief §4, NIRO) | `domains[].weight` (validator enforces Σ=1.0) | weight |
| 7 | Raw Wellness Score = Σ domain × weight (brief §7, NIRO) | `formulas["raw-score"] = "weightedSum(domains)"` | weight |
| 8 | Final = Raw + Σ adjustment points (brief §7, NIRO) | `formulas["final-score"] = "rawScore + sum(adjustments)"` | adjust |
| 9 | Adjustments: age, BMI, smoking, activity (brief §6, NIRO — **values NC**) | `adjustmentRules[]` condition→action, points pending sheet | adjust |
| 10 | Categories <10 / 10–20 / 21–30 / 31–50 / >50 (brief §8, NIRO) | `resultCategories.bands` (lower-is-better; boundary semantics flagged NC-C4) | categorize |
| 11 | Explanation / key contributors (brief §2, §9) | contributor ranking over weighted domain + parameter deltas | explain-data |
| 12 | Recommendations / next steps (brief §2, §9) | category + interpretation-keyed recommendation content | result assembly |

## 2. Demographic / context rules

| Niro-documented rule | Platform primitive | Example |
|---|---|---|
| Gender-specific interpretation for certain biomarkers (brief §6) | Per-parameter scoring `contexts[].when` on `sex` | HDL male vs female band sets |
| Age-dependent scoring where defined (brief §6) | `when` predicates on `age` (`gte/lt/between`) | ESR >50y bands; testosterone age ranges |
| Context-specific hormonal handling (brief §6) | Extra context inputs + visibility conditions | `menopausalStatus` shown only when `sex=female`; estradiol bands keyed on it; cortisol morning-draw guidance |
| Partial data → partial risk is normal Niro behaviour (Audio 2: partial risk score inside reports when full lab data unavailable) | `missingPolicy: "exclude-from-max"` per parameter (domain max shrinks) | 31 of 38 markers → score over provided set, omission disclosed |
| Units required (brief §6) | unit tables + canonical normalization | mmol/L → mg/dL ×38.67 |

## 3. Derived-value formulas (externally verified)

| Derived value | Formula | Source class |
|---|---|---|
| eAG | `28.7 * hba1c - 46.7` (mg/dL) | EXTERNAL — ADA, verified verbatim (whether scored or display-only: NC-C6) |
| BMI | `weightKg / pow(heightCm/100, 2)` | EXTERNAL — WHO/CDC standard |

## 4. Engine primitives inventory (what the generic engine must support, derived from the above)

banded scoring · option-points · condition DSL (`all/any/not` + `eq/ne/gt/gte/lt/lte/in/between/exists`) · demographic contexts · derived parameters (expression + dependency graph) · unit conversion · per-domain aggregate `sum/max×100` · weighted sum · additive adjustments · direction-aware category bands · missing-value policies · explicit band-edge semantics.

The second calculator (COVID demo) reuses: option-points, age bands, simple `sum(points)`, higher-is-worse categories — no new primitives → the primitive set generalizes (see [16-testing-strategy.md](16-testing-strategy.md) reusability gate).

## 5. What is Niro-defined vs pending vs external — quick matrix

| Element | Status |
|---|---|
| Flow shape (input→interpret→points→domain→weight→adjust→final→category→explain) | **NIRO** (brief §2, §7) |
| 9 domains + parameter membership | **NIRO** (brief §5) |
| Domain weights | **NIRO** (brief §4) |
| Domain/raw/final formulas | **NIRO** (brief §7) |
| Category labels + documented band values | **NIRO** (brief §8); boundary semantics **NC-C4** |
| Adjustment factor list | **NIRO** (brief §6); point values **NC-C2** |
| Per-parameter thresholds + points | **NC-C1** (Niro Risk Logic Sheet not in folder) — interim structure uses externally verified clinical bands, tagged |
| Reference ranges / clinical categories for biomarker pages | **EXTERNAL** (research files, fully sourced) |
| eAG + BMI formulas | **EXTERNAL** (ADA / WHO-CDC, verified) |
| Partial-scoring norm | **NIRO** (Audio 2) — exact policy math **NC-C5** |
