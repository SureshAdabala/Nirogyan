# External Medical Research — Inflammatory + Liver Domains
> Research pass: 2026-08-18. Values verified against fetched authoritative pages (MedlinePlus, StatPearls/NCBI, ACG guideline summary PDF, ARUP, UMich MLabs, Cleveland Clinic secondary). Explicit verification caveats retained.

## INFLAMMATORY DOMAIN

### 1. IL-6 (Interleukin-6)
- **Measures:** pro-inflammatory cytokine driving acute-phase response (induces CRP).
- **Why it matters:** rises early in infection/sepsis/systemic inflammation; elevated in inflammatory disease, severe COVID-19.
- **Units:** pg/mL (SI ng/L identical).
- **STATUS: Needs Clarification — assay/lab-dependent; no universal range.** Authoritative examples (disagree, all listed):
  - ARUP Laboratories test 0051537 (verified): **≤2.0 pg/mL**
  - Mayo Clinic Labs IL6DX: **<6.4 pg/mL** (catalog page 403 — NOT fetch-verified; re-verify before publication)
  - Meta-analysis Said 2021 (57 studies, n=3,166 healthy): healthy range 0–43.5, pooled mean 5.186 pg/mL (95% CI 4.631–5.740); +0.05 pg/mL per year of age.
- **No guideline categories exist.**
- **Sources:** ARUP — https://ltd.aruplab.com/Tests/Pub/0051537 ; Said et al. J Med Virol 2021, doi:10.1002/jmv.26654 — https://pubmed.ncbi.nlm.nih.gov/33155686/ ; StatPearls "Interleukin" NBK499840 (function only).

### 2. CRP (standard assay)
- **Measures:** hepatic acute-phase protein (IL-6-driven); nonspecific inflammation marker.
- **Why it matters:** detect/monitor infection and inflammatory disease (RA, lupus, IBD).
- **Units:** mg/dL and mg/L both in use (0.3 mg/dL = 3 mg/L) — unit-confusion hazard; no standardized reporting (StatPearls).
- **Reference (verified, MedlinePlus + StatPearls agree):** healthy adults mostly **<0.3 mg/dL** (<3 mg/L).
- **Interpretation bands (StatPearls, mg/dL):** <0.3 normal · 0.3–1.0 normal/minor elevation · 1.0–10.0 moderate elevation (systemic inflammation) · >10 marked (acute bacterial) · >50 severe.
- **hs-CRP CV bands (separate concept):** <1 / 1–3 / >3 mg/L (CDC/AHA).
- **Sources:** MedlinePlus "C-reactive protein" — https://medlineplus.gov/ency/article/003356.htm ; StatPearls NBK441843 — https://www.ncbi.nlm.nih.gov/books/NBK441843/ ; provenance Pearson 2003 Circulation (403).

### 3. ESR (Westergren)
- **Measures:** RBC settling distance in 1h; indirect inflammation marker.
- **Why it matters:** detect/monitor PMR, temporal arteritis, RA, lupus, osteomyelitis, endocarditis. "Abnormal ESR alone does not establish a diagnosis" (StatPearls).
- **Units:** mm/hr.
- **Reference (verified, MedlinePlus + StatPearls agree on adults; sex+age-specific):**
  - Men <50y: <15 · Men >50y: <20
  - Women <50y: <20 · Women >50y: <30 mm/hr
  - Children: MedlinePlus 3–13 vs StatPearls ≤10 — **CONFLICT recorded**.
- **Age-adjustment "Miller rule" (M: age/2; F: (age+10)/2):** citation verified (Miller, BMJ 1983;286:266, PMC1546487) but original is a scan — formula wording is secondary. Label as "rule of thumb (Miller 1983)", not guideline.
- **Other:** ESR >100 mm/hr ≈ serious disease (infection, malignancy, temporal arteritis).
- **Sources:** MedlinePlus "ESR" — https://medlineplus.gov/ency/article/003638.htm ; StatPearls NBK557485 (upd. 2025-07-07) — https://www.ncbi.nlm.nih.gov/books/NBK557485/ ; Miller 1983 — https://pmc.ncbi.nlm.nih.gov/articles/PMC1546487/

## LIVER DOMAIN

### 4. ALT (SGPT)
- **Measures:** hepatocyte enzyme; most liver-specific aminotransferase.
- **Why it matters:** primary hepatocellular-injury screen; elevated ALT associated with liver-related mortality (ACG).
- **Units:** U/L (SI µkat/L).
- **Two authoritative positions (BOTH listed):**
  - Typical lab range (MedlinePlus/StatPearls): **4–36 U/L**, not sex-specific.
  - **ACG 2017 guideline true-normal ULN (verified verbatim from ACG summary PDF): M 29–33 · F 19–25 IU/L** — "levels above this should be assessed by physicians."
