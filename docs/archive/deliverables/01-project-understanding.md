# Complete Niro Project Understanding

> Deliverable 1. The what, why and how of the entire initiative, synthesized from ALL sources (3 audio notes, context brief, 3 reference sites, master requirements).

## WHAT we are building

A **reusable, self-serve health calculator platform** on MERN — a public, SEO-optimized hub of interlinked health/risk calculators (think "a smaller, smarter, modern Omni Calculator" fused with NirogGyan's biomarkers-page content discipline), where:

- The **Niro Comprehensive Wellness Score (CWS)** — the wellness/risk logic that already lives *inside* NirogGyan's B2B smart reports — becomes the first public calculator: ~38 biomarkers across 9 weighted health domains → parameter points → domain scores → weighted raw score → demographic/lifestyle adjustments → final score → category (Optimal→Poor) → explanation → recommendations.
- **New calculators (and their content pages) are created by non-technical people** through an admin builder — configuration, not code. "Even a non-tech guy can do that — calculator as well as associated content."
- Every calculator is **independent of the existing NirogGyan codebase** (assignment scope), cleanly modular for possible later integration.

## WHY it is needed

1. **Lead magnet / traffic engine** (Audio 3): capture "all possible calculator-related traffic" the way the biomarkers page captured long-tail biomarker searches through SEO discipline (Audio 1).
2. **Productize existing IP**: the CWS is currently internal to reports; this surfaces it B2C (Audio 2).
3. **Scale content operations**: 2–3 calculators at launch, then a growing catalog authored by the content/program team without engineering cycles (Audio 2).
4. **Hiring assignment**: the build doubles as a full-stack candidate evaluation "very close to what we do and still useful to us", with internship potential on success (Audio 1–2).

## HOW the platform works (one paragraph)

One generic React app renders any calculator from its **configuration document** (parameters, units, steps, validation); one generic Express/Node **rule-and-formula engine** executes that same configuration deterministically (normalize → derive → context → band-score → domain aggregate → weight → adjust → categorize → explain, with a full audit trace); MongoDB stores calculators as **immutable versioned config snapshots** plus a shared **biomarker library** in which every medical value carries a source attribution (Niro / external authority / needs-clarification). An **admin builder** creates and edits calculators through validate → preview (real engine) → test → publish, so adding the Nth calculator is a data event — no new pages, services, or deploys. Full detail: [07-platform-architecture.md](07-platform-architecture.md), diagram [08-architecture-diagram.html](08-architecture-diagram.html) (+ matching PDF).

## HOW Niro fits into it

Niro CWS is **configuration data, not special-cased code** ([config-samples/niro-cws.config.json](config-samples/niro-cws.config.json)): its NIRO-defined structure (9 domains, weights 25/20/15/10/10/5/5/5/5, Σpoints/max×100 domain formula, weighted-sum raw score, +adjustments final score, 5 categories lower-is-better) is fully expressed in platform primitives. Its exact per-parameter thresholds/points live in the **Niro Risk Logic Sheet, which is not in the provided folder** — so the config ships with clearly-tagged interim externally-verified bands, and the sheet's arrival is a builder data-edit (clarification register C1–C11 in [03-source-of-truth-matrix.md](03-source-of-truth-matrix.md)).

## HOW a new calculator is added without coding

Create → basic details → add parameters (from the biomarker library or custom) → configure inputs/units/validation → configure scoring bands/rules/formulas (visual editors + condition builder) → result categories → content page + UI layout → preview with real engine trace → validate → test cases → publish. Proven by the second config ([config-samples/covid-risk.config.json](config-samples/covid-risk.config.json)) and enforced by the reusability gate ([16-testing-strategy.md](16-testing-strategy.md) §3).

## HOW biomarker data is sourced and verified

Three-class traceability on every value — **Niro** / **External** (WHO, NIH ODS/NIDDK/MedlinePlus, StatPearls-NCBI, ADA, ACC-AHA via NIH mirrors, NKF-KDIGO, ATA, ACG, AUA, Endocrine Society, CDC — all fetch-verified 2026-08-18 with org/title/URL/date recorded) / **Needs Clarification** (never guessed). 19 inter-authority conflicts recorded and surfaced, never silently merged. Datasets: [05-biomarker-dataset.md](05-biomarker-dataset.md), [06-biomarker-reference.md](06-biomarker-reference.md), [config-samples/biomarker-dataset.json](config-samples/biomarker-dataset.json), research detail in [research/](research/).

## User experience (documented hierarchy)

Directory → calculator intro → multi-step dynamic form (unit switching, skip-what-you-don't-have — partial scoring is documented Niro behaviour) → **RESULT → CATEGORY → WHY/KEY CONTRIBUTORS → DOMAIN DETAILS → BIOMARKER DETAILS → RECOMMENDATIONS** → share/retake; anonymous-first with optional lead capture; biomarker knowledge pages interlinked NirogGyan-style; every on-screen medical figure can reveal its source. Detail: [11-dynamic-ui-architecture.md](11-dynamic-ui-architecture.md).

## Working process expected by Niro (Audio 2)

Approach-first (present understanding + plan before building), ask questions early ("I can clear it for you"), deadline-driven, AI tooling (Claude/MCP) encouraged, keyword analysis can inform the calculator roadmap.

## What implementation order follows

The 12-phase dependency-aware plan in [14-execution-plan.md](14-execution-plan.md) — platform primitives before calculator content, so Niro CWS itself validates the generic platform, and the second calculator proves it.
