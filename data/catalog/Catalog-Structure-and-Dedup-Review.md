# Catalog Structure & Deduplication Review

**Subject:** `data/catalog/health-calculator-catalog.json` (with cross-checks against `data/catalog/measurements-reference-extension.json` and the existing `data/fixtures/config-samples/biomarker-dataset.json`, since duplication only becomes visible across all three).
**Method:** deterministic structural analysis (key inventories, exact-duplicate detection, fuzzy name matching, shared-input matrices, source-URL reuse, panel vocabulary counts) + entry-level review. Analysis script output archived at `docs/history/context-archive/` alongside the other digests. **This document identifies and recommends — it does not modify the dataset.**

---

## 1. The blocks — file anatomy

`health-calculator-catalog.json` divides into **4 logical blocks**:

| # | Block | Size | What it is |
|---|---|---|---|
| B1 | **Metadata** (`$schema`, `generatedAt`, `generatedBy`, `sourcingPolicy`, `tierLegend`, `counts`) | 6 keys | Provenance + governance: schema id `niro-platform/health-calculator-catalog.v1`, the trusted-source policy (verbatim, also repeated in the measurements file for self-containment), the 3-tier legend, and declared counts (70/81) that match reality |
| B2 | **`calculators[70]`** | ~85% of file | The product core: fully-specified, buildable calculator definitions across 9 categories |
| B3 | **`inventoryIndex[81]`** | thin entries | Market survey: what reputable platforms offer, with `surveyedBy` (which of the 2 inventory agents) and `fullSpecInCatalog` (cross-ref flag — **defective, see D2**) |
| B4 | **`openIssues[144]`** | strings, `[agent-tag]`-prefixed | The honesty ledger: 403-blocked sources, unverified values, conflicts, licensing blockers, engine gaps (8–18 issues per agent) |

**Companion files in the same ecosystem:**
- `measurements-reference-extension.json` → `measurements[83]` — reference data (units, conversions, per-org ranges), NOT calculators.
- `biomarker-dataset.json` (pre-existing) → `biomarkers[40]` + `adjustmentFactors[5]` + `domains[9]` — the platform's core library that the extension is supposed to extend.

### Block relationships
```
inventoryIndex (what exists in the market)
      │ alias/cross-ref (defective — D2)
      ▼
calculators (what we specified to build)
      │ inputs reference analytes           │ tier/logic feed the build order
      ▼                                     ▼
measurements-extension  ──extends──►  biomarker-dataset (existing 40)   [overlaps! — D4]
      ▲
openIssues (per-entry caveats rolled up to file level; some repeat entry `cautions` — intentional)
```

## 2. Block-by-block deep analysis

### B2 `calculators[70]` — the core block
- **Category split:** anthropometric 12 · cardiovascular 11 · mental-sleep 8 · lab-panel-extension 8 · metabolic 7 · respiratory 7 · womens-repro 7 · kidney-hydration 5 · liver-alcohol 5.
- **Tier split:** T1 = 38, T2 = 25, T3 = 7. **Logic types:** mixed 25, formula 23, bands 10, points 8, lookup 4.
- **Per-entry fields (14):** identity (`key`, `name`, `category`, `tier`), rationale (`whyRelevant`, `realWorldPresence`), interface (`inputs[]` with unit/allowedUnits/validation/options), computation (`logicType`, `logic` — verbatim formulas/point tables, `outputScale` — present 59/70), interpretation (`resultCategories[]` with label/range/interpretation/recommendation), governance (`sources[]` with org/title/url/accessed/verification, `platformMapping`, `cautions`). Field coverage is 70/70 on everything except `outputScale` (11 gaps — mostly banding-only tools where scale is implicit; fill or declare optional).
- **What the data "is":** each entry is a **pre-config** — one step short of a `calculator-version.v1` config; `platformMapping` states exactly which engine primitives (or missing ones) execute it.

### B3 `inventoryIndex[81]` — the survey block
Thin entries (no logic detail) with `tier`, `whyRelevant`, `realWorldPresence`, `surveyedBy` (`platform-survey` | `seo-india`), `fullSpecInCatalog`. Its job is coverage-proof and roadmap input. Two defects live here (D1, D2).

### B4 `openIssues[144]`
Distribution: seo-india 18 · anthropometric 15 · lab-panel 15 · cardiovascular 14 · mental-sleep 14 · respiratory 13 · womens-repro 13 · metabolic 12 · liver-alcohol 12 · kidney 10 · platform-survey 8. Content classes: (a) 403-blocked primaries needing manual capture, (b) values deliberately excluded because unverifiable, (c) inter-authority conflicts, (d) licensing blockers, (e) engine-primitive gaps, (f) population-specific notes (India). The same 403-blocked domains recur across agents (cdc.gov, acog.org, nice.org.uk, heart.org…) — grouping by domain would shrink the operational to-do list, but keep the per-agent context.

