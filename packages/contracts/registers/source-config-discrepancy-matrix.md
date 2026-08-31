# Source-versus-config discrepancy matrix

**Reconciled:** 2026-08-21  
**Scope:** all five calculator fixtures, their original Niro/external sources, core biomarker references, and contract-affecting measurement data  
**Clinical value changes:** none

This register is normative input to clinical validation and publish eligibility. It records ambiguity; it does not authorize engineering to choose a medical value.

## Classification and impact

- `resolved-by-source` — the source settles the earlier question; protect the transcription with tests.
- `config-defect` — config structure/meaning does not faithfully or completely express its stated source.
- `source-gap` — original source does not define a required value or boundary.
- `needs-medical-review` — evidence exists, but applicability/interpretation needs a medical decision.
- `needs-product-decision` — UX, privacy, lifecycle, or scope decision is required.
- `data-integrity` — research/catalog data cannot be safely migrated as executable data.

`critical` and `high` findings marked **blocks publication** must be closed or explicitly accepted by the source owner and medical reviewer under `CLN-*`. An engineering semantic resolution never closes a clinical discrepancy by itself.

## Cross-cutting findings

| ID | Class | Severity | Evidence / affected path | Discrepancy | Required disposition | Impact |
|---|---|---:|---|---|---|---|
| GEN-01 | resolved-by-source | info | `data/sources/risk-analysis/`; `docs/archive/deliverables/03-source-of-truth-matrix.md` | Authority is settled: original Niro scoring artifacts outrank derived configs and external interpretation ranges. | Enforce ADR-001 and claim locators. | none |
| GEN-02 | config-defect | high | all configs, `sources` and inline `source` | Provenance shapes are inconsistent/free-form; CWS lacks a root registry; many citations do not identify the claim supported. | Normalize to citation IDs and claim-level links in a later config version/migration. | blocks publication |
| GEN-03 | config-defect | high | optional booleans in COVID/Hypothyroid; Heart `bpTreated` | Absence can be confused with false and understate risk. | Apply SEM-010/011; require explicit response or missing policy. | blocks affected publication |
| GEN-04 | needs-medical-review | medium | age validation bounds in all configs | Minimum/maximum ages are engineering guards, not source-established eligibility populations. | Approve calculator population and public applicability wording. | blocks population claim |
| GEN-05 | needs-product-decision | high | `sex` parameters and context rules | Config label does not say whether the source requires sex at birth, physiology, or another attribute. | Document the medically required selector and a no-context path; do not invent a band. | blocks affected publication |
| GEN-06 | config-defect | high | all configs; no `testCases` | No config snapshots required golden/boundary evidence; Heart's example is prose only. | Add reviewed saved tests; required tests must pass under PUB-007. | blocks publication |
| GEN-07 | needs-product-decision | critical | all configs; no `content`/review object | The client requires the whole associated page, but configs contain no structured page, SEO, authorship, citations, or medical approval. | Use `content-page.v1`; require protected review hashes. | blocks publication |
| GEN-08 | config-defect | high | scoring/result bands across configs | Configs accept arbitrary decimals while many source tables use integer-looking ranges; unreachable gaps are not declared by lattice. | Declare integer/lattice or explicit `asWritten` gaps; never infer discreteness. | blocks semantic pass |
| GEN-09 | needs-product-decision | medium | all config `$schema` fields | Instance `$schema` is an opaque identifier, not a JSON Schema dialect URL. | P0A treats it as a legacy const; later migration may add `schemaVersion`. | no P0B block |

## Comprehensive Wellness Score v2

Primary evidence: `data/sources/risk-analysis/Comprehensive Wellness Score Framework_ A Point-Based Assessment of Health Parameters.pdf`, especially §§3–6 and the page-18 rejection comment; `docs/research/niro-risk-logic-extraction.md`. Config: `data/fixtures/config-samples/niro-cws.config.json`.

