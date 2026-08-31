# NIRO RISK LOGIC — Primary Source Extraction (Risk Analysis folder)

> Extracted 2026-08-18 from `Risk Analysis/Comprehensive Wellness Score Framework_….pdf` (18 pages) and `Risk Analysis/Risk calculators.xlsx` (3 sheets). **These are LEVEL-1 Niro sources — they override all interim external bands previously configured.** Every value below is transcribed faithfully from the source; ambiguities are flagged, never resolved silently.

## ⚠ Governance finding — read first

The CWS Framework PDF ends with an embedded comment:

> **"COMMENT: This has been rejected because of no stratified ranges available for client"**

So the point-based CWS framework (which the context brief §4–8 summarizes) **exists in full detail but was rejected in this form** — the stated reason being the absence of stratified ranges for the client. The `Risk calculators.xlsx` contains the three current, active risk calculators ("the 3 profiles" from Audio 2 — clarification C10 RESOLVED: **Hypothyroid, Diabetes, Heart**). Implication for the platform: configure all four calculators; label CWS as "documented, pending stratified-range revision" until Niro confirms its status (new clarification N1).

---

## A. Comprehensive Wellness Score — full Niro point system (PDF §3–6)

Methodology (§2): points per parameter by deviation from optimal; aggregated per domain; weighted; demographic/lifestyle adjustments; **higher = worse**. Inspired by Framingham.

### A.1 Cardiovascular (25%)
| Parameter | Bands → points |
|---|---|
| Total Cholesterol (mg/dL) | <160→0 · 160–199→1 · 200–239→2 · 240–279→3 · ≥280→4 |
| HDL (mg/dL) | ≥60→**−2** · 50–59→**−1** · 40–49→0 · 30–39→1 · <30→2 |
| LDL (mg/dL) | <70→0 · 70–99→1 · 100–129→2 · 130–159→3 · ≥160→4 |
| Triglycerides (mg/dL) | <100→0 · 100–149→1 · 150–199→2 · 200–499→3 · ≥500→4 |
| Systolic BP (mmHg) | <120→0 · 120–129→1 · 130–139→2 · 140–159→3 · ≥160→4 |
| hsCRP (mg/L) | <1→0 · 1–3→1 · >3→2 |
| ApoB:ApoA Ratio | <0.5→0 · 0.5–0.69→1 · 0.7–0.89→2 · ≥0.9→3 |

### A.2 Metabolic (20%)
| Parameter | Bands → points |
|---|---|
| Fasting Glucose (mg/dL) | <100→0 · 100–125→2 · ≥126→4 |
| HbA1c (%) | <5.7→0 · 5.7–6.4→2 · ≥6.5→4 |
| Fasting Insulin (µIU/mL) | <10→0 · 10–15→1 · >15→2 |
| eAG (mg/dL) | <100→0 · 100–125→1 · 126–154→2 · ≥155→3 |

### A.3 Inflammatory (15%)
| Parameter | Bands → points |
|---|---|
| IL-6 (pg/mL) | <1.0→0 · 1.0–3.0→1 · >3.0→2 |
| CRP (mg/L) | <1→0 · 1–3→1 · 3–10→2 · >10→3 |
| ESR (mm/hr) | M <15 / F <20→0 · M 15–30 / F 20–35→1 · M >30 / F >35→2 |

### A.4 Nutritional (10%)
| Parameter | Bands → points |
|---|---|
| Vitamin D (ng/mL) | >30→0 · 20–30→1 · <20→2 |
| Vitamin B12 (pg/mL) | >400→0 · 300–400→1 · <300→2 |
| Folate (ng/mL) | >5.4→0 · 3.0–5.4→1 · <3.0→2 |
| Ferritin (ng/mL) | M 30–300 / F 30–200→0 · 15–29→1 · <15 or M >300 / F >200→2 |
| Magnesium (mg/dL) | 2.0–2.5→0 · 1.8–1.99→1 · <1.8→2 |
| Zinc (µg/dL) | 70–120→0 · 60–69→1 · <60→2 |