### Measurements file `measurements[83]`
Contributed 40 by the lab-panel agent + 43 by the other 8 (each also recorded the analytes its calculators consume). Fields: `key`, `name`, `panel`, `unit`, `conversions`, `referenceRanges` (verbatim, per-org), `derivedFormula?`, `conflicts?`, `sources[]`, `contributedBy`. **Defect: `panel` is an uncontrolled vocabulary — 43 distinct values for 83 entries** ("Lipid panel"/"Lipid"/"Lipids"/"Lipids (derived)"/"Lipid panel (derived)"; "Vitals"/"Vital signs"/"Vitals (derived)"/"Vitals (self-service)"; four CBC spellings) — see D5.

---

## 3. Duplicates & overlaps found (with verdicts)

### D1 — Exact duplicate keys inside `inventoryIndex` (hard duplicates: 8)
Both inventory agents listed the same tool: `egfr-ckd-epi-2021`, `homa-ir`, `phq-9`, `gad-7`, `target-heart-rate`, `bsa-mosteller`, `pack-years`, `ovulation-fertile-window` each appear **twice** (81 entries ≈ 73 unique tools).
**Verdict: MERGE** each pair into one entry, keeping both `surveyedBy` values (e.g., `surveyedBy: ["platform-survey","seo-india"]`) — the double-listing is itself a useful "high-commonality" signal worth preserving as data, not as a duplicate row.

### D2 — The `fullSpecInCatalog` flag is wrong (the biggest data-quality defect)
The flag was computed by **exact key match**, but the inventory agents and category agents chose keys independently. Result: 21 True / 60 False, when in truth **~28 of the 60 "False" entries ARE fully specified** under a different key. Verified alias table (string-coincidence pairs excluded — see D6):

| Inventory key(s) | → Full-spec calculator |
|---|---|
| `bmi-adult` | `bmi` |
| `bp-category` | `blood-pressure-category` |
| `ascvd-pce-10yr` | `ascvd-10-year-pce` |
| `target-heart-rate` (×2) | `target-heart-rate-zones` |
| `diabetes-risk-test-ada-cdc`, `diabetes-risk-ada` | `ada-type2-risk-test` |
| `egfr-ckd-epi-2021` (×2) | `ckd-epi-2021-egfr` |
| `uacr-interpretation` | `kdigo-ckd-stage` (A-staging is inside it) |
| `ldl-friedewald`, `ldl-friedewald-nonhdl` | `friedewald-ldl` (+ `non-hdl-cholesterol`) |
| `cholesterol-ratios-nonhdl` | `tc-hdl-ratio` + `non-hdl-cholesterol` |
| `fib-4` | `fib-4-index` |
| `tsat-transferrin-saturation` | `transferrin-saturation` |
| `calorie-needs` | `daily-calorie-needs-dga` |
| `calorie-bmr-tdee` | `bmr-mifflin-st-jeor` + `tdee-activity-multiplier` |
| `ideal-weight-devine`, `ideal-adjusted-body-weight` | `ideal-body-weight-devine` (ABW part flagged unverified) |
| `bsa-mosteller` (×2) | `body-surface-area` |
| `pack-years` (×2) | `smoking-pack-years` |
| `alcohol-standard-drink-calculator`, `alcohol-units` | `alcohol-standard-drinks` |
| `audit-alcohol-screen` | `audit-c` |
| `waist-hip-ratio` | `waist-to-hip-ratio` |
| `waist-height-ratio` | `waist-to-height-ratio` |
| `waist-circumference-hip-ratio` | `waist-circumference-risk` + `waist-to-hip-ratio` |
| `body-fat` | `body-fat-us-navy` (inventory prefers RFM — see gap note below) |
| `due-date` | `pregnancy-due-date` |
| `water-intake` | `daily-water-intake` |
| `epworth-sleepiness` | `epworth-sleepiness-scale` |
| `bmi-child-teen-percentile`, `child-bmi-percentile` | `pediatric-growth-percentiles` |
| `a1c-eag`, `eag-a1c-converter` | **existing platform**: eAG derived parameter in `niro-cws.config.json` |
| `anemia-hemoglobin` | **existing platform**: hemoglobin biomarker interpretation (library) |

