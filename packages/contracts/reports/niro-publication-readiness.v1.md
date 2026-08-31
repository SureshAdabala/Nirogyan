# Niro publication-readiness report v1

Evidence-request hash: `af7df0177f4919a1be1a664c5ce3568c89f88eb93a175cd6af145cfc4dabfea3`  
Reconciliation hash: `b3e73217b4c1e9d8467b91295d47712246183f7b9481ac650efa98e892558697`  
Contract evaluation time: `2026-08-28T00:00:00.000Z`

> All four Niro calculators remain drafts and publication-blocked. This is an evidence handoff report, not a clinical decision or publish approval.

## Summary

- Calculators: 4
- Publication eligible: 0
- Publication blocked: 4
- External calculator-specific blocker IDs: 56
- Open evidence requests: 20
- Accepted evidence recorded here: 0

## Calculator readiness

| Calculator | State | Structural | Semantic errors | Clinical errors | Publish errors | External blockers |
|---|---|---:|---:|---:|---:|---|
| diabetes-risk | publication-blocked | pass | 5 | 5 | 9 | `DIA-01`, `DIA-02`, `DIA-03`, `DIA-04`, `DIA-06`, `DIA-07`, `DIA-09`, `DIA-10`, `DIA-11`, `DIA-12`, `DIA-13`, `DIA-14` |
| heart-risk | publication-blocked | pass | 4 | 6 | 9 | `HRT-01`, `HRT-02`, `HRT-03`, `HRT-04`, `HRT-05`, `HRT-06`, `HRT-07`, `HRT-08`, `HRT-09`, `HRT-10`, `HRT-11`, `HRT-12`, `HRT-13`, `HRT-14`, `HRT-16`, `HRT-17`, `HRT-18`, `HRT-20` |
| hypothyroid-risk | publication-blocked | pass | 7 | 6 | 9 | `HYP-01`, `HYP-02`, `HYP-03`, `HYP-04`, `HYP-05`, `HYP-06`, `HYP-07` |
| niro-cws | source-rejected-publication-blocked | pass | 21 | 5 | 9 | `N1`, `CWS-01`, `CWS-03`, `CWS-04`, `CWS-05`, `CWS-06`, `CWS-07`, `CWS-08`, `CWS-09`, `CWS-10`, `CWS-11`, `CWS-12`, `CWS-13`, `CWS-14`, `CWS-15`, `CWS-16`, `CWS-18`, `CWS-19`, `CWS-20` |

## External evidence workflow

### diabetes-risk

Source: `data/sources/risk-analysis/Risk calculators.xlsx#Diabetes!B5:I27`

- **source-owner-disposition** — `awaiting-external-evidence`; owner: `niro-source-owner`. Required: A decision for every listed calculator-specific blocker ID. A precise locator in a versioned source artifact for every confirmed threshold, endpoint, applicability rule, and missing-data rule. An explicit statement where the source intentionally leaves a value unscorable or a feature out of scope.
- **measurement-review** — `awaiting-external-evidence`; owner: `qualified-measurement-reviewer`. Required: Approved immutable measurement revisions for every medical parameter selected during reviewed Studio authoring. Reviewed unit, conversion, bound, context, and claim-source evidence for each selected revision.
- **complete-source-worked-example** — `awaiting-external-evidence`; owner: `niro-source-owner`. Required: One complete input set covering every required final-result dependency. Expected final score and result category. A precise current source locator and reviewer-approved boundary cases.
- **content-governance** — `awaiting-external-evidence`; owner: `content-and-governance-owner`. Required: Reviewed structured content, educational disclaimer, applicability copy, SEO metadata, authorship, and claim-level citations. Current source verification and licensing dispositions for every medical claim. Approved privacy, retention, legal, and publication policy values required by the calculator.
- **independent-medical-review** — `blocked-by-prerequisite`; owner: `qualified-independent-medical-reviewer`. Required: Named reviewer identity with accepted credentials and jurisdiction. Independent approval of the final protected logic, content, citation, measurement, and required-test snapshot hashes. A current review date and approved review-expiry cadence.

Locked engineering dispositions (not clinical approval):

- `DIA-05`: Engine aggregation semantics are locked; clinical and complete-test evidence remains required.
- `DIA-08`: Imputation applies only to a missing target under the locked engine contract.

### heart-risk

Source: `data/sources/risk-analysis/Risk calculators.xlsx#'Heart '!A1:V66`

- **source-owner-disposition** — `awaiting-external-evidence`; owner: `niro-source-owner`. Required: A decision for every listed calculator-specific blocker ID, including sex/population applicability and interval-valued lookup/floor outputs. A precise locator in a versioned source artifact for every confirmed threshold, endpoint, floor predicate, and score transformation. An explicit in-scope or out-of-scope decision for non-HDL and vascular-age claims.
- **measurement-review** — `awaiting-external-evidence`; owner: `qualified-measurement-reviewer`. Required: Approved immutable measurement revisions for every bound Heart parameter. Explicit review of the calculator-local 38.61 lipid conversion without global harmonization.
- **complete-source-worked-example** — `awaiting-external-evidence`; owner: `niro-source-owner`. Required: A complete input set including LDL and triglycerides and every final floor/adjustment dependency. Expected final adjusted/floored score and result category. A precise current source locator and reviewer-approved boundary cases; the existing 13-to-10 base-stage example is insufficient.
- **content-governance** — `awaiting-external-evidence`; owner: `content-and-governance-owner`. Required: Reviewed structured content, educational disclaimer, applicability copy, SEO metadata, authorship, and claim-level citations. Current source verification and licensing dispositions for every medical claim. Approved privacy, retention, legal, and publication policy values required by the calculator.
- **independent-medical-review** — `blocked-by-prerequisite`; owner: `qualified-independent-medical-reviewer`. Required: Named reviewer identity with accepted credentials and jurisdiction. Independent approval of the final protected logic, content, citation, measurement, and required-test snapshot hashes. A current review date and approved review-expiry cadence.

