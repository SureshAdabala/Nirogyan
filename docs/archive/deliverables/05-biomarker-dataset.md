# Complete Biomarker Dataset

> Deliverable 5. Implementation-ready dataset for all 38 biomarkers + 5 demographic/lifestyle factors across the 9 Niro health domains. The machine-readable version (with full source URLs, conversions, validation bounds and per-band detail) is [data/fixtures/config-samples/biomarker-dataset.json](../../data/fixtures/config-samples/biomarker-dataset.json). Detailed per-biomarker prose is in [06-biomarker-reference.md](06-biomarker-reference.md).

## How to read this dataset — the three source classes

| Tag | Meaning |
|---|---|
| **NIRO** | Defined by Niro original sources (audio recordings, risk-logic material consolidated in the Niro brief) |
| **EXT** | Externally verified against an authoritative medical source (org + URL + access date recorded in JSON + research files) |
| **NC** | *Needs Clarification* — not resolvable from Niro sources, and either absent from authoritative sources or lab/assay-dependent |

**STATUS UPDATE (2026-08-18, after `Risk Analysis/` folder arrival):** the Niro risk-logic files are now provided. **Every "Niro Points: NC" cell in the table below is superseded** — the complete Niro point system (all 38 parameters + adjustments) is transcribed in [research/niro-risk-logic-extraction.md](research/niro-risk-logic-extraction.md) §A and configured in [config-samples/niro-cws.config.json](config-samples/niro-cws.config.json) (v2, source-tagged per band). Governance caveat: the CWS Framework PDF carries a rejection comment ("no stratified ranges available for client") — see clarification N1. The three ACTIVE risk calculators (Hypothyroid, Diabetes, Heart) are configured from the XLSX in their own config files. The table below retains the external clinical anchors, which now serve their intended role: biomarker-page interpretation references alongside (never instead of) Niro scoring.

**Niro-vs-external divergences now visible (preserve Niro for the calculator, flag for review — per source rules):** Vitamin D (Niro <20→2 pts vs ODS deficiency <12) · Magnesium (Niro optimal 2.0–2.5 vs MedlinePlus 1.7–2.2 mg/dL) · B12 (Niro optimal >400 vs lab-normal floor ~200–300) · Folate (Niro >5.4 optimal vs WHO deficient <3) · TC (Niro <160 optimal vs external <200 desirable) · LDL (Niro <70 optimal vs external <100) · TSH (Niro 0.4–4.0 aligns with ATA; narrower than MedlinePlus 4.8) · Anti-TPO (Niro <35 vs lab-specific 5.6–9) · uric acid, ESR, ferritin, ALT/AST/GGT sex bands (Niro-specific cuts).

## Domain structure and weights — NIRO-defined

| # | Domain | Weight | Parameters |
|---|---|---|---|
| 1 | Cardiovascular | 25% | Total Cholesterol, HDL, LDL, Triglycerides, Systolic BP, hs-CRP, ApoB:ApoA Ratio |
| 2 | Metabolic | 20% | Fasting Glucose, HbA1c, Fasting Insulin, Estimated Average Glucose |
| 3 | Inflammatory | 15% | IL-6, CRP, ESR |
| 4 | Nutritional | 10% | Vitamin D, Vitamin B12, Folate, Ferritin, Magnesium, Zinc |
| 5 | Liver | 10% | ALT, AST, GGT, Total Bilirubin, Albumin |
| 6 | Kidney | 5% | eGFR, Serum Creatinine, BUN, Uric Acid |
| 7 | Thyroid | 5% | TSH, Free T4, Free T3, Anti-TPO |
| 8 | Hematological | 5% | Hemoglobin, MCV, WBC, Platelets |
| 9 | Hormonal | 5% | Cortisol, Testosterone, Estradiol |

Total = 100%. Source: NIRO (brief §4–5, consolidating the Niro risk-logic material).

## Master biomarker table