| ID | Class | Severity | Evidence / JSON path | Discrepancy | Required disposition | Impact |
|---|---|---:|---|---|---|---|
| CWS-00 | resolved-by-source | info | PDF §§3–6; `/scoringRules`, `/domains`, `/adjustmentRules`, `/formulas` | PDF supplies the current tables, weights, adjustments, eAG scoring decision, formulas, and result text; config largely transcribes them. | Protect with source and boundary tests. | none beyond rows below |
| CWS-01 | needs-medical-review | critical | PDF final page; `/NIRO_SOURCE_STATUS/governanceCaveat` | Source explicitly says framework was rejected because client stratified ranges were unavailable. | Keep draft until Niro supplies/approves a replacement or explicitly approves this version. | absolute publication block |
| CWS-02 | source-gap | medium | PDF/brief count language; 40 scoring rules, 49 parameters | “38 biomarkers” means 38 measured labs, while scoring also includes systolic BP and derived eAG. | Expose separate measured-lab, scored-parameter, and intake/derived counts. | blocks count-based public copy |
| CWS-03 | needs-medical-review | critical | optional lab `missingPolicy:"exclude-from-max"`; `/formulas/domain-score` | Source does not confirm that missing parameters shrink a domain denominator. Scores become incomparable across panels. | Niro must approve denominator/minimum-coverage semantics. | blocks publication |
| CWS-04 | source-gap | critical | `/domains`; zero-denominator path | Source does not define behavior for an entirely missing domain. | Choose explicit `block`, `exclude-and-renormalize`, `zero-contribution`, or `no-score`; clinical approval required. | blocks publication |
| CWS-05 | source-gap | high | `/scoringRules/18`, `/scoringRules/19` | Magnesium >2.5 and zinc >120 have no source band. | Mark `asWritten`/unscorable and obtain bands; do not interpolate. | blocks semantic/clinical pass |
| CWS-06 | source-gap | critical | `/scoringRules/23`, `/24`, `/26`–`/28` | Liver/kidney gaps: bilirubin 1.2–1.3; albumin 3.5–3.6 and >5; low/seam creatinine; BUN <7 and 20–21; low/seam uric acid. | Preserve each as no-score with clarification IDs until approved boundaries exist. | blocks publication |
| CWS-07 | source-gap | high | `/scoringRules/29`–`/36`, `/38` | Thyroid/hematology/hormonal seams include TSH 4–4.1, FT4 1.8–1.81, FT3 2.2–2.3 and 4.2–4.3, hemoglobin upper gaps, MCV 100–101, WBC 11–11.1, platelets 450–451, testosterone seams. | Explicitly annotate or obtain continuous boundaries. | blocks semantic pass/publication |
| CWS-08 | source-gap | critical | `/scoringRules/37/contexts/1` | Afternoon cortisol defines only the normal zero-point interval, not abnormal bands. | Supply approved abnormal bands or exclude cortisol scoring for that context with disclosure. | blocks publication |
| CWS-09 | config-defect | high | `/parameters/7`; cortisol contexts | Cortisol sample time is optional even when cortisol is supplied, producing no context. | Make selector conditionally required; no match is not zero. | blocks publication |
| CWS-10 | source-gap | critical | `/scoringRules/39`; PDF estradiol row | Source marks two-point estradiol band N/A and has no postmenopausal female scoring. | Unsupported context stays unscorable pending approved data. | blocks publication |
| CWS-11 | config-defect | high | `/parameters/47`; estradiol contexts | Menopausal status is optional, so female estradiol may select no context. | Conditionally require selector; postmenopausal remains blocked by CWS-10. | blocks publication |
| CWS-12 | needs-medical-review | critical | PDF §6; `/resultCategories/boundarySemantics` | `<10`, `10–20`, `21–30`, `31–50`, `>50` leave fractional seams; config chooses 10/21/31/51. | Niro must approve continuous boundaries/endpoints. | blocks publication |
| CWS-13 | config-defect | high | `/resultCategories/scale/max=110` | Raw 100 plus maximum adjustments 14 makes 114 reachable. Sparse protective scoring may also fall below asserted minimum. | Derive/approve extrema; no implicit clamp. | blocks semantic pass |
| CWS-14 | source-gap | high | `/adjustmentRules/adj-smoking` | Source distinguishes quit >5y and <5y, leaving exactly five years undefined; label silently includes it in “within.” | Obtain endpoint approval or no-score exactly five. | blocks affected rule |
| CWS-15 | source-gap | high | `/adjustmentRules/adj-activity` | “Under 75 minutes” and “sedentary” are not operationally distinguished yet score differently. | Define measurable decision rule with medical approval. | blocks affected rule |
| CWS-16 | config-defect | high | `/parameters/eag/derived/source` | Niro supports scoring eAG; the `28.7×A1c−46.7` derivation itself needs its external ADAG/ADA provenance. | Split derivation-source claim from Niro scoring-source claim. | blocks claim validation |
| CWS-17 | resolved-by-source | info | revision-3 core measurement provenance | The source-preserving migration records corrected CWS scoring provenance plus exact source/version linkage and all 45 current calculator references; stale legacy fields remain only as provenance. | Closed by the P6 revision-3 migration; keep all measurements and CWS draft/unreviewed. | resolved; no clinical approval implied |
| CWS-18 | needs-product-decision | medium | TSH and other unit aliases | Equivalent units are not always text-identical between config and library. | Resolve via stable measurement/unit IDs and aliases, not raw string equality. | no P0B block |
| CWS-19 | source-gap | high | `/parameters/eag`; missing HbA1c path | eAG is scored separately but cannot exist when HbA1c is absent; its denominator/coverage treatment is not explicit. | Define derived-missing behavior and whether dependency absence removes eAG possible points. | blocks semantic/clinical pass |
| CWS-20 | config-defect | high | all known source gaps | Gaps are described in prose but lack the plan-required `asWritten:true` plus clarification IDs. | Add nonclinical metadata only after clinical owners confirm the list; no point changes. | blocks semantic pass |

