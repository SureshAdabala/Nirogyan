# Detailed Biomarker Reference

> Deliverable 6. The human-readable companion to [05-biomarker-dataset.md](05-biomarker-dataset.md) and [config-samples/biomarker-dataset.json](config-samples/biomarker-dataset.json). One entry per biomarker: what it is, what it measures, why it matters, units and conversions, externally verified reference anchors with named sources, demographic rules, recorded conflicts, and its role in the Niro CWS. Full verbatim source notes live in [research/](research/) (4 domain research files, all values verified against fetched authoritative pages on 2026-08-18).
>
> **Standing rule:** Niro's own scoring thresholds/points for every biomarker below are pending the Niro Risk Logic Sheet (**Needs Clarification**). External ranges here are interpretation references for biomarker pages and generic interpretation — they never substitute for Niro scoring.

---

## Cardiovascular domain (Niro weight 25%)

### Total Cholesterol (TC)
Total cholesterol across LDL, HDL and other lipoprotein fractions. Elevated TC drives plaque formation (atherosclerosis) and with it coronary artery disease, heart attack and stroke risk. **Unit** mg/dL (mmol/L × 38.67). **External anchors** — healthy adult <200; Desirable <200 / Borderline high 200–239 / High ≥240 (NCEP ATP III tiers still published via MedlinePlus & Cleveland Clinic). Not sex-specific. **Niro role:** CV parameter; points NC.

### HDL Cholesterol (HDL-C)
"Good cholesterol" — carries cholesterol back to the liver. Higher is protective; low HDL is an independent CV risk factor. **Unit** mg/dL. **External anchors (sex-specific)** — Low: <40 (men) / <50 (women); ≥60 best for both (MedlinePlus). **Recorded conflict:** StatPearls uses <55 for women. **Niro role:** CV parameter with documented gender-specific interpretation; points NC.

### LDL Cholesterol (LDL-C)
"Bad cholesterol" — the primary atherogenic particle; lower is better. **Unit** mg/dL. **External anchors** — Optimal <100 / Near-optimal 100–129 / Borderline 130–159 / High 160–189 / Very high ≥190 (verified verbatim, MedlinePlus). Treatment-context: ASCVD goal <70 (StatPearls). **Niro role:** CV parameter; points NC.

### Triglycerides (TG)
Most common blood fat; measured fasting (9–12 h). High TG raises CAD risk; >1000 mg/dL risks pancreatitis. **Unit** mg/dL. **External anchors** — Normal <150 / Borderline 150–199 / High 200–499 / Very high ≥500 (MedlinePlus). **Niro role:** CV parameter; points NC.

### Systolic Blood Pressure (SBP)
Arterial pressure at heart contraction; leading modifiable risk factor for MI, stroke, heart failure and CKD. **Unit** mmHg. **External anchors (ACC/AHA 2017, retained by the 2025 guideline)** — Normal <120 / Elevated 120–129 / Stage 1 130–139 / Stage 2 ≥140 / Crisis >180. Note: full classification pairs with diastolic; the Niro brief lists systolic only. **Niro role:** CV parameter; points NC.

### hs-CRP
High-sensitivity CRP — detects low-grade vascular inflammation that predicts atherosclerotic events. **Unit** mg/L (⚠ standard CRP is often mg/dL; 1 mg/dL = 10 mg/L — a real unit-confusion hazard the platform's unit table must guard). **External anchors (AHA/CDC 2003 cutpoints)** — CV risk low <1 / average 1–3 / high >3 mg/L. **Niro role:** CV parameter (distinct from the Inflammatory-domain CRP); points NC.

### ApoB:ApoA-I Ratio
Balance of atherogenic particles (one ApoB per LDL/VLDL/IDL) vs anti-atherogenic capacity (ApoA-I on HDL); unitless. Higher ratio predicted MACE up to ~20 years ahead in the AMORIS cohort (n=137,100). **External anchors** — **no US guideline categories exist**; research-derived AMORIS bands: low 0.2–0.6 / medium 0.61–0.9 / high 0.91–5.0 (PLOS Medicine 2021, fetch-verified). UI must label these "research-derived". **Niro role:** CV parameter; if the Niro sheet defines its own bands they take precedence; points NC.

---

## Metabolic domain (20%)

### Fasting Glucose (FPG)
Blood glucose after ≥8 h fast; an ADA diagnostic test. **Unit** mg/dL (126 = 7.0 mmol/L). **External anchors (ADA, verified on diabetes.org)** — Normal <100 / Prediabetes 100–125 / Diabetes ≥126. **Niro role:** Metabolic parameter; points NC.

### HbA1c
Percent glycated hemoglobin ≈ 3-month average glucose; diagnosis + control standard. **Unit** % (NGSP). **External anchors (ADA + NIDDK, identical)** — Normal <5.7 / Prediabetes 5.7–6.4 / Diabetes ≥6.5. **Niro role:** Metabolic parameter; also feeds the derived eAG; points NC.

### Fasting Insulin
Serum insulin after 8–12 h fast; insulin-resistance context (HOMA-IR input). **Unit** µIU/mL (= mIU/L). **External anchors — Needs Clarification:** MedlinePlus publishes *no* reference range; assays are not standardized; URMC lists free insulin "<17 µIU/mL" with lab-variation caveat. The platform should display "lab-specific range" and let Niro's sheet (or the user's lab interval) define scorable bands. **Niro role:** Metabolic parameter; points NC.