- **Elevation magnitude (ACG 2017, ALT and/or AST):** borderline <2× ULN · mild 2–5× · moderate 5–15× · severe >15× · massive >10,000 IU/L. R-ratio: (ALT/ULN)÷(ALP/ULN): >5 hepatocellular, <2 cholestatic, 2–5 mixed.
- **Sources:** MedlinePlus — https://medlineplus.gov/ency/article/003473.htm ; ACG guideline summary PDF (verified) — https://acgcdn.gi.org/wp-content/uploads/2018/04/ACG-Abnormal-Liver-Chemistries-Guideline-Summary.pdf ; guideline page — https://gi.org/guideline/evaluation-of-abnormal-liver-chemistries/ ; StatPearls "Liver Function Tests" NBK482489.

### 5. AST (SGOT)
- **Measures:** enzyme in liver + heart/muscle/kidney/brain/RBC; less liver-specific.
- **Why it matters:** interpreted with ALT; AST>ALT + alcohol history suggests alcoholic liver disease (ACG risk: F >140 g/wk, M >210 g/wk).
- **Units:** U/L.
- **Reference (CONFLICT recorded):** MedlinePlus **8–33 U/L** vs StatPearls **5–30 IU/L**. No guideline sex-specific AST ULN (ACG sex-specific values are ALT-only).
- **Categories:** ACG elevation magnitudes as ALT.
- **Sources:** MedlinePlus — https://medlineplus.gov/ency/article/003472.htm ; StatPearls NBK482489; ACG summary PDF.

### 6. GGT
- **Measures:** membrane enzyme of liver/biliary epithelium; rises with cholestasis, alcohol, drugs.
- **Why it matters:** confirms hepatic origin of elevated ALP; ACG: "should not be used as a screening test... in the absence of other abnormal liver chemistries."
- **Units:** U/L.
- **Reference (CONFLICTS recorded, all listed):**
  - MedlinePlus: **5–40 U/L** (not sex-specific)
  - StatPearls: 6–50 IU/L
  - UMich MLabs (verified, sex-specific): **F 8–35 · M 8–50 U/L**
  - Cleveland Clinic: "often below 50", higher in males, varies with age
  - Mayo (M 8–61) — 403, NOT verified.
- **No guideline elevation bands.**
- **Sources:** MedlinePlus — https://medlineplus.gov/ency/article/003458.htm ; UMich MLabs — https://mlabs.umich.edu/tests/g-glutamyl-transpeptidase ; Cleveland Clinic — https://my.clevelandclinic.org/health/diagnostics/22055-gamma-glutamyl-transferase-ggt-test ; ACG summary PDF (Rec. 13); StatPearls NBK482489.

### 7. Total Bilirubin
- **Measures:** heme-breakdown pigment; total = conjugated + unconjugated.
- **Why it matters:** elevations = hemolysis, hepatocellular disease, or biliary obstruction; ACG: fractionate elevated totals.
- **Units:** mg/dL (SI µmol/L ×17.1).
- **Reference (slight CONFLICT recorded):** MedlinePlus total **0.1–1.2 mg/dL** (direct <0.3); StatPearls 2–17 µmol/L (≈0.12–1.0 mg/dL); StatPearls Hyperbilirubinemia "<1 mg/dL".
- **Thresholds:** jaundice/scleral icterus apparent **>3 mg/dL** (StatPearls). ACG: isolated hyperbilirubinemia = elevated bilirubin with normal ALP + AST/ALT.
- **Sources:** MedlinePlus — https://medlineplus.gov/ency/article/003479.htm ; StatPearls NBK544252 (upd. 2023-08-08); NBK482489; ACG summary PDF.

### 8. Albumin (serum)
- **Measures:** most abundant plasma protein (hepatic synthesis); oncotic pressure + transport.
- **Why it matters:** hepatic synthetic function + nutrition/inflammation marker; low in chronic liver disease, kidney protein loss, malnutrition.
- **Units:** g/dL (SI g/L ×10).
- **Reference (slight CONFLICT recorded):** MedlinePlus **3.4–5.4 g/dL** vs StatPearls **3.5–5.0 g/dL**. Not sex-specific.
- **Severity bands: Needs Clarification** — no official graded cutoffs found (only analbuminemia <1 g/L).
- **Sources:** MedlinePlus — https://medlineplus.gov/ency/article/003480.htm ; StatPearls "Hypoalbuminemia" NBK526080 (upd. 2023-08-28); NBK482489.

## Cross-cutting verification notes
- Mayo values (IL-6 <6.4; GGT M 8–61) NOT fetch-verified (403) — re-verify before publication.
- Miller ESR formula: citation verified, wording secondary.
- hs-CRP cutpoints verified via 3 allowed sources.
- Key recorded conflicts: ALT 4–36 vs ACG 29–33/19–25 · AST 8–33 vs 5–30 · GGT 5–40 vs 6–50 vs 8–50/8–35 · pediatric ESR 3–13 vs ≤10 · albumin 3.4–5.4 vs 3.5–5.0.
- All ranges carry "varies by laboratory" caveats from their sources.