### Complete known CWS gap locator inventory

Under the locked continuous `[min,max)` default and current validation bounds, the known paths are:

- `/scoringRules/18/contexts/0`: magnesium >2.5
- `/scoringRules/19/contexts/0`: zinc >120
- `/scoringRules/23/contexts/0`: bilirubin 1.2–1.3
- `/scoringRules/24/contexts/0`: albumin 3.5–3.6 and >5
- `/scoringRules/26/contexts/0`: male creatinine <0.6 and 1.2–1.3
- `/scoringRules/26/contexts/1`: female creatinine <0.5 and 1.1–1.2
- `/scoringRules/27/contexts/0`: BUN <7 and 20–21
- `/scoringRules/28/contexts/0`: male uric acid <3.5 and 7–7.1
- `/scoringRules/28/contexts/1`: female uric acid <2.5 and 6–6.1
- `/scoringRules/29/contexts/0`: TSH 4–4.1
- `/scoringRules/30/contexts/0`: free T4 1.8–1.81
- `/scoringRules/31/contexts/0`: free T3 2.2–2.3 and 4.2–4.3
- `/scoringRules/33/contexts/0`: male hemoglobin 13.4–13.5 and >17.5
- `/scoringRules/33/contexts/1`: female hemoglobin 11.9–12 and >15.5
- `/scoringRules/34/contexts/0`: MCV 100–101
- `/scoringRules/35/contexts/0`: WBC 11–11.1
- `/scoringRules/36/contexts/0`: platelets 450–451
- `/scoringRules/37/contexts/0`: morning cortisol 4.9–5 and 25–25.1
- `/scoringRules/37/contexts/1`: afternoon cortisol <3 and >15
- `/scoringRules/38/contexts/0`: male testosterone 299–300
- `/scoringRules/38/contexts/1`: female testosterone 70–71
- `/scoringRules/39/contexts/1`: premenopausal estradiol >400
- no context: female postmenopausal estradiol; cortisol with missing sample time

## Diabetes Risk

Primary evidence: `data/sources/risk-analysis/Risk calculators.xlsx`, sheet `Diabetes`; `docs/research/niro-risk-logic-extraction.md`. Config: `data/fixtures/config-samples/diabetes-risk.config.json`.

