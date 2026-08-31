# Catalog Cleanup Report

**Executed:** 2026-08-20 · **Basis:** confirmed actions from [Catalog-Structure-and-Dedup-Review.md](Catalog-Structure-and-Dedup-Review.md) only · **Backup of all originals:** [`backup-2026-08-20/`](backup-2026-08-20/) · **Principle:** nothing deleted — every absorbed record is embedded **in full** under `mergedFrom` (or `duplicateSurveyEntry`) on its surviving host; clinical meaning untouched.

## Record counts — before vs after

| Collection | Before | After | Change |
|---|---|---|---|
| `calculators` | 70 | **62** | −9 absorbed into hosts, +1 new combined entry |
| `inventoryIndex` | 81 | **73** | −8 exact-duplicate rows merged |
| `openIssues` | 144 | 144 | unchanged |
| `measurements` | 83 | **79** | −4 duplicate records merged; of the 79, **14 flagged `libraryMerge`** (enrichments of existing library records) → **65 genuinely-new analytes** |
| Distinct source URLs (catalog) | 293 | **293** | ✅ zero citations lost |
| Distinct source URLs (measurements) | 116 | **116** | ✅ zero citations lost |

## Validation results (all pass)
☑ No duplicate calculator keys · ☑ No duplicate inventory keys · ☑ No duplicate measurement IDs · ☑ Every `fullSpecKey` and every `calculatorAliases` target resolves to an existing calculator · ☑ Source-URL sets identical before/after in both files · ☑ Both JSONs re-parse cleanly after save · ☑ Counts objects updated to match reality.

## What was merged/removed, and what was preserved

### D1 — inventoryIndex exact duplicates (8 rows merged)
`egfr-ckd-epi-2021`, `homa-ir`, `ovulation-fertile-window`, `target-heart-rate`, `phq-9`, `gad-7`, `pack-years`, `bsa-mosteller` — each was listed by BOTH survey agents. Kept one row per key with `surveyedBy: ["platform-survey","seo-india"]` (the double-listing survives as a high-commonality signal) and the second row preserved verbatim under `duplicateSurveyEntry`.

### D2 — alias/key-mismatch fix (no records touched; cross-references corrected)
Added `fullSpecKey` (array) to inventory entries per the review's verified alias table and recomputed `fullSpecInCatalog`: **21 → 48 entries now correctly marked as fully specified** (e.g., `bmi-adult`→`bmi`, `ascvd-pce-10yr`→`ascvd-10-year-pce`, `due-date`→`pregnancy-due-date`, `fib-4`→`fib-4-index`, multi-target cases like `cholesterol-ratios-nonhdl`→[`tc-hdl-ratio`,`non-hdl-cholesterol`]). Three entries covered by the existing platform (not the catalog) got `coveredBy` instead: `a1c-eag`/`eag-a1c-converter` → the CWS eAG derived parameter; `anemia-hemoglobin` → the library's hemoglobin interpretation. A new top-level **`calculatorAliases`** map redirects all 9 removed calculator keys to their hosts, so any old reference still resolves.

### D3 — calculator merges (6 confirmed clusters; 9 entries → hosts; net 70→62)
| Removed entry | Now lives in | Form |
|---|---|---|
| `vldl-estimate` | `friedewald-ldl` | secondary output (TG/5); full record in `mergedFrom` |
| `ldl-hdl-ratio`, `tg-hdl-ratio` | `tc-hdl-ratio` (renamed "Cholesterol Ratios…") | secondary research-context outputs; both records in `mergedFrom` |
| `quicki` | `homa-ir` | secondary output (log10-gated), same inputs; record in `mergedFrom` |
| `pregnancy-trimester` | `gestational-age` | result block banding GA weeks; record in `mergedFrom` |
| `kdigo-ckd-stage` | `ckd-epi-2021-egfr` (renamed "eGFR & CKD Stage…") | integrated G/A staging + risk heat-map; removes the duplicated G-band table; record in `mergedFrom` |
| `bmr-mifflin-st-jeor`, `bmr-harris-benedict-revised`, `tdee-activity-multiplier` | **new** `calorie-bmr-tdee` (T1) | one combined calculator (method select + activity step) mirroring how the market ships it; all three full records in `mergedFrom`; sources unioned (deduped by URL); the `bmr` input of the old TDEE entry is computed internally (original preserved) |

