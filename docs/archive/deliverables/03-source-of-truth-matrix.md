# Source-of-Truth Matrix

> Deliverable 3. Which source governs which fact class, and the precedence rule applied on conflict.

## Precedence (fixed)

**Niro original sources → authoritative external medical sources → Needs Clarification.** The context TXT is reference-only: where it consolidates Niro material it is used as the best available representation of Niro rules, explicitly marked for re-verification against the primary Sheet/Doc when provided. Nothing is filled from general knowledge.

## Matrix

| Fact class | Governing source | Status in this package |
|---|---|---|
| Product intent: SEO calculator hub, lead magnet for traffic, independent of NirogGyan core code (for assignment) | **Audio 2 + Audio 3** (primary) | Extracted from transcripts; quotes in [02-source-analysis.md](02-source-analysis.md) |
| Assignment context: full-stack test close to real work; approach-first process; questions welcome; internship possibility; 2–3 calculators initially; AI tooling (Claude/MCP) allowed | **Audio 1 + Audio 2** | Extracted |
| Reference sites' roles (biomarkers page = SEO/knowledge model; niro.health = B2C product experience; Omni = interaction reference, "purana"/dated — build smaller but smarter/interlinked) | **Audio 1 + Audio 2 + brief §1/§3** | Extracted + sites analyzed |
| Non-tech calculator creation incl. associated content pages | **Audio 2** (primary) | Drives Admin Builder + content-page requirement |
| CWS exists inside NirogGyan B2B reports; partial risk score is normal when labs incomplete; consolidated wellness score = "health score" | **Audio 2** | Extracted; informs missing-value policy direction (exact math NC-C5) |
| "Risk logic covers 3 profiles" | **Audio 2** (garbled in transcription) | **NC-C10** — confirm what the 3 profiles are |
| 9 domains + weights (25/20/15/10/10/5/5/5/5) | **Niro risk-logic material** via brief §4 | Adopted as NIRO; re-verify against Sheet |
| Domain parameter membership (38 params) | Brief §5 (consolidating Niro material) | Adopted as NIRO; re-verify against Sheet |
| Domain formula Σpoints/max×100; raw = weighted sum; final = raw + adjustments | Brief §7 | Adopted as NIRO |
| Category bands (<10 Optimal … >50 Poor, lower-is-better) | Brief §8 | Adopted as NIRO; boundary semantics **NC-C4** |
| Adjustment factors: age, BMI, smoking, physical activity | Brief §6 | Adopted as NIRO; point values **NC-C2** |
| Gender/age/context-specific interpretation exists | Brief §6 (+ external ranges confirm which biomarkers) | Adopted as NIRO |
| **Per-parameter scoring thresholds + points** | **Niro Risk Logic Google Sheet — NOT PROVIDED** | **NC-C1** — interim externally-verified bands, tagged `interimPendingNiroSheet` |
| Biomarker reference ranges, clinical categories, units, conversions | **External authorities** (WHO, NIH/ODS/NIDDK/MedlinePlus/StatPearls, ADA, ACC/AHA via NIH mirrors, NKF/KDIGO, ATA, ACG, AUA, Endocrine Society, CDC archive) | Fully verified + attributed ([04-trusted-medical-sources.md](04-trusted-medical-sources.md), [research/](research/)) |
| eAG formula 28.7×A1c−46.7; BMI formula + categories; activity guideline; smoking definitions | External (ADA; WHO/CDC; WHO 2020; CDC NHIS) — all fetch-verified | Adopted as EXTERNAL |
| Lab-dependent biomarkers (fasting insulin, IL-6, anti-TPO cutoff, estradiol phases) | No universal authority exists | **NC** — lab-supplied interval or Niro sheet |
| Architecture: deterministic engine separate from explanation; MERN; simple backend; anti-over-engineering | Brief §10–11 + master requirements + Audio 2 ("simple backend") | Adopted |
| Parameter-driven platform, builder workflow, versioning, 28 deliverables | Master requirements document (this task's prompt) | Adopted |

## Clarification register (updated after Risk Analysis folder arrival, 2026-08-18)

**RESOLVED by `Risk Analysis/` (CWS Framework PDF + Risk calculators.xlsx):**

| ID | Was | Resolution |
|---|---|---|
| ~~C1~~ | Per-parameter thresholds + points | **CWS PDF §3 provides all 38** — configured in niro-cws.config.json v2 |
| ~~C2~~ | Adjustment point values | **PDF §4**: age 0–4 · BMI 0–4 (U-shaped) · smoking 0–4 (5 levels) · activity −2…+2 |
| ~~C3~~ | Max points per parameter/domain | Derivable from PDF band tables (incl. negative HDL/activity points) |
| ~~C6~~ | eAG scored or display-only | **Scored separately** (PDF §3.2 has its own eAG point bands) |
| ~~C8~~ | Cortisol/estradiol context rules | PDF §3.9: morning/afternoon cortisol bands; estradiol male + premenopausal bands |
| ~~C9~~ | Insulin / IL-6 / anti-TPO bands | PDF §3: insulin <10/10–15/>15 · IL-6 <1/1–3/>3 · anti-TPO <35/35–100/>100 |
| ~~C10~~ | "3 profiles" | **XLSX sheets: Hypothyroid, Diabetes, Heart** — all three now configured |
| C4 | Category boundary semantics | *Narrowed*: PDF repeats <10/10–20/21–30/31–50/>50; continuous min-inclusive reading configured, gaps 20–21/30–31/50–51 still to confirm |
| C5 | Missing-value math | *Partially resolved*: Diabetes + Heart sheets define explicit per-parameter missing logic (imputation/defaults/mandatory); CWS partial policy still exclude-from-max pending confirmation |
| C7 | Required vs optional | *Partially resolved*: Diabetes sheet marks Age "Mandatory", defaults for others; CWS unconfirmed |
| C11 | Keyword/SEO roadmap scope | Open (content roadmap, not platform build) |

**NEW clarifications from the Risk Analysis sources:**

| ID | Question for Niro |
|---|---|
| **N1** | CWS Framework PDF carries the comment *"This has been rejected because of no stratified ranges available for client."* Build CWS as documented, await stratified revision, or launch only the 3 risk calculators? |
| N2 | Cortisol intake flow: afternoon sample has only the 0-point band defined — how to score abnormal afternoon values? |
| N3 | Diabetes PP Sugar: numeric cutoffs for Normal/Borderline/High not stated (select input used meanwhile) |
| N4 | CWS estradiol: 2-point band "N/A"; postmenopausal women not covered by any band |
| N5 | Hypothyroid symptom cluster: one 5-point factor (configured) or points per symptom row? |
| N6 | Heart: single Framingham table with no sex split (matches men's coefficients) — unisex intended, or add women's table? |
| N7 | Heart floor penalty LDL 130–159 written "12%–15%" — exact floor value? (12 configured, flagged) |
| N8 | "Vascular Age Calculation" cited in heart references but no table/formula present — in scope? |
| N9 | CWS band gaps as written: albumin 3.5–3.6, creatinine below 0.6/0.5, magnesium >2.5, zinc >120, hemoglobin above upper optimal — score 0 or define bands? |