Ranges shown are the externally verified reference anchors (see JSON for the full band sets, conflicts and URLs). Sex/Age = demographic-specific interpretation rules exist. Points = Niro scoring points.

| Biomarker | Domain | Unit | External reference anchor | Sex/Age rules | Input | Niro Points | Range source |
|---|---|---|---|---|---|---|---|
| Total Cholesterol | Cardiovascular | mg/dL | Desirable <200 · Borderline 200–239 · High ≥240 | — | number | **NC** | EXT MedlinePlus/NCEP |
| HDL Cholesterol | Cardiovascular | mg/dL | Low: <40 (M) / <50 (F) · Optimal ≥60 | Sex | number | **NC** | EXT MedlinePlus (conflict: StatPearls F<55 recorded) |
| LDL Cholesterol | Cardiovascular | mg/dL | Optimal <100 · 100–129 · 130–159 · 160–189 · ≥190 | — | number | **NC** | EXT MedlinePlus/NCEP ATP III |
| Triglycerides | Cardiovascular | mg/dL | Normal <150 · 150–199 · 200–499 · ≥500 | — | number | **NC** | EXT MedlinePlus |
| Systolic BP | Cardiovascular | mmHg | <120 · 120–129 · 130–139 · ≥140 · crisis >180 | — | number | **NC** | EXT ACC/AHA 2017 via MedlinePlus/StatPearls |
| hs-CRP | Cardiovascular | mg/L | CV risk: <1 low · 1–3 avg · >3 high | — | number | **NC** | EXT AHA/CDC via StatPearls |
| ApoB:ApoA-I Ratio | Cardiovascular | ratio | Research bands 0.2–0.6 / 0.61–0.9 / 0.91–5.0 (AMORIS) | — | number | **NC** | **NC** — no guideline categories; research-derived only |
| Fasting Glucose | Metabolic | mg/dL | Normal <100 · Prediabetes 100–125 · Diabetes ≥126 | — | number | **NC** | EXT ADA |
| HbA1c | Metabolic | % | Normal <5.7 · Prediabetes 5.7–6.4 · Diabetes ≥6.5 | — | number | **NC** | EXT ADA/NIDDK |
| Fasting Insulin | Metabolic | µIU/mL | **NC** — no universal range (assay-dependent) | — | number | **NC** | **NC** |
| eAG (derived) | Metabolic | mg/dL | = 28.7 × A1c − 46.7 (interpret via HbA1c) | — | derived | **NC** (display-only?) | EXT ADA (formula verified) |
| IL-6 | Inflammatory | pg/mL | **NC** — lab-dependent (ARUP ≤2.0; Mayo <6.4 unverified) | — | number | **NC** | **NC** |
| CRP | Inflammatory | mg/L | Healthy <3 · minor 3–10 · moderate 10–100 · marked >100 | — | number | **NC** | EXT MedlinePlus/StatPearls |
| ESR | Inflammatory | mm/hr | M<50y: <15 · M>50y: <20 · F<50y: <20 · F>50y: <30 | Sex + Age | number | **NC** | EXT MedlinePlus/StatPearls |
| Vitamin D (25-OH) | Nutritional | ng/mL | Deficient <12 · Inadequate 12–<20 · Adequate ≥20 · Adverse >50 | — | number | **NC** | EXT NIH ODS (ES-2011 conflict recorded) |
| Vitamin B12 | Nutritional | pg/mL | Subnormal <200–250 (ODS) · Normal 299–1054 (MedlinePlus) | — | number | **NC** | EXT (conflict recorded) |
| Folate | Nutritional | ng/mL | WHO: deficient <3 · possible 3–5.9 · normal 6–20 | — | number | **NC** | EXT WHO/ODS (conflicts recorded) |
| Ferritin | Nutritional | ng/mL | WHO deficiency <15 · Ref M 30–400 / F 13–150 · overload thresholds | Sex | number | **NC** | EXT WHO/MedlinePlus/ODS |
| Magnesium | Nutritional | mg/dL | 1.7–2.2 (MedlinePlus) vs ODS 1.82–2.31 | — | number | **NC** | EXT (conflict recorded) |
| Zinc | Nutritional | µg/dL | Normal 80–120 · inadequate <70 (F) / <74 (M) | Sex | number | **NC** | EXT NIH ODS (single-source) |
| ALT | Liver | U/L | Lab 4–36 · ACG true-normal ULN M 29–33 / F 19–25 | Sex (ACG) | number | **NC** | EXT ACG/MedlinePlus (conflict recorded) |
| AST | Liver | U/L | 8–33 (MedlinePlus) vs 5–30 (StatPearls) | — | number | **NC** | EXT (conflict recorded) |
| GGT | Liver | U/L | F 8–35 · M 8–50 (UMich; other unisex ranges recorded) | Sex | number | **NC** | EXT UMich/MedlinePlus (conflicts recorded) |
| Total Bilirubin | Liver | mg/dL | Normal 0.1–1.2 · jaundice >3 | — | number | **NC** | EXT MedlinePlus/StatPearls |
| Albumin | Liver | g/dL | 3.4–5.4 (MedlinePlus) vs 3.5–5.0 (StatPearls) | — | number | **NC** | EXT (conflict recorded) |
| eGFR | Kidney | mL/min/1.73m² | KDIGO G1 ≥90 · G2 60–89 · G3a 45–59 · G3b 30–44 · G4 15–29 · G5 <15 | — | number | **NC** | EXT NKF/KDIGO |
| Serum Creatinine | Kidney | mg/dL | M 0.7–1.3 · F 0.5–0.95 (MedlinePlus; alt ranges recorded) | Sex | number | **NC** | EXT (conflicts recorded) |
| BUN | Kidney | mg/dL | 6–20 (MedlinePlus) vs 5–20 (Clinical Methods) | — | number | **NC** | EXT (conflict recorded) |
| Uric Acid | Kidney | mg/dL | Ref F 3.0–7.1 · M 4.0–8.6 · solubility threshold 6.8 | Sex | number | **NC** | EXT MedlinePlus/StatPearls |
| TSH | Thyroid | mIU/L | 0.4–4.0 (ATA) · upper limit conflicts 4.5/4.8 recorded · Rx >10 | Age (>80 note) | number | **NC** | EXT ATA/MedlinePlus/StatPearls |
| Free T4 | Thyroid | ng/dL | 0.8–1.9 (MedlinePlus) vs 0.9–1.7 (Cleveland Clinic) | — | number | **NC** | EXT (conflict recorded) |
| Free T3 | Thyroid | pg/mL | 2.1–4.4 (MedlinePlus) vs 2.3–4.1 (Cleveland Clinic) | — | number | **NC** | EXT (conflict recorded) |
| Anti-TPO | Thyroid | IU/mL | **NC** — lab/assay-dependent cutoff (CC <5.6; Mayo <9.0 unverified) | — | number | **NC** | **NC** |
| Hemoglobin | Hematological | g/dL | WHO anemia M <13 · F <12 · Ref M 13.8–17.2 / F 12.1–15.1 | Sex | number | **NC** | EXT WHO 2024/MedlinePlus |
| MCV | Hematological | fL | Micro <80 · Normo 80–100 · Macro >100 | — | number | **NC** | EXT StatPearls (MedlinePlus 79–95 recorded) |
| WBC | Hematological | ×10⁹/L | Low <4.5 · Normal 4.5–11.0 · High >11.0 | — | number | **NC** | EXT MedlinePlus/StatPearls |
| Platelets | Hematological | ×10⁹/L | Low <150 · Normal 150–450 · High >450 (400 conflict recorded) | — | number | **NC** | EXT (conflict recorded) |
| Cortisol (morning) | Hormonal | µg/dL | 8 a.m.: 5–25 (MedlinePlus) vs 10–20 (CC) — draw time REQUIRED | Context (time) | number | **NC** | EXT (conflict recorded) |
| Testosterone | Hormonal | ng/dL | M 17–50y 249–836 · M>50 193–740 · F ranges · low-T <300 (AUA) vs 264 (ES) | Sex + Age | number | **NC** | EXT AUA/ES/MedlinePlus (conflict recorded) |
| Estradiol | Hormonal | pg/mL | M 10–50 · F pre 30–400 · F post 0–30 · phase ranges **NC** | Sex + Menopause | number | **NC** | EXT MedlinePlus + **NC** (phase) |