### Estimated Average Glucose (eAG)
**Derived, not measured**: eAG(mg/dL) = **28.7 × A1C − 46.7** (ADA, verified verbatim; ADAG study). Anchors: 6%→126, 7%→154, 8%→183, 9%→212, 10%→240. No independent categories — interpret via HbA1c. **Platform note:** implemented as a derived parameter with `dependsOn: [hba1c]`. **Open question (C6):** whether Niro scores eAG separately (would double-count HbA1c) or shows it as context — sheet must confirm.

---

## Inflammatory domain (15%)

### IL-6 (Interleukin-6)
Pro-inflammatory cytokine driving the acute-phase response (it induces CRP); rises early in infection/sepsis; elevated in inflammatory disease and severe COVID-19. **Unit** pg/mL. **External anchors — Needs Clarification (assay-dependent):** ARUP ≤2.0 pg/mL (verified); Mayo <6.4 pg/mL (403-blocked, unverified); healthy-donor meta-analysis pooled mean 5.19 pg/mL (95% CI 4.6–5.7) with values 0–43.5 and +0.05 pg/mL/year of age. No guideline categories exist. **Niro role:** Inflammatory parameter; scorable bands must come from the Niro sheet or the user's lab interval.

### CRP (standard)
Hepatic acute-phase protein — general, nonspecific inflammation marker for infection and inflammatory disease (RA, lupus, IBD). **Unit** mg/L (and mg/dL in the wild — conversion ×10 in the unit table). **External anchors** — most healthy adults <3 mg/L (<0.3 mg/dL); StatPearls interpretation: 3–10 minor / 10–100 moderate / >100 marked / >500 severe (converted to mg/L). Keep the hs-CRP CV bands (<1/1–3/>3) conceptually separate. **Niro role:** Inflammatory parameter; points NC.

### ESR (Westergren)
How far RBCs settle in one hour — indirect inflammation marker; "an abnormal ESR alone does not establish a diagnosis" (StatPearls). **Unit** mm/hr. **External anchors (sex- and age-specific, MedlinePlus + StatPearls agree)** — normal: M<50y <15 · M>50y <20 · F<50y <20 · F>50y <30. The Miller rule (M: age/2; F: (age+10)/2) is a 1983 BMJ rule-of-thumb — usable if labeled as such, not as guideline. >100 mm/hr flags serious disease. **Niro role:** Inflammatory parameter with sex+age contexts; points NC.

---

## Nutritional domain (10%)

### Vitamin D (25-hydroxyvitamin D)
The accepted vitamin D status indicator (~15-day half-life). Deficiency impairs calcium absorption → rickets/osteomalacia. **Unit** ng/mL (×2.5 = nmol/L; conversion verified from ODS). **External anchors (NIH ODS/FNB Table 1, verified exact)** — Deficiency <12 / Inadequacy 12–<20 / Adequate ≥20 / Potential adverse >50 ng/mL. **Major recorded conflict:** Endocrine Society 2011 used <20 deficient, 21–29 insufficient, ≥30 sufficient — and the **2024 ES guideline withdrew numeric thresholds entirely** and suggests against routine testing. Platform displays the ODS framework by default and labels any ES-2011 numbers as superseded. **Niro role:** Nutritional parameter; points NC.