| ID | Class | Severity | Evidence / JSON path | Discrepancy | Required disposition | Impact |
|---|---|---:|---|---|---|---|
| DIA-00 | resolved-by-source | info | workbook; aggregate/default/category rows | Source supplies points, max glycemic rule, mandatory age, activity/family defaults, waist trigger, and category escalation. | Protect with source-reproduction tests. | none beyond rows below |
| DIA-01 | source-gap | critical | `/scoringRules/0`; source `≤35` and `35–49` | Age 35 appears in both source bands; config chooses 0 by making the second bound exclusive. | Niro/reviewer must choose the intended boundary. | blocks publication; changes 20 points |
| DIA-02 | config-defect | high | `/scoringRules/4/contexts/0/bands/2` | Source says HbA1c `>6.5`; config assigns high points at exactly 6.5 and leaves 6.4–6.5 continuous gap. | Preserve ambiguity/gap; do not import external ADA semantics silently. | blocks publication |
| DIA-03 | config-defect | high | `/scoringRules/5/contexts/0/bands/2` | Source says FBS `>126`; config assigns high points at exactly 126 and leaves 125–126 gap. | Preserve ambiguity/gap pending Niro confirmation. | blocks publication |
| DIA-04 | source-gap | critical | `/parameters/7`, `/scoringRules/6`; N3 | PP sugar supplies only Normal/Borderline/High labels, no numeric criteria. | Obtain ranges or explicitly approve a lab/clinician-classified categorical input with explanatory content. | blocks publication |
| DIA-05 | config-defect | critical | `/parameterGroupsAggregation/0`; `/formulas/0` | Naive `sum(points)+glycemicIndex` double-counts three glycemic members. | P0A semantics define `sum(points)` as direct domain contributions excluding members consumed by aggregate; add golden test. | semantic resolution locked; clinical/test evidence still required |
| DIA-06 | source-gap | high | all three laboratory parameters optional; `aggregate:max` | `max(empty)` is undefined if no lab is supplied. | Choose explicit empty policy and partial-result disclosure. | blocks semantic/clinical pass |
| DIA-07 | source-gap | high | `/imputationRules/0`; missing waist below glycemic 10 | Source supplies 10 points only when glycemic index ≥10; no fallback below 10/empty. | Add reviewed fallback policy; do not infer zero. | blocks semantic/clinical pass |
| DIA-08 | config-defect | high | `/imputationRules/0/when` | Predicate does not explicitly say waist missing; a naive engine could overwrite a present waist. | Engine contract locks imputation to missing target only; validator/test must prove. | semantic resolution locked |
| DIA-09 | config-defect | high | `/resultCategories/scale/max=100` | Source-defined reachable maximum is 110 (30+10+30+20+20). | Correct metadata only after review or source correction; never alter points merely to fit 100. | blocks semantic pass |
| DIA-10 | config-defect | medium | `/parameters/hba1c`, `/parameters/fbs` | Matching core records exist but no `biomarkerKey`/measurement revision is linked. | Link during reviewed migration while preserving scoring thresholds. | blocks final traceability |
| DIA-11 | needs-medical-review | medium | `/parameters/age/validation/min=18` | Workbook does not establish adult-only use. | Approve population/applicability copy. | blocks applicability claim |
| DIA-12 | source-gap | high | `/parameters/physicalActivity`; source `Moderate→3` | Value 3 is source-transcribed but anomalous relative to commonly known IDRS scoring and contributes to scale mismatch. | Ask Niro whether 3 is intentional; external conventions may not overwrite it. | blocks clinical approval |
| DIA-13 | config-defect | high | `/scoringRules/0` | Noninteger ages between 49 and 50 are accepted by validation but unscored. | Declare age integer-only or an approved source gap. | blocks semantic pass |
| DIA-14 | needs-product-decision | medium | `/parameters/sex` | Sex is required solely for waist thresholds but its clinical meaning is not documented. | Define sex-at-birth/physiology context or approved alternative. | blocks context claim |

## Heart Risk

Primary evidence: `data/sources/risk-analysis/Risk calculators.xlsx`, sheet `Heart ` (trailing space); `docs/research/niro-risk-logic-extraction.md`. Config: `data/fixtures/config-samples/heart-risk.config.json`.