## Demographic / lifestyle factors — NIRO adjustment inputs

| Factor | Input | External category anchor | Niro adjustment points |
|---|---|---|---|
| Age | number (years) | — | **NC** — await sheet |
| Sex | select M/F | — (context driver for sex-specific rules) | n/a |
| BMI | derived (kg/m²) | WHO/CDC: <18.5 · 18.5–24.9 · 25–29.9 · ≥30 | **NC** — await sheet |
| Smoking | select never/former/current | CDC NHIS definitions (≥100 lifetime cigarettes) | **NC** — await sheet |
| Physical activity | select | WHO 2020: 150–300 min moderate or 75–150 vigorous weekly | **NC** — await sheet (option granularity too) |

## Dataset-wide clarification register (what only Niro can answer)

| # | Item | Why it's blocked |
|---|---|---|
| C1 | Per-parameter scoring thresholds + points (all 38) | Defined in Niro Risk Logic Sheet — not in provided folder |
| C2 | Adjustment point values for age/BMI/smoking/activity | Same |
| C3 | Max points per parameter/domain (needed for `sum/max × 100`) | Same |
| C4 | Category boundary semantics (does 20.3 fall in Good or Fair? gaps at 10/20–21/30–31/50) | Brief lists `<10, 10–20, 21–30, 31–50, >50` — boundaries between 20–21 and 30–31 and the treatment of exact 10/50 need the sheet |
| C5 | Missing-value policy for skipped labs | Not stated in any provided source |
| C6 | Whether eAG is scored or display-only (it is derived from HbA1c — scoring both may double-count) | Brief lists it as a parameter; sheet must confirm |
| C7 | Required-vs-optional status per parameter | Not stated; assumed optional except demographics |
| C8 | Cortisol draw-time handling, estradiol context granularity | Brief §6 says context-dependent; exact rule needs sheet |
| C9 | Fasting Insulin / IL-6 / Anti-TPO scoring bands | No authoritative universal ranges exist — only Niro can define scorable bands (or the user's lab interval must be input) |

## External conflicts register (authoritative sources that disagree — surfaced, never merged silently)

Vitamin D (ODS 12/20 vs Endocrine Society 2011 20/30 vs ES-2024 no-thresholds) · HDL female low cutoff (50 vs 55) · B12 (<200–250 vs <299) · folate (<3 vs <4 deficiency) · magnesium (0.75–0.95 vs 0.70–0.91 mmol/L) · ferritin deficiency (WHO <15 vs ODS <30) · MCV (79–95 vs 80–100) · platelet upper limit (400 vs 450) · ALT (lab 4–36 vs ACG 29–33/19–25) · AST (8–33 vs 5–30) · GGT (three ranges) · creatinine (two range sets) · BUN (6–20 vs 5–20) · TSH upper limit (4.0/4.5/4.8) · Free T4 (0.8–1.9 vs 0.9–1.7) · Free T3 (2.1–4.4 vs 2.3–4.1) · cortisol morning (5–25 vs 10–20) · low-T threshold (300 AUA vs 264 ES) · uric acid (reference interval vs clinical threshold).

Resolution policy: if the Niro sheet defines a value, Niro wins for the Niro calculator (difference flagged for review). Otherwise both values are shown labeled by organization, and the platform's biomarker pages state that lab report ranges take precedence for the individual.
