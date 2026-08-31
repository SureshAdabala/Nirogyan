# Health Test & Calculator Catalog

**Generated:** 2026-08-20 · **Method:** 11-agent research pass (2 real-world platform inventories + 9 category deep-dives; 526 lookups against the trusted-source whitelist).
**Machine-readable data:** [health-calculator-catalog.json](health-calculator-catalog.json) (**62 calculators after the 2026-08-20 dedup cleanup** + 73-entry platform inventory index + 144 tracked issues + `calculatorAliases` map) · [measurements-reference-extension.json](measurements-reference-extension.json) (**79 measurements: 65 new analytes + 14 `libraryMerge` enrichments** of the 40-biomarker library).

> **Post-cleanup note (2026-08-20):** confirmed duplicates were merged per [Cleanup-Report.md](Cleanup-Report.md) (originals in `backup-2026-08-20/`). The tables below still describe all content accurately — merged items (VLDL, LDL/HDL & TG/HDL ratios, QUICKI, trimester finder, KDIGO stage, the two BMR methods + TDEE) now live **inside** their host entries (`friedewald-ldl`, `tc-hdl-ratio`, `homa-ir`, `gestational-age`, `ckd-epi-2021-egfr`, new `calorie-bmr-tdee`) as secondary outputs/method options with every formula and citation preserved under `mergedFrom`.
**How an entry becomes a live calculator:** Implementation-Plan §22.4 (Studio authoring pipeline; zero core-code changes).