### Vitamin B12 (Cobalamin)
Cofactor for DNA synthesis, RBC formation, neurological function; deficiency → megaloblastic anemia + potentially irreversible neuropathy. **Unit** pg/mL (200 pg/mL = 148 pmol/L). **External anchors (conflict recorded)** — ODS: labs define subnormal <200–250 pg/mL; gray zone 150–399 → confirm with MMA (>0.271 µmol/L suggests deficiency). MedlinePlus: normal 299–1054. **Niro role:** Nutritional parameter; points NC.

### Folate (serum)
Reflects recent intake (RBC folate = long-term). Deficiency → megaloblastic anemia, ↑homocysteine; low folate in reproductive-age women raises NTD risk. **Unit** ng/mL (×2.265 = nmol/L, WHO factor). **External anchors (all recorded)** — WHO hematologic: deficient <3 / possible 3–5.9 / normal 6–20 / elevated >20; WHO metabolic: deficient <4; ODS adequacy >3; MedlinePlus 2.7–17.0. **Niro role:** Nutritional parameter; points NC.

### Ferritin
Main iron-storage protein — the most efficient single test for iron deficiency (falls before anemia); acute-phase caveat (inflammation raises it). **Unit** ng/mL = µg/L. **External anchors** — WHO 2020 (verified from PDF): deficiency <15 µg/L healthy adults (<70 with inflammation; <12 under-5s); overload risk >150 (menstruating women) / >200 (men, non-menstruating). MedlinePlus reference: M 30–400 / F 13–150. ODS clinical: <30 suggests deficiency, <10 IDA. **Conflict** (WHO 15 vs ODS 30) recorded, both shown. **Niro role:** Nutritional parameter, sex-specific; points NC.

### Magnesium (serum)
Cofactor in 300+ enzyme systems; serum holds <1% of body stores, so ODS cautions it's an imperfect status marker. **Unit** mg/dL (1 mmol/L ≈ 2.43 mg/dL). **External anchors (conflict recorded)** — ODS 0.75–0.95 mmol/L (hypomagnesemia <0.75); MedlinePlus 1.7–2.2 mg/dL (0.70–0.91 mmol/L). **Niro role:** Nutritional parameter; points NC.

### Zinc (serum)
Most common zinc-status proxy; required for immunity, wound healing, growth. Varies with time of day and inflammation. **Unit** µg/dL. **External anchors (single-source: NIH ODS)** — healthy 80–120 µg/dL; inadequate <70 (F) / <74 (M). No WHO/MedlinePlus cross-check exists — flagged single-source. **Niro role:** Nutritional parameter, sex-specific inadequacy; points NC.

---

## Liver domain (10%)

### ALT (SGPT)
Most liver-specific aminotransferase; released on hepatocyte injury; associated with liver-related mortality (ACG). **Unit** U/L. **External anchors** — typical lab 4–36; **ACG 2017 true-normal ULN (verified verbatim from the guideline PDF): M 29–33 / F 19–25 IU/L**, "levels above this should be assessed". ACG elevation grades: borderline <2× / mild 2–5× / moderate 5–15× / severe >15× ULN. **Niro role:** Liver parameter (ACG sex-specific position recorded); points NC.

### AST (SGOT)
Aminotransferase in liver + heart/muscle/kidney/brain/RBC — less liver-specific; AST>ALT with alcohol history suggests alcohol-related disease. **Unit** U/L. **External anchors (conflict)** — MedlinePlus 8–33 vs StatPearls 5–30. No guideline sex-specific AST ULN. **Niro role:** Liver parameter; points NC.

### GGT
Liver/biliary membrane enzyme; rises with cholestasis, alcohol, drugs. ACG: confirms hepatic origin of high ALP; not a standalone screen. **Unit** U/L. **External anchors (conflicts recorded)** — UMich (verified, sex-specific): F 8–35 / M 8–50; MedlinePlus 5–40 unisex; StatPearls 6–50; Mayo M 8–61 unverified. **Niro role:** Liver parameter, sex-specific; points NC.