**Verdict: FIX** — add an explicit `fullSpecKey` (or `coveredBy`) field populated from this alias table and recompute the flag; never key-match across independently-named blocks. Genuinely inventory-only (correctly False, ~20 tools): heart-age, prevent-cvd-risk, Life's Essential 8, stroke/kidney/cardiac quizzes, STOP-BANG, FRAX, CHA₂DS₂-VASc, MELD-3, KFRE, levothyroxine dosing, PECARN, OST, Gail, CCRAT, pediatric Schwartz eGFR, body-weight-planner, sleep-cycle, blood-sugar-converter (a platform unit-switch feature, not a calculator), steroid-conversion, alcohol-calorie-calculator — each gated on licensing, missing primitives, clinical scope, or pending decision.
**Gap surfaced by the alias work:** the seo-india inventory recommends **RFM (Relative Fat Mass)** as the primary body-fat method (needs no log10, shippable today) — no full-spec entry exists for it. Recommend adding one.

### D3 — Functional overlap clusters inside `calculators[70]` (no exact duplicates; 9 clusters)
No duplicated keys and no two entries with identical logic — but these clusters overlap in inputs/purpose and need explicit decisions:

| # | Cluster | Evidence | Verdict + reason |
|---|---|---|---|
| 1 | **Lipid derived values:** `friedewald-ldl` ⊃ `non-hdl-cholesterol`, `vldl-estimate` | friedewald's own mapping emits `nonHdl` and `vldl` as by-products; assembly already deduped one `non-hdl-cholesterol` key collision between two agents | **MERGE `vldl-estimate` INTO `friedewald-ldl`** (pure subset, TG/5, zero unique value). **KEEP `non-hdl-cholesterol` separate** (T1, real standalone SEO term, distinct MedlinePlus/Mayo cutoffs) with shared config fragments |
| 2 | **Cholesterol ratios:** `tc-hdl-ratio` (T1) vs `ldl-hdl-ratio`, `tg-hdl-ratio` (both T3, explicitly "no authoritative cutoffs") | share `hdl` (+ each other's `ratio` field) | **MERGE the two T3 ratios INTO `tc-hdl-ratio`** as secondary outputs of one "Cholesterol Ratios" calculator — as standalone pages they are thin, uninterpretable content (their own entries say "do not attach numeric risk categories"). The inventory itself groups them (`cholesterol-ratios-nonhdl`) |
| 3 | **BP arithmetic:** `blood-pressure-category`, `mean-arterial-pressure`, `pulse-pressure` | all three consume exactly (`systolic`, `diastolic`) | **KEEP SEPARATE** — three distinct, individually-searched concepts (SEO strategy) with different authorities; but define the two inputs ONCE as shared parameters and mandate cross-links. Alternative (product call): one "BP analyzer" page with three result blocks — supported by the platform either way |
| 4 | **Heart rate:** `max-heart-rate` ⊂ `target-heart-rate-zones` | zones computes HRmax internally with the same two formulas | **KEEP BOTH for SEO** ("max heart rate calculator" is its own high-volume query) but implement zones as the superset config and derive the max-HR page from the same shared derived-parameter fragment — never maintain the two formulas twice |
| 5 | **Energy needs:** `bmr-mifflin-st-jeor`, `bmr-harris-benedict-revised`, `tdee-activity-multiplier`, `daily-calorie-needs-dga` | Mifflin & HB share all 4 inputs; TDEE = BMR × factor; the market packages them as ONE tool (`calorie-bmr-tdee` in the inventory) | **MERGE the first three into ONE "Calorie / BMR / TDEE" calculator** — method select (Mifflin default per ADA evidence review, HB as labeled alternate), activity step for TDEE. **KEEP `daily-calorie-needs-dga` separate** (different construct: population reference table, not formula) as a reference page |
| 6 | **Insulin resistance:** `homa-ir` vs `quicki` | identical inputs (`fastingGlucose`, `fastingInsulin`); QUICKI is log10-gated | **MERGE `quicki` INTO `homa-ir`** as a secondary output once log10 lands — same blood draw, same caveats, one page serves both queries. **KEEP `tyg-index` separate** (different inputs: TG + glucose) |
| 7 | **Kidney staging:** `ckd-epi-2021-egfr` vs `kdigo-ckd-stage` | KDIGO stage consumes eGFR; the G-band edges (90/60/45/30/15) are duplicated verbatim in BOTH entries (repeated logic) | **MERGE into ONE "eGFR & CKD Stage" calculator**: compute eGFR → G stage; optional ACR input adds A stage + risk heat-map. Eliminates the duplicated band table. **KEEP `cockcroft-gault-crcl`** (different construct, drug-dosing heritage, NKF deprecation notes) and **`bun-creatinine-ratio`** (different inputs) separate |
| 8 | **Liver fibrosis:** `fib-4-index`, `apri`, `ast-alt-ratio` | share AST/ALT/platelets | **KEEP `fib-4` and `apri` SEPARATE** — distinct validated indices with different cutoff frameworks (AASLD vs WHO) and distinct search terms; merging validated instruments breaks their citations. **FOLD `ast-alt-ratio` (T2, heuristic-only)** into both pages as a secondary "enzyme pattern" output, or keep as a thin page — recommend fold |
| 9 | **Pregnancy dates:** `pregnancy-due-date`, `gestational-age`, `pregnancy-trimester`, `ovulation-fertile-window` | shared `lmpDate`/`cycleLength`/`usGa*` inputs; **trimester is a pure banding of GA weeks with zero unique inputs** | **MERGE `pregnancy-trimester` INTO `gestational-age`** as a result block. **KEEP due-date and GA separate** (inverse presentations with independently huge search volumes) sharing one date-math fragment. **KEEP ovulation separate** (different output) |

**Deliberate near-overlaps to KEEP with reason:** `findrisc` + `ada-type2-risk-test` + the **existing Niro `diabetes-risk` (IDRS)** are three validated instruments for one purpose — never merge validated questionnaires (their scoring is the citation); label populations (IDRS = India-primary, FINDRISC = European cohort, ADA = US) and interlink. Same for PHQ-9 vs GAD-7 (different constructs), `metabolic-syndrome-checker` (diagnosis-pattern, not a duplicate of its component calculators), and the respiratory reference trio (PEF/FEV1-FVC/6MWD share demographics but produce unrelated outputs).

### D4 — Measurements-file duplication (against the existing library and internal)
- **11 EXACT key overlaps with the existing 40-biomarker library:** `alt, ast, bun, egfr, fasting-insulin, hba1c, hdl-cholesterol, ldl-cholesterol, systolic-bp, total-cholesterol, triglycerides`. **Verdict: MERGE-ON-IMPORT** — do not create second records; attach the extension's per-org ranges to the existing records as additional `referenceExternal`/conflict entries (e.g., MedlinePlus ALT 4–36 alongside the library's ACG ULN values).
- **4 synonym overlaps (different key, same analyte):** `fasting-plasma-glucose`→`fasting-glucose`, `serum-creatinine`→`creatinine`, `platelet-count`→`platelets`, and `oxygen-saturation` vs `spo2` (see next). **Verdict: RENAME to the library key and merge.**
- **Internal duplicates within the 83:** (a) **`spo2` and `oxygen-saturation` are the same measurement** contributed by two agents (respiratory: WHO/NHS/StatPearls; lab-panel: Cleveland/Mayo) — **MERGE, keep `spo2`, union the sources**; (b) **three triglycerides entries** (`triglycerides`, `fasting-triglycerides`, `triglycerides-categories`) — **MERGE into one record** with fasting-context and category bands as contexts; (c) `blood-pressure-mets` is a metabolic-syndrome threshold row, not an analyte — **FOLD into the `systolic-bp`/`diastolic-bp` records** as a labeled context (≥130/≥85 harmonized criterion).
- **Legitimate calculator↔measurement twins to KEEP:** `mean-arterial-pressure`, `pulse-pressure`, `bun-creatinine-ratio`, `egfr`, `creatinine-clearance` appear in both files — measurement = reference data, calculator = interactive tool; that's the intended pairing, cross-link them.
- **Net after cleaning:** 83 → **~64 genuinely-new** measurement records.

