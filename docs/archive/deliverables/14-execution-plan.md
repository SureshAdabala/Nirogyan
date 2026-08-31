# Project Execution Plan

> **Non-Technical Guide**  
> *A four-phase outcome-focused delivery plan for the health calculator platform.*

---

## 1. Roadmap Overview

- **Phase 1:** Research and Medical Rules Foundation
- **Phase 2:** Engine and Database Build
- **Phase 3:** User App and Admin Builder
- **Phase 4:** Testing and Final Launch

---

## 2. Phase Details and Outcomes

### Phase 1: Research and Medical Rules Foundation
- **Tasks:** Analyze project brief and reference sites; verify 38 biomarkers against medical sources; create standard biomarker reference dataset.
- **Deliverables:** Project understanding document, source analysis, medical source references, and initial calculator configuration samples.
- **Outcome:** Verified medical rulebook and reference datasets ready for system construction.

### Phase 2: Engine and Database Build
- **Tasks:** Set up database schemas; build configuration validator service; build 10-stage calculation engine.
- **Deliverables:** Database models, validator module, pure calculation engine module, and unit test suite.
- **Outcome:** Working calculation engine that evaluates health scores in under 0.3 seconds.

### Phase 3: User App and Admin Builder
- **Tasks:** Build dynamic React user form and results renderer; build visual Admin Builder interface; integrate REST APIs.
- **Deliverables:** Dynamic web application, Admin Builder UI, and public/admin API endpoints.
- **Outcome:** Functional web application and no-code administration panel for managing calculators.

### Phase 4: Testing and Final Launch
- **Tasks:** Perform unit, API, component, and end-to-end testing; execute reusability check by building a second calculator via Admin UI only; prepare release documentation.
- **Deliverables:** Completed test suite, reusability verification evidence, and release setup documentation.
- **Outcome:** Fully tested, production-ready platform with proven zero-code calculator creation.

---

## 3. Final Delivery Principles

- **Zero-Code Updates:** Adding or updating a calculator requires no code changes.
- **Medical Traceability:** Every score traces to an explicit source or medical authority.
- **Result Reproducibility:** Every calculated result is deterministic and fully auditable.