### Total Bilirubin
Heme-breakdown pigment (conjugated + unconjugated); elevations = hemolysis, hepatocellular disease, or biliary obstruction; jaundice apparent >3 mg/dL. **Unit** mg/dL (×17.1 = µmol/L). **External anchors** — MedlinePlus 0.1–1.2 (direct <0.3); StatPearls ≈0.12–1.0 (conflict recorded). **Niro role:** Liver parameter; points NC.

### Albumin (serum)
Most abundant plasma protein; hepatic synthetic function + nutrition/inflammation marker; low in chronic liver disease, renal protein loss, malnutrition. **Unit** g/dL (×10 = g/L). **External anchors (conflict recorded)** — MedlinePlus 3.4–5.4 vs StatPearls 3.5–5.0. No official severity grading exists (NC if Niro wants bands). **Niro role:** Liver parameter; points NC.

---

## Kidney domain (5%)

### eGFR
Estimated filtration rate (CKD-EPI from creatinine ± cystatin C + age/sex) — the primary CKD detection/staging marker; <60 sustained ≥3 months defines CKD. **Unit** mL/min/1.73 m². **External anchors (KDIGO via NKF, verified)** — G1 ≥90 / G2 60–89 / G3a 45–59 / G3b 30–44 / G4 15–29 / G5 <15 (G1–G2 are CKD only with damage markers). **Niro role:** Kidney parameter; points NC.

### Serum Creatinine
Muscle-metabolism waste cleared by kidneys; the eGFR input; women run lower (muscle mass). **Unit** mg/dL (×88.4 = µmol/L). **External anchors (conflicts recorded)** — MedlinePlus M 0.7–1.3 / F 0.5–0.95; StatPearls M 0.6–1.2 / F 0.5–1.1. **Niro role:** Kidney parameter, sex-specific; points NC.

### BUN
Urea nitrogen from protein breakdown; rises with renal impairment, dehydration, catabolism; read with creatinine. **Unit** mg/dL. **External anchors (conflict recorded)** — MedlinePlus 6–20 vs Clinical Methods 5–20. **Niro role:** Kidney parameter; points NC.

### Uric Acid
Purine metabolism end-product; hyperuricemia underlies gout/urate stones. **Unit** mg/dL (6.8 ≈ 400 µmol/L). **External anchors** — MedlinePlus reference F 3.0–7.1 / M 4.0–8.6; clinical hyperuricemia >6 (F) / >7 (M); solubility threshold 6.8 (sex-independent); gout risk ↑ ≥8. Reference interval vs clinical threshold distinction recorded. **Niro role:** Kidney parameter, sex-specific; points NC.

---

## Thyroid domain (5%)

### TSH
Pituitary thyrotropin — the most sensitive first-line thyroid index; high = hypothyroid, low = hyperthyroid. **Unit** mIU/L (= µU/mL). **External anchors (upper-limit conflict recorded: 4.0 / 4.5 / 4.8)** — ATA 2014 therapeutic target 0.4–4.0 (PMC-verified); StatPearls/USPSTF 0.4(5)–4.5; MedlinePlus 0.4–4.8. Subclinical hypothyroidism treatment threshold: TSH >10. TSH runs higher >80 y. **Niro role:** Thyroid parameter; points NC.

### Free T4
Unbound (bioavailable) thyroxine; with TSH separates overt from subclinical dysfunction. **Unit** ng/dL (×12.87 = pmol/L). **External anchors (conflict recorded)** — MedlinePlus 0.8–1.9 vs Cleveland Clinic 0.9–1.7. **Niro role:** Thyroid parameter; points NC.