### D5 — Field-level redundancy & inconsistency (not entries, but data hygiene)
1. **Input-key vocabulary drift** across calculators (must normalize before config conversion, because the platform's parameter keys are shared): `height`(9)/`heightCm`(3)/`lengthHeight` · `weight`(7)/`weightKg`(1)/`currentWeight` · `systolic`+`diastolic` vs `systolicBP`+`diastolicBP` (metabolic-syndrome-checker) · `scr` vs library `creatinine` · `familyHistory` meaning different diseases in different calculators. **Verdict: normalization pass mapping to the platform's canonical camelCase vocabulary** (`heightCm`, `weightKg`, `systolicBp` per `niro-cws.config.json`) with `biomarkerKey` links for lab inputs.
2. **`ratio` appears as an *input* key in the three ratio calculators** — it's an output, not an input (agent modeling slip). Fix during conversion (make it a derived parameter).
3. **`panel` vocabulary chaos** in measurements (43 values/83 entries). **Verdict: controlled vocabulary** (~12 panels: Lipid, CBC, CBC-differential, Iron, Electrolytes, Minerals, Liver, Renal, Glycemic, Vitals, Spirometry, Reproductive, Lifestyle-reference).
4. `outputScale` missing on 11/70 — fill or mark optional-by-design.
5. `sourcingPolicy` duplicated verbatim across both files, and 8 source URLs reused across entries — **KEEP** (self-containment; shared authority is expected). Optional later: a normalized source registry.
6. `inventoryIndex` alias entries duplicate `tier`/`whyRelevant` of their full-spec twins — harmless survey provenance; after the D2 alias fix, treat inventory rows as pointers, not authorities.

### D6 — Similarity false-positives (checked, explicitly NOT duplicates)
For the record, the fuzzy scan surfaces string coincidences that must not be "cleaned": `gestational-age`~`anion-gap`, `heart-age`~`gestational-age`, `uacr-interpretation`~`fev1-fvc-interpretation`, `eag-a1c-converter`~`anion-gap`, `body-weight-planner`~`ideal-body-weight-devine` (genuinely different tools), `calorie-needs`~`caffeine-intake-tracker`, `mch`~`mchc`, `bilirubin-direct`~`bilirubin-indirect`, HDL/LDL/VLDL/non-HDL as a family, the differential percent/absolute pairs, `height`~`weight`. All are distinct concepts.

---

## 4. Overlap with the EXISTING platform (beyond the catalog)
- `ogtt-2h-interpreter` / `fasting-plasma-glucose` bands = same ADA cutoffs already inside Niro CWS metabolic domain and the Diabetes calculator — consistent, not duplicative; share biomarker keys.
- `smoking-pack-years` vs CWS smoking adjustment: different granularity (quantity vs category) — keep both; the pack-years inputs can pre-fill the CWS smoking category.
- `ckd-epi-2021-egfr` G-bands = CWS kidney-domain eGFR bands (KDIGO edges) — same source, intended.
- eAG converter requests (inventory) are already satisfied by the CWS derived parameter — expose it as a standalone page rather than re-specify.

## 5. Recommended cleaning actions (prioritized)

1. **Fix D2** — add `fullSpecKey` alias mapping (~28 corrections) + recompute `fullSpecInCatalog`. *(Highest value: it misrepresents coverage.)*
2. **Fix D1** — merge the 8 doubled inventory entries (union `surveyedBy`).
3. **Apply D3 merges** — `vldl-estimate`→friedewald · T3 ratios→`tc-hdl-ratio` · `quicki`→`homa-ir` · `pregnancy-trimester`→`gestational-age` · eGFR+KDIGO→one · Mifflin+HB+TDEE→one calorie calculator. **Net: 70 entries → ~62 distinct calculator products** (nothing deleted — merged entries become secondary outputs/method options, all sources preserved).
4. **Apply D4 measurement merges** — 11 exact + 4 synonyms into the library (as conflict-enriched records), spo2/oxygen-saturation union, 3×triglycerides→1, blood-pressure-mets→context rows. Net: 83 → ~64 new records.
5. **Normalize D5** — input-key vocabulary, `ratio`-as-input fix, panel controlled vocabulary, fill `outputScale`.
6. **Add the RFM body-fat entry** (gap found via D2; shippable without log10).
7. Keep-as-is with documented reasons: diabetes-risk trio, FIB-4/APRI, BP trio (SEO), PHQ-9/GAD-7, calculator↔measurement twins.

## 6. Final "what is what" summary

| Piece | What it is | Health |
|---|---|---|
| B1 metadata | provenance, sourcing policy, tier legend, counts | ✅ accurate |
| B2 `calculators[70]` | buildable pre-configs, 9 categories, T1 38/T2 25/T3 7 | ✅ no exact duplicates; 9 overlap clusters → merge 6, keep 3 with reason (net ~62 products) |
| B3 `inventoryIndex[81]` | market survey + roadmap input | ⚠️ 8 exact dupes; `fullSpecInCatalog` wrong for ~28 aliases → fix |
| B4 `openIssues[144]` | honesty ledger (blocks, conflicts, licensing, gaps) | ✅ keep; optionally group by blocked domain |
| `measurements[83]` | reference ranges extending the 40-biomarker library | ⚠️ 15 overlaps with library + 5 internal dupes → merge to ~64 new; normalize `panel` |
| Existing library (40+5+9) | platform core the extension merges into | ✅ authoritative; record conflicts (e.g., MCV 79–95 vs 80–100), never overwrite |