**Sourcing policy (enforced):** every formula/threshold/range comes only from WHO, CDC, NIH family (MedlinePlus/ODS/NIDDK/NHLBI/BioLINCC), NCBI (StatPearls/PMC/Bookshelf), AHA/ACC, ADA, NKF/KDIGO, ATA, ACOG, USPSTF, FDA, NHS, NICE, Mayo Clinic, Cleveland Clinic, VA, health.gov, or primary peer-reviewed papers — recorded with `{org, title, url, accessed, verification}`. `verification` is honest per value: `fetch-verified` > `search-verified` > `blocked-cited`. **Anything not fetch-verified is blocked from publish until manually re-verified** (a to-do list of 403-blocked pages is in the JSON's `openIssues`). Conflicting authorities are always shown side-by-side labeled by organization — never merged.

---

## What the real world offers (inventory findings)

Most-common tools across MDCalc, Mayo, Cleveland Clinic, CDC, NIH, ACC/AHA, ADA, NKF, NHS: **Adult BMI** (6+ platforms), **10-year CV risk** (5), **eGFR** (4), **diabetes/prediabetes risk test** (3), child BMI percentile, calorie/weight planning, BP interpretation, heart age, PHQ-9/GAD-7, Cockcroft-Gault (MDCalc's #1). Omni's health catalog (popularity signal only) confirms the same clusters: BMI variants, calorie/BMR/TDEE, pregnancy (42 tools), cardiovascular, body measurements, diabetes, sleep.

**Best fit for Niro's lab-report lead-magnet:** lab-derived formulas (eGFR 2021, Friedewald LDL, non-HDL + ratios, eAG↔A1c, HOMA-IR, FIB-4, corrected calcium, TSAT, uACR staging) + the universal wellness set (BMI incl. WHO-Asian cutoffs, waist ratios, BP category, FINDRISC/IDRS, BMR/TDEE, due date, PHQ-9/GAD-7, pack-years, water intake).

**India-specific rules (surface both, default to Indian context, never merge):** WHO-Asian BMI action points 23.0/27.5 (WHO Lancet 2004; NHS operationalizes 23–27.4 overweight / ≥27.5 obese for South Asians) vs standard 25/30 · IDF South-Asian waist cutoffs ≥90 cm M / ≥80 cm F vs WHO generic 94/102 M, 80/88 F · IDRS stays primary for diabetes risk (Indian-validated), ADA/CDC test secondary labeled.

---

## Calculator catalog (70 full-spec entries)

Legend: **T1** = launch-priority (high SEO + lab-report fit) · **T2** = later catalog · **T3** = research-context, licensing, or clinical caution. 🔓 = fully expressible in today's engine primitives · 🔒 = gated on an engine extension (named). The "Logic" column is descriptive shorthand; the JSON's `logicType` enum (`formula|points|bands|lookup|mixed`) is canonical where they differ.

### Body & anthropometry (12)
| Calculator | Tier | Logic | Status |
|---|---|---|---|
| BMI (WHO + WHO-Asian + CDC bands) | 1 | formula+bands | 🔓 |
| Waist circumference risk (NIH/WHO/Asian) | 1 | bands | 🔓 |
| Waist-to-height ratio (NICE 0.4/0.5/0.6) | 1 | formula+bands | 🔓 (NICE pages 403 — re-verify before publish) |
| Body fat % — US Navy method (+ACE categories) | 1 | formula | 🔒 log10() |
| BMR — Mifflin-St Jeor (original coefficients 9.99/6.25/4.92) | 1 | formula | 🔓 |
| TDEE activity multipliers (1.2–1.9, StatPearls-anchored) | 1 | lookup | 🔓 (intermediate multipliers labeled "convention") |
| Waist-to-hip ratio (WHO 0.90/0.85) | 2 | formula+bands | 🔓 |
| Body surface area (Mosteller/Du Bois/Haycock) | 2 | formula | 🔒 fractional pow() (Mosteller ok via pow 0.5) |
| Ideal body weight (Devine + Robinson/Miller/Hamwi) | 2 | formula | 🔓 |
| Lean body mass (Boer) | 2 | formula | 🔓 (confirm height-in-cm vs primary before launch) |
| BMR — revised Harris-Benedict (Roza & Shizgal) | 2 | formula | 🔓 |
| Daily calorie needs (DGA Table A2-1) | 2 | lookup | 🔓 (full table must be manually transcribed — dietaryguidelines.gov 403) |

### Cardiovascular & vitals (11)
| Calculator | Tier | Logic | Status |
|---|---|---|---|
| Blood pressure category (AHA 2025 wording, incl. Severe-vs-Emergency split) | 1 | bands | 🔓 |
| Resting heart rate checker (AHA/MedlinePlus, pediatric bands) | 1 | bands | 🔓 |
| Max heart rate (220−age AND Tanaka 208−0.7×age, both shown) | 1 | formula | 🔓 |
| Target HR zones (AHA 50–70/70–85% + Karvonen HRR) | 1 | formula | 🔓 |
| Non-HDL cholesterol (TC−HDL; MedlinePlus age cuts + Mayo <130) | 1 | formula+bands | 🔓 |
| TC/HDL ratio | 1 | formula | 🔓 (famous "<5:1 / 3.5:1" cutoffs NOT verifiable — ship qualitative) |
| Mean arterial pressure (DBP+PP/3; 60 mmHg floor) | 2 | formula | 🔓 |
| Pulse pressure (Mayo vs StatPearls conflict shown) | 2 | formula+bands | 🔓 |
| ASCVD 10-yr risk (Pooled Cohort Equations) | 2 | formula | 🔒 ln()+exp() + coefficient transcription from Goff 2013 appendix (consider AHA PREVENT at same time) |
| LDL/HDL ratio | 3 | formula | 🔓 (no authoritative cutoffs — informational only) |
| TG/HDL ratio | 3 | formula | 🔓 (same; mg/dL-unit trap documented) |

### Metabolic & diabetes (7)
| Calculator | Tier | Logic | Status |
|---|---|---|---|
| HOMA-IR (G×I/405; attributed cutoffs 2.5 NHANES / 1.4–2.5 Asian) | 1 | formula | 🔓 |
| FINDRISC (full 0–26 point table, 5 tiers) | 1 | points | 🔓 |
| Metabolic syndrome checker (ATP III/harmonized 3-of-5, Asian waist 90/80) | 1 | mixed | 🔓 |
| OGTT 2-hour interpreter (ADA <140/140–199/≥200) | 1 | bands | 🔓 |
| TyG index (ln[TG×G/2], cutoff ~9.0) | 1 | formula | 🔒 ln() (scale-hazard documented) |
| ADA/CDC Type 2 Diabetes Risk Test (0–11, ≥5 high) | 2 | points | 🔓 (check ADA branding; IDRS stays primary for India) |
| QUICKI (1/[log10 I + log10 G], <0.357) | 2 | formula | 🔒 log10() |

### Kidney & hydration (5)
| Calculator | Tier | Logic | Status |
|---|---|---|---|
| eGFR — CKD-EPI 2021 race-free (exact κ/α coefficients from NEJM/NKF) | 1 | formula | 🔒 confirm pow() with fractional NEGATIVE exponents |
| KDIGO CKD stage (G1–G5 × A1–A3 risk heat-map) | 1 | bands+lookup | 🔒 2-D/composite-key lookup (or 18 nested conditions) |
| BUN:creatinine ratio (10/15/20 patterns) | 1 | formula+bands | 🔓 |
| Daily water intake (IOM AI 3.7/2.7 L + NHS 6–8 cups, side-by-side) | 1 | lookup | 🔓 |
| Creatinine clearance — Cockcroft-Gault | 2 | formula | 🔓 (NKF criticisms displayed) |

### Liver & alcohol (5)
| Calculator | Tier | Logic | Status |
|---|---|---|---|
| FIB-4 index (AASLD 2023 cutoffs 1.3/2.67, age>65 → 2.0; HCV set separate) | 1 | formula+bands | 🔒 sqrt (= fractional pow) |
| APRI (WHO 2024 Box 4.1; 2015-vs-2024 cutoff conflict shown) | 1 | formula+bands | 🔓 (AST ULN editable, default 40) |
| Standard drinks & low-risk limits (NIAAA 14 g + UK 14 units) | 1 | mixed | 🔓 (DGA 2025 dropped numeric limits — label editions) |
| AUDIT-C (VA point table; ≥4 M / ≥3 F vs VA/DoD ≥5 both shown) | 1 | points | 🔓 |
| AST/ALT (De Ritis) ratio | 2 | formula | 🔓 (heuristic framing only) |

### Respiratory & smoking (7)
| Calculator | Tier | Logic | Status |
|---|---|---|---|
| Pack-years + USPSTF lung-screening eligibility (50–80, ≥20 py, quit <15 y) | 1 | mixed | 🔓 |
| Predicted peak expiratory flow (Hankinson/NHANES III polynomials — verbatim coefficient tables recovered from NIH BioLINCC) | 1 | formula | 🔓 (two OCR cells to cross-check) |
| SpO₂ checker (WHO/NHS/Cleveland bands, most-conservative escalation) | 1 | bands | 🔓 |
| FEV1/FVC interpretation (GOLD 0.70 + grades; ATS/ERS z-score conflict noted) | 2 | mixed | 🔓 (z-scores themselves 🔒 GLI datasets) |
| Respiratory rate checker (12–20 vs 12–18 per-org) | 2 | bands | 🔓 |
| 6-minute walk distance reference (Enright & Sherrill) | 2 | formula | 🔓 (LLN constants unverified — excluded) |
| mMRC dyspnea scale | 3 | points | 🔓 (confirm MRC permission for commercial use) |

### Women's & reproductive health (7)
| Calculator | Tier | Logic | Status |
|---|---|---|---|
| Pregnancy due date (Naegele +280 d, cycle adjust, ACOG redating summary) | 1 | mixed | 🔒 date arithmetic |
| Gestational age (+ ACOG term classification) | 1 | mixed | 🔒 date arithmetic |
| Ovulation & fertile window (cycle−14; ACOG 6-day window; NOT contraception) | 1 | mixed | 🔒 date arithmetic |
| Pregnancy weight gain (IOM/NAM 2009 by BMI, twins, kg/week rates) | 1 | mixed | 🔓 — shippable today |
| Pregnancy trimester finder (Cleveland 13/28-week scheme, labeled) | 2 | bands | 🔓 |
| Menstrual cycle checker (21–35 d adult / 21–45 d teen, red flags) | 2 | bands | 🔓 — shippable today |
| Pediatric growth percentiles (WHO 0–2 y / CDC 2–19 y) | 2 (gated elements effectively tier 3) | lookup | 🔒 LMS datasets + normal CDF + ln() + interpolation |

### Mental health, sleep & lifestyle (8)
| Calculator | Tier | Logic | Status |
|---|---|---|---|
| PHQ-9 (public domain; bands 5/10/15/20; **item-9 crisis escalation mandatory**) | 1 | points | 🔓 + crisis-resources UI block |
| GAD-7 (public domain; bands 5/10/15) | 1 | points | 🔓 + crisis-resources UI block |
| Sleep duration by age (AASM primary; NSF/WHO labeled parallel) | 1 | bands | 🔓 |
| PSS-10 | 2 | points | 🔓 but ⚠️ no official cutoffs + commercial-use permission unresolved |
| Caffeine intake (FDA 400 mg; ACOG 200 mg pregnancy) | 2 | mixed | 🔓 (per-beverage mg = labeled estimates) |
| WHO physical-activity target checker | 2 | mixed | 🔓 |
| Epworth Sleepiness Scale | 3 | points | ⚠️ **LICENSED (Mapi Trust) — do not implement without license** |
| Child screen-time checker (WHO/AAP) | 3 | bands | 🔓 |

### Lab-derived value calculators (8)
| Calculator | Tier | Logic | Status |
|---|---|---|---|
| Transferrin saturation (iron/TIBC×100) | 1 | formula | 🔓 |
| Corrected calcium (Ca + 0.8×(4−albumin)) | 1 | formula | 🔓 |
| Friedewald LDL (TC−HDL−TG/5; invalid TG≥400; compute in mg/dL) | 1 | formula+bands | 🔓 |
| VLDL estimate (TG/5; normal <30) | 2 | formula | 🔓 |
| NLR (0.78–3.53 healthy-adult range; no severity ladder — unverified) | 2 | formula | 🔓 |
| A/G ratio (qualitative ">1" only — numeric bands unverifiable) | 2 | formula | 🔓 |
| Anion gap (4–12 without K; albumin correction) | 3 | formula | 🔓 |
| Indirect bilirubin (total−direct; derived-only display) | 3 | formula | 🔓 |

---

## Measurement dataset extension (83 entries)

Extends the existing 40-biomarker library with: **CBC extras** (RBC, hematocrit, MCH, MCHC, RDW, 5-part differential % + absolute) · **iron studies** (serum iron, TIBC, TSAT) · **electrolytes** (Na, K, Cl, CO₂/bicarbonate) · **minerals** (total calcium, phosphate) · **lipid-derived** (non-HDL, VLDL, triglyceride categories) · **liver extras** (ALP, direct/indirect bilirubin, total protein, globulin, A/G) · **pancreatic/muscle** (amylase, lipase, LDH, CK) · **glycemic** (fructosamine, OGTT-2h, fasting insulin as input-only) · **men's health** (PSA with USPSTF Grade C/D guardrails) · **vitals** (SBP/DBP, resting HR, respiratory rate, SpO₂, body temperature, MAP, pulse pressure) · **anthropometry** (waist/hip/neck circumference) · **repro/lifestyle references** (cycle length, bleeding duration, pre-pregnancy BMI, GA classification, sleep/caffeine/activity/screen-time reference tables). Every entry: canonical unit, conversions, verbatim per-org ranges, recorded conflicts (17+, e.g., calcium 8.8–10.3 vs 8.5–10.5; potassium 3.7–5.2 vs 3.5–5.0; TIBC; ANC; CK units warning), sources.

⚠️ Merge note: MedlinePlus MCV 79–95 fL conflicts with the existing library's StatPearls 80–100 — record as conflict during merge, don't overwrite.

## Engine extension gate (consolidated — final list)

| Extension | Unlocks | Priority |
|---|---|---|
| `ln()`, `exp()`, `log10()`, `sqrt()` in expression whitelist; **confirm `pow()` handles fractional & negative exponents** | FIB-4, TyG, QUICKI, US Navy body fat, BSA, CKD-EPI 2021, (later ASCVD/PREVENT) | **P2 — trivial, do at engine build** |
| Affine unit conversion (factor **+ offset**) | °F↔°C body temperature | P2 — small schema addition |
| Date arithmetic (`date` input type; date±days, date-diff, weeks+days format) | Due date, gestational age, ovulation, trimester — the pregnancy SEO cluster | engine v1.1 (post-launch) |
| 2-D / composite-key lookup | KDIGO G×A risk matrix (workaround: 18 nested conditions) | v1.1 convenience |
| Bulk dataset lookup (LMS tables) + normal CDF + interpolation | Child growth percentiles, GLI z-scores, Martin-Hopkins LDL | only when tier-3 scheduled |
| Iterative simulation | NIDDK Body Weight Planner | **rejected** — not config-expressible; link out instead |
| Crisis-interstitial UI block (product, not math) | PHQ-9 item-9 escalation; all mental-health tools (988 resources) | required before any mental-health launch |

## Licensing & branding register

**Blocked without license:** Epworth (Mapi Trust) · FRAX (Sheffield, algorithm unpublished — link-out only) · STOP-BANG (UHN) · COPD CAT (GSK). **Conditional:** PSS-10 (free only for nonprofit academic use — get permission) · ADA "Type 2 Diabetes Risk Test" name (scoring is published; branding is ADA's) · "Life's Essential 8"/"My Life Check" (AHA trademarks — implement published scoring under neutral name) · mMRC (confirm MRC terms). **Clear:** PHQ-9, GAD-7 (public domain, statement captured), AUDIT-C (attribute WHO/Bush 1998), FINDRISC (attribute Lindström & Tuomilehto), all pure formulas (Friedewald, MAP, Naegele, CKD-EPI, etc.).

## Pre-publish re-verification list (403-blocked primaries)

cdc.gov (BMI categories, prediabetes-test PDF, waist pages, lung screening) · heart.org readings page · nice.org.uk NG246 (WHtR bands + ethnic BMI cutoffs) · iris.who.int (waist/WHR 2008 report; anaemia 2024 PDF) · dietaryguidelines.gov Table A2-1 · acog.org (CO 700 redating table, CO 548, caffeine CO 462) · niaaa.nih.gov limits pages · kdigo.org 2024 guideline · FDA caffeine page (404 this session) · AAP screen-time page · PCE coefficient appendix (ahajournals.org). Each is already marked `search-verified`/`blocked-cited` in the JSON and **publish-blocked** until a human (or browser session) captures it verbatim.