| ID | Class | Severity | Evidence / JSON path | Discrepancy | Required disposition | Impact |
|---|---|---:|---|---|---|---|
| HRT-00 | resolved-by-source | info | workbook tables/formulas; worked example | Source supplies the displayed point table, lookup, formulas, floor table, and base 13-points→10% example. | Preserve a base-stage golden test. | none beyond rows below |
| HRT-01 | needs-medical-review | critical | one source table, no sex input; N6 | Table provenance appears sex-specific/ambiguous but config applies it universally. | Niro must confirm unisex intent or provide reviewed context-specific logic. | absolute Heart publication block |
| HRT-02 | source-gap | critical | `/parameters/0/validation/min=30`; `/formulas/3` | `age<30` multiplier branch is unreachable, while source provides no base-age points below 30. | Approve ≥30 applicability and treatment of dead branch, or supply missing base logic. | blocks publication |
| HRT-03 | config-defect | critical | `/lookupTables/0/map/0` and last row | Source `<1` and `>30` are intervals/display values; config invents 0.9 and 30.1, then multiplies them. | Support interval outputs or obtain approved numeric representatives. | blocks publication/material score |
| HRT-04 | config-defect | critical | `/floorRules/0/tiers/1` | Source floor is 12–15%; config fixes 12. | Preserve unresolved interval or obtain exact approved value. | blocks publication |
| HRT-05 | config-defect | critical | `/floorRules/0/appliesWhen` | Config checks only non-smoker and normal glycemic status, not “only TC/LDL elevated and no other flags.” | Express every approved qualifying/excluding condition; prose has no effect. | blocks publication/material floor |
| HRT-06 | source-gap | high | floor tiers | Source uses `<130`, `130–159`, `160–189`, `>190`, plus TC `240`; exact LDL 190 and TC operator are undefined. | Obtain exact endpoints/operator; preserve gaps meanwhile. | blocks floor rule |
| HRT-07 | config-defect | critical | `/resultCategories/bands` | Source says `<10`, `10–19`, `>20`; config makes exact 20 High and fills fractional seams. | Approve continuous boundaries or preserve no-category gaps. | blocks publication |
| HRT-08 | source-gap | high | `/scoringRules/6` | Source TG rows `<150`, `151–200`, `201–500`, `>500`; fractional gaps 150–151 and 200–201 and exact 150 meaning remain. | Approve endpoints/lattice. | blocks semantic/clinical pass |
| HRT-09 | config-defect | high | `/parameters/6`; `/scoringRules/3/contexts/0` uses `ne true` | Missing treatment status must not select untreated context. | Conditionally require when SBP exists; P0A conditions on missing evaluate false. | blocks publication |
| HRT-10 | source-gap | high | `/parameters/8/defaultOption=normal` | Source does not clearly authorize treating missing glucose/HbA1c information as normal. | Verify or preserve unknown with coverage disclosure. | blocks publication |
| HRT-11 | config-defect | high | `/resultCategories/scale/max=60` | Within accepted inputs, adjusted risk can reach about 197.757%, exceeding 60 and a meaningful probability scale. | Niro must define cap/validity constraints; no implicit clamp. | blocks semantic/clinical pass |
| HRT-12 | source-gap | high | sheet claims Triglycerides & Non-HDL; config has no non-HDL rule | Stated method names non-HDL but no executable source rule is supplied. | Confirm indirect representation or provide formula/table. | blocks method claim |
| HRT-13 | source-gap | medium | sheet cites Vascular Age; N8 | No executable vascular-age table/formula exists. | Explicitly remove from scope/copy or obtain logic. | blocks feature claim, not base engine |
| HRT-14 | needs-product-decision | medium | lipid units | Heart source factor is 38.61; CWS/library is 38.67. | Preserve calculator-local factor and trace; obtain clinical review before harmonization. | no P0B block |
| HRT-15 | config-defect | high | `/formulas/5`; `floorPenalty` implicit | No applicable tier previously left `floorPenalty` undefined. | P0A semantics reserve it and define no applicable floor as zero with trace. | semantic resolution locked |
| HRT-16 | needs-product-decision | medium | worked example omits LDL/TG | Example verifies base points/risk, not the final adjusted/floor score and omits required LDL. | Store stage-specific; require an approved full-input final example. | blocks PUB-007 |
| HRT-17 | config-defect | medium | `/parameters/4/missingPolicy=exclude-from-max` | Policy name assumes a normalized denominator although Heart is additive. | Treat as omission-with-coverage only after explicit compatible policy migration. | blocks semantic clarity |
| HRT-18 | config-defect | high | `/imputationRules/0/action/setPointsByBand/bands` | Age 50 matches both `max:50,maxInclusive:true` and `min:50`. | Correct boundary only with source confirmation; array order cannot decide. | blocks semantic pass |
| HRT-19 | config-defect | high | formula identifiers | Kebab formula keys are referenced as camel symbols; exact-key evaluator would fail. | P0A alias rule binds them; new configs write explicit symbols. | semantic resolution locked |
| HRT-20 | config-defect | medium | `/floorRules/0/tiers` | Multiple LDL/TC tiers may match simultaneously; prior behavior was not declared. | P0A chooses maximum applicable floor and retains all messages; add tests and medical approval. | semantic resolution locked; clinical review required |