**Preservation guarantee:** each absorbed record's complete `logic` (verbatim formulas/point tables), `sources`, `resultCategories`, `cautions`, `platformMapping`, tiers and names are retained inside the host's `mergedFrom` — verified by the identical before/after source-URL sets.

### D4 — measurement merges + canonical IDs (83→79; 14 enrichment flags)
- **`oxygen-saturation` → `spo2`** (same measurement from two agents): records merged, **sources unioned** (WHO/NHS/StatPearls + Cleveland/Mayo).
- **`fasting-triglycerides` + `triglycerides-categories` → `triglycerides`**: one analyte, one record — fasting context, NCEP bands, and the metabolic-syndrome ≥150 mg/dL threshold consolidated; sources unioned; originals in `mergedFrom`.
- **`blood-pressure-mets` → `systolic-bp`** as a context (the harmonized SBP ≥130 OR DBP ≥85 / on-treatment criterion — noted as applying jointly with `diastolic-bp`); it was a threshold row, not an analyte.
- **Canonical ID renames** (synonym → existing library key, `formerKey` kept): `fasting-plasma-glucose`→`fasting-glucose`, `serum-creatinine`→`creatinine`, `platelet-count`→`platelets`.
- **14 records flagged `libraryMerge: true`** (alt, ast, bun, egfr, fasting-insulin, hba1c, hdl-/ldl-/total-cholesterol, triglycerides, systolic-bp, fasting-glucose, creatinine, platelets): these are **enrichments of the existing 40-biomarker library**, not new analytes — at P6 import they attach as additional per-org reference ranges/conflicts and **never overwrite** library values.

### D5 — panel vocabulary normalized (79 records)
43 inconsistent `panel` labels reduced to a 19-value controlled vocabulary (`lipid`, `cbc`, `cbc-differential`, `iron-studies`, `electrolytes`, `minerals`, `liver`, `renal`, `glycemic`, `vitals`, `spirometry`, `anthropometry`, `reproductive`, `lifestyle-reference`, `proteins`, `pancreatic-enzymes`, `muscle-enzymes`, `general-chemistry`, `mens-health`). Every original label preserved in `panelOriginal`.

## Explicitly NOT merged (kept per review + your instructions)
- **BP trio** (`blood-pressure-category`, `mean-arterial-pressure`, `pulse-pressure`) — three individually-searched concepts; shared inputs, separate pages.
- **`max-heart-rate`** vs `target-heart-rate-zones` — kept both for SEO; implement from one shared formula fragment.
- **`fib-4-index` vs `apri`** — distinct validated indices with different cutoff frameworks (AASLD vs WHO).
- **`ast-alt-ratio`** — kept standalone (distinct formula/purpose; the review's "fold" was soft, and it is not a duplicate).
- **Diabetes trio** — `findrisc`, `ada-type2-risk-test`, and the existing Niro IDRS: validated instruments are never merged; population labels + interlinks instead.
- **`daily-calorie-needs-dga`** — population reference table, different construct from the formula-based calorie calculator.
- **PHQ-9 vs GAD-7**, `metabolic-syndrome-checker`, the respiratory reference trio, `physical-activity-weekly-target` vs the CWS `physical-activity` input, and all calculator↔measurement twins (MAP, PP, BUN:Cr, eGFR, CrCl — reference data vs interactive tool) — all clinically/structurally distinct.
- **False-positive similarity pairs** documented in review D6 (mch~mchc, direct~indirect bilirubin, the HDL/LDL/VLDL family, differential pairs) — untouched by design.

## Deferred (documented, not part of duplicate cleanup)
Input-key vocabulary normalization inside calculator entries (`height`/`heightCm`, `systolic`/`systolicBP`, `scr`) and the `ratio`-as-input fix — deliberately deferred to config-conversion time (P8/Studio import), because renaming keys without simultaneously updating each entry's verbatim `logic` strings risks internal inconsistency. `outputScale` gaps (11 entries) left unfilled — filling them would be inventing data. The recommended **RFM body-fat addition** is new content, not cleanup — pending.

## File/metadata changes
Both JSONs gained `cleanedAt` + `cleanupBasis`; `counts` updated (catalog: 62/73; measurements: 79 total = 65 new + 14 enrichments); catalog gained `calculatorAliases`. `Health-Test-Catalog.md` carries a post-cleanup note; its detailed tables remain valid as content description (merged items still exist as components of their hosts).