### A.5 Liver (10%)
| Parameter | Bands → points |
|---|---|
| ALT (U/L) | M <30 / F <19→0 · M 30–60 / F 19–40→1 · M >60 / F >40→2 |
| AST (U/L) | M <35 / F <25→0 · M 35–70 / F 25–50→1 · M >70 / F >50→2 |
| GGT (U/L) | M <30 / F <20→0 · M 30–60 / F 20–40→1 · M >60 / F >40→2 |
| Bilirubin Total (mg/dL) | 0.3–1.2→0 · 1.3–2.0→1 · >2.0 or <0.3→2 |
| Albumin (g/dL) | 3.6–5.0→0 · 3.0–3.5→1 · <3.0→2 |

### A.6 Kidney (5%)
| Parameter | Bands → points |
|---|---|
| eGFR (mL/min/1.73m²) | ≥90→0 · 60–89→1 · 45–59→2 · 30–44→3 · <30→4 |
| Creatinine (mg/dL) | M 0.6–1.2 / F 0.5–1.1→0 · M 1.3–1.5 / F 1.2–1.4→1 · M >1.5 / F >1.4→2 |
| BUN (mg/dL) | 7–20→0 · 21–30→1 · >30→2 |
| Uric Acid (mg/dL) | M 3.5–7.0 / F 2.5–6.0→0 · M 7.1–8.0 / F 6.1–7.0→1 · M >8.0 / F >7.0→2 |

### A.7 Thyroid (5%)
| Parameter | Bands → points |
|---|---|
| TSH (µIU/mL) | 0.4–4.0→0 · 0.1–0.39 or 4.1–10.0→1 · <0.1 or >10.0→2 |
| Free T4 (ng/dL) | 0.8–1.8→0 · 0.6–0.79 or 1.81–2.2→1 · <0.6 or >2.2→2 |
| Free T3 (pg/mL) | 2.3–4.2→0 · 1.8–2.2 or 4.3–5.0→1 · <1.8 or >5.0→2 |
| Anti-TPO (IU/mL) | <35→0 · 35–100→1 · >100→2 |

### A.8 Hematological (5%)
| Parameter | Bands → points |
|---|---|
| Hemoglobin (g/dL) | M 13.5–17.5 / F 12.0–15.5→0 · M 12.0–13.4 / F 11.0–11.9→1 · M <12.0 / F <11.0→2 |
| MCV (fL) | 80–100→0 · 70–79 or 101–110→1 · <70 or >110→2 |
| WBC (×10⁹/L) | 4.0–11.0→0 · 3.0–3.9 or 11.1–15.0→1 · <3.0 or >15.0→2 |
| Platelets (×10⁹/L) | 150–450→0 · 100–149 or 451–600→1 · <100 or >600→2 |

### A.9 Hormonal (5%)
| Parameter | Bands → points |
|---|---|
| Cortisol (µg/dL) | morning 5–25 / afternoon 3–15→0 · morning 3–4.9 or 25.1–30→1 · morning <3 or >30→2 (**time-of-day context confirmed**) |
| Testosterone (ng/dL) | M 300–1000 / F 15–70→0 · M 200–299 / F 71–100→1 · M <200 or >1000 / F <15 or >100→2 |
| Estradiol (pg/mL) | M 20–60 / premenopausal F 30–400→0 · M <20 or >60 / premenopausal F <30→1 · **2-point band listed "N/A"; postmenopausal women not covered → AMBIGUITY N4** |

### A.10 Adjustments (PDF §4)
| Factor | Bands → points |
|---|---|
| Age | <30→0 · 30–39→1 · 40–49→2 · 50–59→3 · ≥60→4 |
| Gender | already inside sex-specific parameter bands (no separate points) |
| BMI | 18.5–24.9→0 · 25.0–29.9→1 · 30.0–34.9→2 · 35.0–39.9→3 · ≥40 or <18.5→4 |
| Smoking | Never→0 · Former quit >5y→1 · Former quit <5y→2 · Current <10/day→3 · Current ≥10/day→4 |
| Physical activity | ≥150 min mod/wk→**−2** · 75–149→**−1** · <75→0 · Sedentary→2 |