## Hypothyroid Risk

Primary evidence: `data/sources/risk-analysis/Risk calculators.xlsx`, sheet `Hypothyroid`; `docs/research/niro-risk-logic-extraction.md`. Config: `data/fixtures/config-samples/hypothyroid-risk.config.json`.

| ID | Class | Severity | Evidence / JSON path | Discrepancy | Required disposition | Impact |
|---|---|---:|---|---|---|---|
| HYP-00 | resolved-by-source | info | workbook and config rules | Age, sex, family/autoimmune history, thyroid labs, and category values are transcribed. | Protect with source/boundary tests. | none beyond rows below |
| HYP-01 | source-gap | critical | merged symptom rows; `/parameters/3`, `/scoringRules/3`; N5 | Formatting does not prove whether five points apply once to the cluster or per symptom row. Config chooses once. | Niro must confirm grouping. | blocks publication; affects maximum/categories |
| HYP-02 | needs-medical-review | high | `/scoringRules/5`–`/7` | `unknown`/not tested gets zero and becomes numerically identical to normal/negative. | Keep unknown unscored with coverage unless Niro explicitly approves zero. | blocks publication |
| HYP-03 | config-defect | high | `/parameters/2`–`/4` | Optional booleans have no missing policy; omission can act like false. | Require explicit response or missing state. | blocks publication; up to 25 points |
| HYP-04 | source-gap | high | workbook overall | No rule says whether a partial assessment is valid or how unknown factors affect interpretation. | Approve minimum completion and coverage messaging. | blocks publication |
| HYP-05 | source-gap | high | `/resultCategories/scale/max=85` | Maximum 85 depends on unresolved single-cluster interpretation. | Treat maximum as pending N5; recompute only after source decision. | blocks final scale approval |
| HYP-06 | needs-product-decision | medium | `/resultCategories/bands` | Continuous 15–16 seam is unreachable only if score lattice is integer/multiple-of-five; config does not declare this. | Add approved score lattice or explicit source gap. | blocks semantic pass |
| HYP-07 | needs-medical-review | medium | `/parameters/0/validation/min=18` | Adult-only use is not established by workbook. | Approve population/applicability. | blocks population claim |

## COVID-19 demonstration fixture

Primary evidence: the external factor-list citations registered in `data/fixtures/config-samples/covid-risk.config.json`. No Niro or validated clinical scoring instrument supports its points.

| ID | Class | Severity | Evidence / JSON path | Discrepancy | Required disposition | Impact |
|---|---|---:|---|---|---|---|
| COV-00 | resolved-by-source | info | parameter sources; top-level sources | External material supports a general severe-illness factor list. | Retain only as factor-list provenance. | does not validate scores |
| COV-01 | source-gap | critical | disclaimer, `PURPOSE_NOTE`, all `demoPoints`, categories | Age cutoffs, points, total scale, and categories are illustrative rather than a validated instrument. | Mark clinical use none/internal fixture/noindex. | permanent clinical-publication block |
| COV-02 | needs-medical-review | high | `/sources/0` reverify note | Factor list is time-sensitive and primary CDC page was not fetch-verified in the research pass. | Reverify and approve before even public informational use. | blocks public medical content |
| COV-03 | config-defect | high | `/parameters/2`–`/9` | Boolean factors are neither required nor assigned missing policies. | Require yes/no/not-applicable even for a fixture. | blocks semantic pass |
| COV-04 | config-defect | medium | `/parameters/9/key=smokingCurrent`; label | Key says current, label/source concept includes current or former. | Rename in a later metadata migration with alias/history. | blocks clean reuse/analytics |
| COV-05 | needs-product-decision | medium | `/parameters/8` pregnancy | Universal Boolean lacks applicability/not-applicable semantics. | Add explicit applicability rather than false. | blocks safe public UX |
| COV-06 | needs-product-decision | high | name and `PURPOSE_NOTE` | A preseeded config cannot prove Studio-only creation without code changes. | Keep as fixture; P10 creates a genuinely new calculator. | does not satisfy Reusability Gate |