Locked engineering dispositions (not clinical approval):

- `HRT-15`: No applicable floor is zero with trace under the locked engine contract.
- `HRT-19`: Legacy formula aliases bind deterministically under the locked engine contract.
- `HRT-20`: Maximum applicable floor and all messages are locked engineering behavior; independent clinical approval remains required.

### hypothyroid-risk

Source: `data/sources/risk-analysis/Risk calculators.xlsx#Hypothyroid!A2:E49`

- **source-owner-disposition** — `awaiting-external-evidence`; owner: `niro-source-owner`. Required: A decision for every listed calculator-specific blocker ID, including symptom grouping, unknown/omitted inputs, partial completion, score lattice, and population applicability. A precise locator in a versioned source artifact for every confirmed rule. An explicit statement where the source intentionally leaves an input unscored or an assessment invalid.
- **measurement-review** — `awaiting-external-evidence`; owner: `qualified-measurement-reviewer`. Required: Approved immutable measurement revisions for every medical parameter selected during reviewed Studio authoring. Reviewed unit, bound, missing-state, context, and claim-source evidence for each selected revision.
- **complete-source-worked-example** — `awaiting-external-evidence`; owner: `niro-source-owner`. Required: One complete input set covering every required final-result dependency. Expected final score and result category. A precise current source locator and reviewer-approved boundary cases.
- **content-governance** — `awaiting-external-evidence`; owner: `content-and-governance-owner`. Required: Reviewed structured content, educational disclaimer, applicability copy, SEO metadata, authorship, and claim-level citations. Current source verification and licensing dispositions for every medical claim. Approved privacy, retention, legal, and publication policy values required by the calculator.
- **independent-medical-review** — `blocked-by-prerequisite`; owner: `qualified-independent-medical-reviewer`. Required: Named reviewer identity with accepted credentials and jurisdiction. Independent approval of the final protected logic, content, citation, measurement, and required-test snapshot hashes. A current review date and approved review-expiry cadence.

Locked engineering dispositions (not clinical approval):

- None.

### niro-cws

Source: `data/sources/risk-analysis/Comprehensive Wellness Score Framework_ A Point-Based Assessment of Health Parameters.pdf#sections-2-6-and-page-18`

- **source-owner-disposition** — `awaiting-external-evidence`; owner: `niro-source-owner`. Required: A signed/versioned disposition of the source's explicit rejection and N1 before any other publication work can make CWS eligible. A decision for every listed CWS blocker ID, including stratified ranges, gaps, contexts, missing-domain behavior, category seams, extrema, and applicability. A precise locator in a versioned replacement or explicitly approved source artifact for every confirmed rule.
- **measurement-review** — `awaiting-external-evidence`; owner: `qualified-measurement-reviewer`. Required: Approved immutable revisions for all 40 selected measurement dependencies. Reviewed range, unit, conversion, context, derivation, and claim-source evidence without importing the quarantined catalog.
- **complete-source-worked-example** — `awaiting-external-evidence`; owner: `niro-source-owner`. Required: One complete input set covering domain, missing-data, derived, adjustment, and final-category behavior. Expected final score and result category. A precise current source locator and reviewer-approved boundary cases.
- **content-governance** — `awaiting-external-evidence`; owner: `content-and-governance-owner`. Required: Reviewed structured content that clearly labels the source status and does not present an unapproved framework as medical advice. Educational disclaimer, applicability copy, SEO/indexing decision, authorship, and claim-level citations with current licensing dispositions. Approved privacy, retention, legal, and publication policy values required by the calculator.
- **independent-medical-review** — `blocked-by-prerequisite`; owner: `qualified-independent-medical-reviewer`. Required: Named reviewer identity with accepted credentials and jurisdiction. Independent approval of the final protected logic, content, citation, measurement, and required-test snapshot hashes after N1 is resolved. A current review date and approved review-expiry cadence.

Locked engineering dispositions (not clinical approval):

- `CWS-02`: Public copy must distinguish 38 measured labs, 40 scored parameters, and 49 total parameters, or omit the count. This does not resolve clinical eligibility.
- `CWS-17`: Revision-3 measurement provenance records exact source/version linkage and all 45 current calculator references. This resolves the stale usage-metadata defect without approving any measurement or CWS clinical value.

## Worked-example gate

- `data/goldens/heart-base-stage.v1.json` remains a partial stage check with `satisfiesPUB007:false`.
- Every clinical calculator still needs a complete source-worked example with complete inputs, expected final score/category, precise current source locator, and boundary evidence.

## Safe handoff rule

1. Collect the requested evidence outside executable configuration.
2. Verify provenance, authority, credentials, jurisdiction, and completeness.
3. Apply an accepted decision only through a new Studio draft; never mutate a published version.
4. Re-run structural, semantic, clinical, publish, saved-test, measurement, and protected-hash checks.
5. A distinct qualified medical reviewer must approve the resulting protected snapshot before publication can be attempted.

COVID and the quarantined catalog are excluded. Generating or checking this report performs no database write.
