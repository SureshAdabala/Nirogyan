# Trusted Medical Data Source List + External Medical Data Mapping

> Deliverables 4 & 9. The authoritative sources actually used for every externally sourced medical value in this package, the access method, and the mapping policy. Per-biomarker verbatim findings: [research/](research/) (4 files). Per-value tags: [config-samples/biomarker-dataset.json](config-samples/biomarker-dataset.json).

## 1. Source priority applied (per master §3)

**LEVEL 1 — Niro original sources (always win for Niro logic):** Audio 1–3 (transcribed 2026-08-18), NIRO_Project_Source_Context_and_Implementation_Brief.txt (consolidated context; reference document), Niro Risk Logic Google Sheet + Doc (**referenced but not provided — every dependent value flagged NC**).

**LEVEL 2 — Authoritative external sources used (all fetch-verified on 2026-08-18 unless flagged):**

| Organization | Used for | Access status |
|---|---|---|
| MedlinePlus (NIH/NLM) | Lipids, BP, CRP, ESR, liver panel, kidney panel, thyroid, hormones, CBC, B12, magnesium, BMI | Fetched ✓ |
| NIH Office of Dietary Supplements (ODS) | Vitamin D, B12, folate, iron/ferritin, magnesium, zinc | Fetched ✓ (browser UA) |
| StatPearls / NCBI Bookshelf | hs-CRP bands, hypertension, diabetes, liver tests, hyperuricemia, MCV, WBC, platelets, subclinical hypothyroidism | Fetched ✓ |
| American Diabetes Association (diabetes.org, professional.diabetes.org) | Glucose/HbA1c categories; eAG formula | Fetched ✓ |
| NIDDK (NIH) | A1C/eAG explanation; kidney lab evaluation | Fetched ✓ |
| WHO | Hemoglobin/anemia 2024 guideline PDF; ferritin 2020 guideline PDF; folate 2015 report PDF; BMI fact sheet; physical activity 2020 guidelines (PMC) | Fetched ✓ (official PDFs via IRIS) |
| National Kidney Foundation | eGFR / KDIGO stages | Fetched ✓ |
| American Thyroid Association | TSH 0.4–4.0 target (Jonklaas 2014 via PMC full text) | Fetched ✓ |
| American College of Gastroenterology | ALT sex-specific ULN + elevation grades (official guideline summary PDF) | Fetched ✓ |
| American Urological Association | Low-testosterone <300 ng/dL guideline statement | Fetched ✓ |
| Endocrine Society (endocrine.org) | Harmonized testosterone range; vitamin D 2024 position | Fetched ✓ |
| CDC (archive.cdc.gov) | Smoking status definitions (verbatim) | Archive fetched ✓ (live cdc.gov 403) |
| PLOS Medicine | ApoB:ApoA-I AMORIS bands | Fetched ✓ |
| ARUP Laboratories (Univ. of Utah) | IL-6 lab interval example | Fetched ✓ |
| Univ. of Michigan MLabs | GGT sex-specific ranges | Fetched ✓ |
| Cleveland Clinic (secondary) | Cholesterol tiers, FT4/FT3, anti-TPO, cortisol, ApoB | Fetched ✓ |
| URMC Health Encyclopedia (secondary) | Insulin lab-dependence example | Fetched ✓ |

**Fetch-blocked (403) — cited as provenance only, values verified via the fetched sources above:** heart.org, live cdc.gov, ahajournals.org, acc.org, mayoclinic.org / mayocliniclabs.com / testcatalog.org, kdigo.org, kidney-international.org, thyroid.org, pubmed full text (partly), diabetesjournals.org.

**Search-verified-only values (explicitly NOT fetch-verified — re-verify before production):** Mayo IL-6 <6.4 pg/mL · Mayo anti-TPO <9.0 IU/mL · Mayo estradiol phase ranges · CDC BMI class 1/2/3 boundaries (main cutoffs fetch-verified via WHO/MedlinePlus) · Endocrine Society 264 ng/dL *diagnostic use* (harmonized range itself fetch-verified).

**Explicitly NOT used:** blogs, SEO health sites, forums/Reddit, social media, Wikipedia-as-final-authority, unverified AI knowledge.

## 2. External medical data mapping policy

1. **Niro precedence.** External values NEVER overwrite a Niro rule. Where the Niro sheet later disagrees with an external anchor, the Niro value is configured for the Niro calculator and the difference is flagged for review (auto-diff report — see [16-testing-strategy.md](16-testing-strategy.md) §5).
2. **Per-claim attribution.** Every band/threshold in the dataset carries `{type, org, title, url, accessed}`; interim scoring bands additionally carry `interimPendingNiroSheet: true`.
3. **Conflicts surfaced, never merged.** 19 recorded disagreements between authorities (list in [05-biomarker-dataset.md](05-biomarker-dataset.md)); UI shows both values labeled by organization.
4. **Lab-dependence honored.** Insulin, IL-6, anti-TPO, estradiol phases: no invented universal range; "check your lab report's interval" pattern + NC flag.
5. **Currency notes.** BP categories: 2017 ACC/AHA retained by 2025 guideline. Vitamin D: Endocrine Society 2024 withdrew numeric thresholds — ODS/FNB framework is the standing numeric authority; ES-2011 numbers shown only as labeled-superseded. Lipid tiers are NCEP ATP III legacy classification, presented as classification not treatment targets.

## 3. Traceability guarantee (master §19)

For every important health value the platform can answer "where did this come from?" with one of exactly three answers: **(A)** Niro source (with ref), **(B)** trusted external source (org/title/URL/section/date), or **(C)** Needs Clarification. The dataset integrity test enforces 100% coverage of this rule.