## Measurement/catalog integrity discrepancies affecting the contract

These are not five-config clinical-value changes. They block future measurement/catalog migration and import.

| ID | Class | Severity | Evidence | Discrepancy | Required disposition | Impact |
|---|---|---:|---|---|---|---|
| MEAS-01 | data-integrity | critical | `data/catalog/measurements-reference-extension.json` conversions | At least 20 records use reciprocal factors under entered×factor→canonical convention: hematocrit, MCHC, five absolute differentials, iron/TIBC, calcium, phosphate, VLDL, four enzymes, direct/indirect bilirubin, total protein/globulin. | Reverify each factor/source and migrate directionally; no silent bulk inverse. | blocks extension import |
| MEAS-02 | data-integrity | critical | fasting-insulin conversion | Factor zero is an unresolved sentinel and noninvertible. | Resolve source/unit or omit conversion. | blocks record import |
| MEAS-03 | data-integrity | high | temperature | Slope-only representation cannot express affine conversion and direction is ambiguous. | Migrate to factor+offset with explicit from/to units. | blocks record import |
| MEAS-04 | data-integrity | high | height/weight composite codes | `ft+in` and `st+lb` are represented as factors. | Use typed composite adapters. | blocks those input forms |
| MEAS-05 | data-integrity | high | pre-pregnancy BMI; caffeine | Component/serving coefficients are mislabeled as unit conversions. | Move to input adapters/formula coefficients with sources. | blocks affected records |
| MEAS-06 | data-integrity | high | all 79 ranges; 34 conflicts; 16 derivations | Ranges/conflicts/derivations are prose, not contextual executable/source-linked structures. | Migrate to measurement-definition.v1 and clinically review. | blocks import/publish |
| MEAS-07 | data-integrity | high | active calculator/measurement hosts with `mergedFrom` | Archived nested functionality/citations are not materialized in active host fields. | Treat `mergedFrom` as provenance only; materialize reviewed active functionality before coverage/import claims. | blocks bulk catalog import |
| MEAS-08 | resolved-by-source | info | revision-3 core 40 seed | The source-preserving migration records corrected CWS scoring provenance plus exact source/version linkage and all 45 current calculator references; stale legacy fields remain only as provenance. | Closed by the P6 revision-3 migration; keep all measurements draft/unreviewed. | resolved; no clinical approval implied |
| MEAS-09 | resolved-by-source | info | five configs and core dataset | All 45 current `biomarkerKey` references resolve; Heart factor 38.61 versus CWS/library 38.67 is deliberate source-specific divergence. | Snapshot config-local factor; do not globalize one value. | none with trace/review |

## Current disposition summary

| Configuration | Structural compatibility | Semantic status | Clinical status | Publish eligibility |
|---|---|---|---|---|
| CWS v2 | compatible draft | fail | explicitly rejected/unresolved | **blocked** |
| Diabetes | compatible draft | fail | unresolved source defects | **blocked** |
| Heart | compatible draft | fail | major applicability/floor/endpoint issues | **blocked** |
| Hypothyroid | compatible draft | fail | symptom/missing rules unresolved | **blocked** |
| COVID demo | compatible draft | fail until missing policies declared | nonclinical by design | **not eligible for clinical publication** |

Unresolved discrepancies block only the affected calculator's publication, measurement import, or product feature. They do not block P0B repository scaffolding or development of generic contracts/validation infrastructure.

## P8 operational evidence handoff

The human-readable discrepancy definitions above remain authoritative. The non-executable `data/reconciliation/niro-evidence-requests.v1.json` register provides the machine-checked handoff view for the four Niro drafts: 56 current calculator-specific external blocker IDs, 20 evidence requests, zero accepted evidence, and zero publication-eligible calculators. CWS-17 is a completed engineering disposition backed by the revision-3 measurement provenance; it does not approve a measurement or CWS clinical value. `packages/contracts/reports/niro-publication-readiness.v1.{json,md}` is generated deterministically and checked with `npm run p8:readiness:check`.

The handoff register cannot close a discrepancy, add a clinical value, identify a reviewer, or advance lifecycle state. Authoritative evidence must be reviewed and applied through a new Studio draft under `specs/p8-evidence-handoff.v1.md`; the normal protected-hash review and transactional publication gates remain mandatory.