### Free T3
Unbound triiodothyronine — most metabolically active thyroid hormone; hyperthyroidism workup. **Unit** pg/mL (MedlinePlus's 210–440 pg/dL = 2.1–4.4 pg/mL). **External anchors (conflict recorded)** — 2.1–4.4 vs Cleveland Clinic 2.3–4.1. **Niro role:** Thyroid parameter; points NC.

### Anti-TPO
IgG autoantibodies against thyroid peroxidase — Hashimoto marker; positivity predicts future hypothyroidism. **Unit** IU/mL. **External anchors — Needs Clarification (strongly assay-dependent):** Cleveland Clinic <5.6 negative (verified); Mayo <9.0 (unverified, 403); MedlinePlus/UCSF: negative-vs-positive per performing lab; commercial cutoffs span ~5.6–34. The platform records the cutoff as lab-supplied. **Niro role:** Thyroid parameter; scorable bands need the Niro sheet or lab interval.

---

## Hematological domain (5%)

### Hemoglobin
Oxygen-carrying protein; defines anemia. **Unit** g/dL (×10 = g/L). **External anchors** — WHO 2024 (verified from guideline PDF): anemia M <13 / non-pregnant F <12 g/dL, with severity mild/moderate/severe (110–129|110–119, 80–109, <80 g/L); MedlinePlus reference M 13.8–17.2 / F 12.1–15.1. **Niro role:** Hematological parameter with documented gender-specific interpretation; points NC.

### MCV
Average RBC volume — classifies anemia (microcytic <80 / normocytic 80–100 / macrocytic >100 fL, StatPearls standard; MedlinePlus 79–95 recorded). **Niro role:** Hematological parameter; points NC.

### WBC
Total leukocytes; high = infection/inflammation/malignancy signal; low = marrow suppression/infection risk. **Unit** ×10⁹/L. **External anchors (agreement)** — normal 4.5–11.0; leukopenia <4.5; leukocytosis >11.0. **Niro role:** Hematological parameter; points NC.

### Platelets
Clot-forming cell fragments. **Unit** ×10⁹/L. **External anchors (upper-limit conflict recorded)** — normal 150–450 (StatPearls; MedlinePlus caps 400); thrombocytopenia <150 (mild 100–150 / moderate 50–100 / severe <50; spontaneous bleeding <20). **Niro role:** Hematological parameter; points NC.

---

## Hormonal domain (5%)

### Cortisol (morning serum)
Adrenal glucocorticoid with strong diurnal rhythm (peak early a.m., nadir ~midnight) — **draw time is a required context input**. **Unit** µg/dL (×27.6 ≈ nmol/L). **External anchors (conflict recorded)** — MedlinePlus 8 a.m. 5–25 vs Cleveland Clinic 6–8 a.m. 10–20 (afternoon 3–10). Single random values don't diagnose Cushing/adrenal insufficiency (dynamic testing needed). **Niro role:** Hormonal parameter — the brief's "context-specific handling for hormonal measurements" applies; points NC.

### Testosterone (total)
Both sexes produce it; low in men → hypogonadism; elevated in women → PCOS workup. **Unit** ng/dL (×0.0347 = nmol/L). **External anchors (sex+age-specific; conflict recorded)** — MedlinePlus: M 17–50y 249–836 / M >50y 193–740 / F 17–50y 8.4–48.1 / F >50y 2.9–40.1; Endocrine Society harmonized (non-obese men 19–39): 264–916; low-T threshold AUA <300 (verified) vs ES 264. **Niro role:** Hormonal parameter, gender-specific; points NC.

### Estradiol (E2)
Most potent estrogen; dominant in female reproductive years; men produce small amounts. **Unit** pg/mL (×3.67 = pmol/L). **External anchors (context-dependent)** — MedlinePlus: males 10–50; premenopausal F 30–400 (cycle-varying); postmenopausal F 0–30. **Menstrual-phase-specific tables: Needs Clarification** (no fetchable authoritative universal table; Mayo blocked). Context inputs: sex + menopausal status (+ phase if the lab reports it). **Niro role:** Hormonal parameter, context-specific per brief §6; points NC.

---

## Demographic & lifestyle factors (Niro adjustment layer)

| Factor | Externally verified definition | Niro use |
|---|---|---|
| **Age** | — | Adjustment factor (points NC) + context for age-specific biomarker rules |
| **Sex** | — | Context driver for all sex-specific interpretation |
| **BMI** | WHO/CDC/NIH: underweight <18.5 / healthy 18.5–24.9 / overweight 25–29.9 / obesity ≥30 (CDC classes 1–3 at 35/40) — verified | Adjustment factor (points NC); derived from height + weight |
| **Smoking** | CDC NHIS (verified verbatim): current = ≥100 lifetime cigarettes + smokes now; former = ≥100 + quit; never = <100 | Adjustment factor (points NC) |
| **Physical activity** | WHO 2020 (verified verbatim): 150–300 min moderate or 75–150 min vigorous aerobic weekly + strength ≥2 days; insufficiently active <150 min | Adjustment factor (points + option granularity NC) |