### A.11 Formulas & categories (PDF §5–6) — confirms the brief exactly
Domain Score = Σ parameter points / max possible points × 100 · Raw = Σ(domain × weight) with 25/20/15/10/10/5/5/5/5 · Final = Raw + Σ adjustment points · Categories: <10 Optimal ("Maintain current healthy behaviors") · 10–20 Good ("Address specific areas of concern") · 21–30 Fair ("Focused lifestyle interventions") · 31–50 Suboptimal ("Comprehensive lifestyle modification") · >50 Poor ("Medical evaluation and intervention"). Per-band scientific citations are printed in the PDF (Stone 2014, Grundy 2019, Whelton 2018, ADA 2020, Ridker 2000/2008, Holick 2011, KDIGO 2013, WHO 2011, etc.).

---

## B. Hypothyroid Risk Calculator (XLSX sheet 1) — ACTIVE

Additive points: Age >35→5 · Female→10 · Family history of thyroid→10 · Symptoms (weight gain, fatigue, dry skin, hair loss / constipation or irregular periods)→5 (**merged-cell ambiguity: one 5-point cluster vs per-row — N5**) · History of autoimmune disease→10 · TSH >4.5→20 · Low free T4 or T3→10 · Thyroid antibodies positive→15.
**Categories:** 0–15 Low · 16–35 Medium · >35 High. Max = 85 (single-cluster reading).
References named in sheet: Indian Thyroid Society guidelines; ATA 2021; NHANES; Unnikrishnan 2011 (1 in 10 urban Indian adults; ~42M affected).

## C. Diabetes Risk Calculator (XLSX sheet 2) — ACTIVE (IDRS-based + glycemic escalation)

| Factor | Criteria → points | Missing logic (Niro-defined) |
|---|---|---|
| Age | ≤35→0 · 35–49→20 · 50+→30 | **Mandatory** |
| Waist | M >90 cm→10 · F >80 cm→10 | impute 10 if glycemic index ≥10 |
| Physical activity | Sedentary→30 · Moderate→3 · Regular→0 | default 3 |
| Family history | None→0 · One parent→10 · Both→20 | default 0 |
| HbA1c | <5.7→0 · 5.7–6.4→10 · >6.5→20 | ─ |
| PP Sugar | Normal→0 · Borderline→10 · High→20 | ─ |
| Fasting blood sugar | <100→0 · 100–125→10 · >126→20 | ─ |

**Glycemic index = max(HbA1c score, FBS score, PP score)** — only the maximum counts ("Take only maximum of Hba1c, FBS, PP").
**Categories (IDRS range):** <40 Low · 40–70 Moderate · >70 High — **with escalation: glycemic index 10 ⇒ at least Moderate; glycemic index 20 ⇒ High** (per the range explanations).

## D. Heart Risk Calculator (XLSX sheet 3) — ACTIVE ("Modified Cardiovascular Risk Engine")

Self-description: "incorporates Atherogenic Dyslipidemia (Triglycerides & Non-HDL) and handles Missing Data Imputation & Penalty Logic."

**D.1 Modified Framingham base points** (one combined table; no sex split shown — **N6**):
- Age: 30–34→0 · 35–39→2 · 40–44→4 · 45–49→5 · 50–54→7 · 55–59→8 · 60–64→9 · 65–69→10 · 70–74→11 · 75+→12
- HDL: 60+→−2 · 50–59→−1 · 45–49→0 · 35–44→1 · <35→2
- Total Cholesterol: <160→0 · 160–199→1 · 200–239→3 · 240–279→4 · 280+→5
- SBP not treated: <120→−3 · 120–129→0 · 130–139→1 · 140–149→2 · 150–159→4 · 160+→5
- SBP treated: <120→−1 · 120–129→2 · 130–139→3 · 140–149→5 · 150–159→6 · 160+→7
- **SBP missing (imputation): age <40→0 · 40–50→1 · 50+→2**
- Smoker: No→0 · Yes→3
- Diabetic (modified): normal HbA1c & fasting glucose→0 · borderline→1 · high→4
- Triglycerides (addition to classic Framingham): <150→0 · 151–200→1 · 201–500→2 · >500→4

