# Niro Health Calculator Platform — Deliverables Index

> Pre-implementation analysis & design package. Maps all 28 required deliverables (master requirements §18) to files in this folder. Prepared 2026-08-18.

| # | Required deliverable | File |
|---|---|---|
| 1 | Complete Niro Project Understanding | [01-project-understanding.md](01-project-understanding.md) |
| 2 | Complete Source Analysis | [02-source-analysis.md](02-source-analysis.md) (+ [transcripts/](transcripts/) ×6) |
| 3 | Source-of-Truth Matrix | [03-source-of-truth-matrix.md](03-source-of-truth-matrix.md) |
| 4 | Trusted Medical Data Source List | [04-trusted-medical-sources.md](04-trusted-medical-sources.md) |
| 5 | Complete Biomarker Dataset | [05-biomarker-dataset.md](05-biomarker-dataset.md) + [config-samples/biomarker-dataset.json](config-samples/biomarker-dataset.json) |
| 6 | Detailed Biomarker Reference | [06-biomarker-reference.md](06-biomarker-reference.md) (+ [research/](research/) ×4) |
| 7 | Calculator Parameter Dataset | [config-samples/](config-samples/): niro-cws (v2, real Niro points) · hypothyroid-risk · diabetes-risk · heart-risk · covid-risk |
| 8 | Rule / Formula Mapping | [15-rule-formula-mapping.md](15-rule-formula-mapping.md) |
| 9 | External Medical Data Mapping | [04-trusted-medical-sources.md](04-trusted-medical-sources.md) §2 + per-value tags in biomarker JSON |
| 10 | Reusable Platform Architecture | [07-platform-architecture.md](07-platform-architecture.md) |
| 11 | Architecture Diagram — HTML | [08-architecture-diagram.html](08-architecture-diagram.html) |
| 12 | Matching Architecture Diagram — PDF | [08-architecture-diagram.pdf](08-architecture-diagram.pdf) |
| 13 | Module Breakdown | [07-platform-architecture.md](07-platform-architecture.md) §3 |
| 14 | MongoDB Data Model | [09-mongodb-data-model.md](09-mongodb-data-model.md) |
| 15 | API Requirements | [10-api-specification.md](10-api-specification.md) |
| 16 | Dynamic UI Architecture | [11-dynamic-ui-architecture.md](11-dynamic-ui-architecture.md) |
| 17 | Admin Calculator Builder Design | [12-admin-calculator-builder.md](12-admin-calculator-builder.md) |
| 18 | Generic Calculation Engine Design | [13-calculation-engine-design.md](13-calculation-engine-design.md) |
| 19 | Niro Calculator Configuration | [config-samples/niro-cws.config.json](config-samples/niro-cws.config.json) |
| 20 | UI/UX Flow | [11-dynamic-ui-architecture.md](11-dynamic-ui-architecture.md) §2 |
| 21 | Priority-wise Execution Plan | [14-execution-plan.md](14-execution-plan.md) |
| 22 | Phase Dependencies | [14-execution-plan.md](14-execution-plan.md) (phase map + per-phase) |
| 23 | Critical Path | [14-execution-plan.md](14-execution-plan.md) (critical path line) |
| 24 | Parallel Work Opportunities | [14-execution-plan.md](14-execution-plan.md) (parallel tracks) |
| 25 | Definition of Done | [14-execution-plan.md](14-execution-plan.md) (per-phase + global gates) |
| 26 | Testing Strategy | [16-testing-strategy.md](16-testing-strategy.md) |
| 27 | Reusability Validation | [16-testing-strategy.md](16-testing-strategy.md) §3 (the reusability gate) |
| 28 | Final End-to-End Implementation Flow | [14-execution-plan.md](14-execution-plan.md) + [01-project-understanding.md](01-project-understanding.md) |

**Key facts at a glance:** 9 Niro domains (weights 25/20/15/10/10/5/5/5/5) · 38 biomarkers + 5 profile/lifestyle factors · CWS categories <10 Optimal … >50 Poor (lower-is-better) · **full Niro point system now transcribed from the Risk Analysis folder** ([research/niro-risk-logic-extraction.md](research/niro-risk-logic-extraction.md)) incl. the 3 ACTIVE risk calculators (Hypothyroid · Diabetes/IDRS · Heart/Modified-Framingham) · CWS PDF carries a rejection comment → clarification N1 · 5 calculator configs shipped · 19 external-authority conflicts + 9 open clarifications (N1–N9) recorded.

**Stakeholder-ready Word documents** (management/client versions): [word/Niro Health Calculator Platform - Architecture.docx](word/Niro%20Health%20Calculator%20Platform%20-%20Architecture.docx) (4 pp, single-page non-technical diagram) · [word/Niro Health Calculator Platform - Execution Plan.docx](word/Niro%20Health%20Calculator%20Platform%20-%20Execution%20Plan.docx) (7 phases).

**UPDATE 2026-08-18 (Risk Analysis folder):** primary risk-logic sources arrived after the initial package; clarifications C1–C3, C6, C8–C10 resolved; engine primitives extended (max-aggregation, lookup tables, multiplicative formulas, imputation rules, floor penalties + category overrides — [13-calculation-engine-design.md](13-calculation-engine-design.md) §6).