**D.2 Points → 10-year risk %:** ≤−2→<1 · −1→1.0 · 0→1.2 · 1→1.5 · 2→1.7 · 3→2.0 · 4→2.4 · 5→2.8 · 6→3.3 · 7→3.9 · 8→4.5 · 9→5.3 · 10→6.3 · 11→7.3 · 12→8.6 · 13→10.0 · 14→11.7 · 15→13.7 · 16→15.9 · 17→18.5 · 18→21.5 · 19→24.8 · 20→28.5 · 21+→>30.
Worked example in sheet: Age 58 (8) + HDL 38 (1) + TC 168 (1) + SBP NT 124 (0) + Smoker Yes (3) + Diabetic No (0) = **13 points → 10% risk** ✓.

**D.3 Young-age correction:** S_lipid = 0.6×(LDL/100) + 0.4×(TC/160) · M_young = 2.5 (age <30) / 1.8 (30–39) / 1 (≥40) · **Adjusted risk % = base risk × S_lipid × M_young**.

**D.4 Isolated high-cholesterol floor penalty** (only TC/LDL high, nothing else flagged → minimum risk floor):
LDL <130→0 ("Your lipid levels are within optimal range.") · 130–159→12–15% "Mild Attention" ("Slightly elevated. Responsive to diet and exercise.") (**exact value within 12–15% unspecified — N7**) · 160–189→25% "Suboptimal" ("Elevated LDL. Early lifestyle focus prevents future risk.") · >190→40% "Action Needed" ("Significant elevation. Requires clinical evaluation.") · TC 240→30% "Suboptimal" ("Significant elevation. Requires clinical evaluation."). **"Show both patient messaging in case of floor penalty rule."**

**D.5 Final:** **Final heart risk = max(Adjusted heart risk, floor penalty)**.
**Categories:** <10% Low ("Your immediate likelihood of a heart event over the next 10 years is extremely low.") · 10–19% Intermediate ("…slightly elevated compared to optimal ranges…highly manageable…") · >20% High ("…needs attention. Taking proactive steps now…").
**Unit note in sheet:** mmol/L → mg/dL divide by 0.0259 (1 mmol/L = 38.61 mg/dL).
**Reference mapping in sheet:** Young-Age Multiplier → Braunwald's Ch.47 + 2018 AHA/ACC · Vascular Age → 2021 ESC + D'Agostino 2008 · Floor Penalty (LDL ≥160) → Harrison's Ch.400. (Sheet mentions "Vascular Age Calculation" in references though no vascular-age table appears — **N8**.)

---

## New/updated clarification register (Niro-facing)

| ID | Item |
|---|---|
| **N1** | CWS framework is marked **rejected** ("no stratified ranges available for client"). Is CWS to be built as documented, revised with stratified ranges, or is the public launch limited to the 3 risk calculators? |
| **N2** | CWS symptom/estradiol/cortisol context intake: confirm morning/afternoon cortisol input flow |
| **N3** | Diabetes: PP Sugar "Normal/Borderline/High" numeric cutoffs not stated in sheet (FBS & HbA1c have numbers) |
| **N4** | CWS estradiol: 2-point band "N/A"; postmenopausal women not covered |
| **N5** | Hypothyroid symptoms cluster: 5 points for the merged two-line symptom group, or per line? |
| **N6** | Heart: single Framingham table (matches men's D'Agostino coefficients) — apply unisex, or add women's table? |
| **N7** | Heart floor penalty for LDL 130–159 says "12% – 15%" — which exact floor value? |
| **N8** | "Vascular Age Calculation" cited in heart references but no table/formula in sheet — in scope? |
| ~~C1–C6, C9, C10~~ | **RESOLVED** by these two files (points, adjustments, max-points, categories+messaging, missing-value logic, eAG separate scoring confirmed, 3 profiles identified) |
| C7 (partial) | Required/optional now explicit for Diabetes (Age mandatory; defaults for others). CWS & others: partial scoring remains the norm (Audio 2) — exclude-from-max stands unless Niro states otherwise |
