# Diabetes-risk clinical review preparation dossier

Prepared: 2026-08-30  
Scope: `diabetes-risk` only  
State: **draft, publication-blocked, not medically approved**  
Purpose: give the Niro source owner, measurement reviewer, content/governance owner,
and an independent medical reviewer an exact, provenance-preserving decision packet.

This dossier is research and review preparation. It is not executable evidence, a
clinical decision, a reviewer approval, or a publication instruction. It must not be
used to bypass Calculator Studio, the immutable review workflow, or any publication
gate.

## 1. Identity and immutable baseline

| Item                         | Exact value                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Calculator                   | `diabetes-risk` — Diabetes Risk Calculator                                         |
| Current application state    | `draft`; no current/public version                                                 |
| Primary Niro source          | `data/sources/risk-analysis/Risk calculators.xlsx#Diabetes!B5:I27`                 |
| Primary source SHA-256       | `f1d808861d61b1a4e748a2c079c0cafae521a3c1e0ef01c84cd015ac293fc089`                 |
| Primary source size          | 103,954 bytes                                                                      |
| Source fixture               | `data/fixtures/config-samples/diabetes-risk.config.json`                           |
| Fixture SHA-256              | `1dee527ed5ce64ac64f7a567577d1e3cee49a0c442a7afc2793a3b956d75152a`                 |
| Reconciled candidate SHA-256 | `43637527deb38a3bc10b7a40e23b1ba762bf2ca7b94fa1879674174a5a9aa82f`                 |
| Local Atlas state            | `niro_dev`; v1 draft only; zero bound measurement revisions; no review or approval |
| Local Atlas source hash      | `a6e37c5cf9e84a71305d9fdb880a5cf0412caee2727673900418c34105404826`                 |
| Local Atlas logic hash       | `922fff73bdcc95671cb175fdc11b064e8a4a39ff90d051d8ed523181a86b0f9d`                 |
| Local Atlas content hash     | `770c2d18aa4ec3159f46da461ef452972949942ff4f6a9771044485faa146398`                 |
| Local Atlas version hash     | `46d9fd7d941b2819abade2961996883e0d802ad4f4a3151574d58c160a3c883b`                 |
| Public behavior              | public API returns 404; no public calculator route is authorized                   |

The workbook was inspected directly rather than inferred from the JSON fixture. The
sheet contains an IDRS-like age/waist/activity/family-history score, adds a maximum of
HbA1c/FBS/PP-sugar points, and adds glycemic category escalation. That makes the Niro
instrument a **hybrid defined by the Niro workbook**, not the original IDRS.

## 2. Authoritative comparison sources

The sources below are comparison evidence. They do not have authority to silently
replace the Niro workbook.

1. Mohan et al., the original simplified Indian Diabetes Risk Score paper (JAPI,
   2005; PMID 16334618). The primary paper defines four non-biochemical factors,
   a 0–100 score, exact age/waist/activity/family-history points, and worked examples:
   [PubMed record](https://pubmed.ncbi.nlm.nih.gov/16334618/) and
   [full primary paper](https://repository.ias.ac.in/80170/1/80170.pdf).
2. Indian Council of Medical Research, _Guidelines for Management of Type 2 Diabetes
   2018_. The guideline defines screening/diagnostic test context, inclusive HbA1c and
   fasting-plasma-glucose endpoints, and the exact 75 g/two-hour OGTT protocol:
   [ICMR guideline](https://www.icmr.gov.in/icmrobject/custom_data/pdf/resource-guidelines/ICMR_GuidelinesType2diabetes2018_0.pdf).
3. American Diabetes Association, _Diabetes Diagnosis & Tests_. The page records
   HbA1c normal/prediabetes/diabetes bands, fasting-plasma-glucose bands, the two-hour
   OGTT definition, and the need for healthcare-setting confirmation:
   [ADA diagnosis page](https://diabetes.org/about-diabetes/diagnosis?language_content_entity=en).

### What the original IDRS actually establishes

- Age: `<35 = 0`, `35–49 = 20`, `>=50 = 30`.
- Abdominal obesity: sex-specific three-band waist scoring of `0/10/20`.
- Physical activity: regular exercise plus strenuous work `0`; either one `20`;
  neither/sedentary `30`.
- Family history: none `0`, one parent `10`, both parents `20`.
- Minimum `0`, maximum `100`; no HbA1c, fasting glucose, or PP-sugar points are part
  of the original IDRS.
- A score `>=60` had 72.5% sensitivity and 60.1% specificity for undiagnosed diabetes
  in the reported CURES validation population. This performance must not be claimed
  for the modified Niro hybrid without separate validation.

### What the comparison diagnostic sources establish

- HbA1c: `<5.7%` normal, `5.7–6.4%` prediabetes, `>=6.5%` diabetes.
- Fasting plasma glucose: `<100 mg/dL` normal, `100–125 mg/dL` prediabetes,
  `>=126 mg/dL` diabetes under the ADA categorization used in the workbook comparison.
- A two-hour glucose value is only an OGTT result when the required test protocol and
  context are present. The Niro label “PP Sugar” does not establish that protocol.
- Diagnostic cutoffs are not automatically valid as point boundaries in an unvalidated
  hybrid risk score. A qualified source owner and reviewer must explicitly adopt them.

## 3. Exact discrepancy disposition table

Every row remains open unless it is explicitly labeled as locked engineering behavior.

| ID       | Current evidence                                                                                                                          | Exact decision/evidence still required                                                                                                                | Current disposition                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `DIA-01` | Workbook overlaps age 35 (`<=35` and `35–49`); fixture chooses 0 at 35. Original IDRS uses `<35` then `35–49`.                            | Niro source owner must select the intended age-35 result and cite a versioned Niro source.                                                            | Open; original IDRS is corroboration, not an automatic fix.                       |
| `DIA-02` | Workbook says HbA1c `>6.5`; fixture awards high points at exactly 6.5 and leaves 6.4–6.5 unscored. ICMR/ADA use `>=6.5` diagnostically.   | Decide the hybrid score boundary and continuous-gap behavior; explicitly state whether diagnostic bands are intentionally adopted.                    | Open; no silent external overwrite.                                               |
| `DIA-03` | Workbook says FBS `>126`; fixture awards high points at exactly 126 and leaves 125–126 unscored. ICMR/ADA use `>=126` diagnostically.     | Decide the hybrid score boundary and continuous-gap behavior; explicitly state whether diagnostic bands are intentionally adopted.                    | Open; no silent external overwrite.                                               |
| `DIA-04` | Workbook supplies only Normal/Borderline/High PP labels and `0/10/20`; no sampling time, glucose load, specimen, unit, or cutoffs.        | Supply approved numeric criteria plus test context, or approve a clinician/lab-classified categorical input with user copy and provenance.            | Open; must not be inferred as OGTT.                                               |
| `DIA-05` | Engine contract consumes lab members into `glycemicIndex=max(...)` and excludes consumed members from direct point summation.             | Complete source-worked and boundary evidence, then reviewer approval.                                                                                 | Engineering semantics locked; no-double-count tests required.                     |
| `DIA-06` | All three labs are optional; `max(empty)` has no source-defined meaning.                                                                  | Select block, omit/partial result, or another explicitly sourced empty policy and approve the disclosure shown to users.                              | Open; runtime correctly fails closed today.                                       |
| `DIA-07` | Missing waist gets 10 only when glycemic index is at least 10; there is no rule below 10 or when labs are empty.                          | Provide an exact fallback/block/partial policy with source locator and user disclosure.                                                               | Open; zero must not be inferred.                                                  |
| `DIA-08` | Imputation must never replace a present waist value.                                                                                      | Complete trace/boundary evidence, then reviewer approval.                                                                                             | Engineering semantics locked: imputation applies only when the target is missing. |
| `DIA-09` | Workbook-transcribed hybrid can reach 110, while declared scale max is 100. Original IDRS max 100 does not validate the added lab hybrid. | Approve scale 110, revise approved scoring, or provide another sourced resolution; then align category/copy/tests.                                    | Open; points must not be changed merely to fit 100.                               |
| `DIA-10` | HbA1c rev3 and fasting-glucose rev3 exist, but both are draft/unreviewed and no Diabetes bindings exist.                                  | Approve immutable measurement revisions covering units, conversions, bounds, context, sources, claim links, and hashes; then bind a new Studio draft. | Open; current revisions are not bindable for publication.                         |
| `DIA-11` | Fixture accepts ages 18–120; workbook does not establish adult-only applicability.                                                        | Approve population, exclusions, intended use, and applicability copy with source.                                                                     | Open.                                                                             |
| `DIA-12` | Workbook says Moderate activity = 3; original IDRS has an intermediate activity score of 20 and requires work/exercise context.           | Confirm that 3 and the simplified option meaning are intentional, or supply a corrected versioned Niro source.                                        | Open; external IDRS cannot overwrite workbook.                                    |
| `DIA-13` | Fixture accepts fractional ages but 49–50 has no scoring band.                                                                            | Approve integer-only age input or explicitly approve an as-written unscorable gap and user behavior.                                                  | Open.                                                                             |
| `DIA-14` | Sex is required only to choose waist thresholds; the physiological meaning and inclusive alternatives are undocumented.                   | Approve the intended sex-at-birth/physiology context, allowed values, applicability, and user-facing explanation.                                     | Open.                                                                             |

## 4. Current validation evidence

| Layer       | Result | Findings                                                                                                    |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| Structural  | PASS   | 0 errors                                                                                                    |
| Semantic    | FAIL   | 5 errors: `SEM-013`, `SEM-024`, `SEM-033`                                                                   |
| Clinical    | FAIL   | 5 errors: `CLN-001`, `CLN-004`, `CLN-010`                                                                   |
| Publication | FAIL   | 9 errors: `PUB-002`, `PUB-003`, `PUB-004`, `PUB-005`, `PUB-006`, `PUB-007`, `PUB-008`, `PUB-010`, `PUB-013` |

Observed fail-closed diagnostic behavior of the current draft:

- all labs missing produces `AGGREGATE_EMPTY` and `EXPRESSION_ERROR`;
- missing waist with all labs missing also produces `BLOCKED_BY_POLICY`;
- age 49.5, HbA1c 6.45, and FBS 125.5 reach unscored gaps rather than receiving
  invented points;
- exact HbA1c 6.5 and FBS 126 currently receive high points, visibly preserving the
  source/config divergence for review;
- maximum accepted inputs produce 110 and `SCALE_ASSERTION_FAILED`;
- a present waist is not overwritten by glycemic imputation;
- glycemic member points are consumed by the maximum aggregate and not double-counted.

These are diagnostic regressions. They are not clinical acceptance tests and do not
satisfy `PUB-007`.

### Engineering preparation completed in this pass

- Added `data/reconciliation/evidence/diabetes-risk/review-preparation.v1.json` and
  `npm run p8:diabetes-review:check`. The verifier binds the exact workbook, fixture,
  and measurement-seed hashes; requires all 12 blockers to remain open; requires both
  measurement candidates to remain unapproved/non-bindable; and rejects executable
  clinical fields, populated examples, approvals, lifecycle states, and write mode.
- Hardened the server protected-review hash to a versioned v2 envelope over the entire
  calculator payload except root lifecycle-only `version` and `status`, plus exact
  measurement revision IDs and snapshots. Units, conversions, missing policies,
  aggregation, imputation, lookups, result boundaries/messages, disclaimers, content,
  sources, governance, and saved tests now invalidate stale approval evidence.
- Added explicit Diabetes fail-closed regressions for `DIA-02`, `DIA-03`, `DIA-05`,
  `DIA-06`, `DIA-07`, `DIA-08`, `DIA-09`, and `DIA-13` without changing a clinical
  value or treating the diagnostics as source goldens.
- Added Calculator Studio fields for saved-test source type, exact locator/reference,
  and verification status. Editing preserves existing source metadata, an empty source
  is omitted, and the UI explicitly states that provenance does not approve evidence.
- Added schema-supported Studio authoring for citation review expiry, the medical-review
  approved-claim coverage list, and source-review expiry. Unknown extension fields are
  preserved. No reviewer credential, jurisdiction, independence, or cadence fields
  were invented because the current schema has no approved policy contract for them.

Fresh verification after these changes:

| Check                                    | Result                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Generated contracts                      | PASS                                                                                           |
| Full workspace typecheck                 | PASS                                                                                           |
| Full repository lint                     | PASS                                                                                           |
| Full configured format check             | PASS                                                                                           |
| Workspace/script tests                   | PASS — 506/506                                                                                 |
| New packet-verifier tests                | PASS — 5/5                                                                                     |
| Total tests executed                     | PASS — 511/511                                                                                 |
| Full workspace production build          | PASS                                                                                           |
| Fixture validation command               | PASS; Diabetes remains structurally valid and deliberately non-publishable                     |
| Core measurement integrity               | PASS — 40 deterministic draft records; no integrity findings                                   |
| P8 reconciliation, divergence, readiness | PASS; no candidate became publication eligible                                                 |
| Diabetes review-preparation check        | PASS — 12 open blockers, 2 unapproved candidates, 0 bindable, 0 executable values, 0 approvals |

## 5. Measurement review candidates

These records are candidates only. They remain draft/unreviewed and must not be bound
as approved dependencies.

| Calculator parameter | Candidate measurement | Current immutable candidate | Definition hash                                                    | Blocking facts                                                                      |
| -------------------- | --------------------- | --------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `hba1c`              | `hba1c`               | revision 3                  | `bf8bea3734bf1a74c7e3ae31b0795eddbdf205c6aff8e3751b9f680c1dfe00e3` | no reviewer/approval hash; unresolved value authority and ranges/bounds/claims      |
| `fbs`                | `fasting-glucose`     | revision 3                  | `f4b636b1c550386c60c51eb1f3305864b8938ec5ae307fb91d1098fe8873794d` | no reviewer/approval hash; mmol/L conversion remains provenance-only pending review |
| `ppSugar`            | none                  | none                        | n/a                                                                | must not be inferred to `ogtt-2h-plasma-glucose`                                    |
| `waistCm`            | none approved         | none                        | n/a                                                                | quarantined catalog candidates are not eligible inputs                              |

The source owner may also explicitly decide that a parameter is calculator-local and
does not bind to a reusable measurement. That decision still needs unit, context,
bound, source, and review evidence.

## 6. Source worked examples and boundary evidence

The original IDRS paper provides seven worked examples for the original four-factor
instrument. They are useful corroboration for the IDRS component only. They cannot be
used as the Niro hybrid's `PUB-007` golden because they contain no glycemic inputs,
missing-data decisions, category escalation, or hybrid expected final result.

The Niro source owner must supply at least one complete example containing every final
dependency and an expected score and category. The accepted packet must also cover:

- age 35, 49/50, fractional input policy, minimum and maximum;
- male waist 90 and female waist 80, approved context, and approved unit conversion;
- present versus missing waist for glycemic empty/0/10/20;
- every approved activity/family-history option and omitted-input behavior;
- HbA1c 5.7, 6.4, the 6.4–6.5 interval, 6.5, and above 6.5;
- FBS 100, 125, the 125–126 interval, 126, and above 126;
- every approved PP-sugar choice or numeric boundary, plus missing/invalid behavior;
- glycemic maximum for each single member, ties, conflicts, partial input, and empty;
- proof of no double counting and present-waist protection;
- score/category seams at 40 and 70 and the approved maximum scale.

Expected outputs must remain blank in the repository preparation template until they
are supplied by an authorized source owner and independently reviewed.

## 7. Evidence ownership checklist

### Niro source owner

- [ ] Supply one decision for all 12 open `DIA-*` rows.
- [ ] Attach a signed/versioned source artifact and precise locator for each decision.
- [ ] State all intentionally unscorable, blocked, omitted, or out-of-scope cases.
- [ ] Supply a complete hybrid worked example and expected score/category.

### Qualified measurement reviewer

- [ ] Approve exact immutable revisions for HbA1c and fasting glucose, if bound.
- [ ] Review unit/conversion, bounds, context, source-to-claim mapping, and licenses.
- [ ] Decide PP-sugar and waist binding versus calculator-local representation.

### Content and governance owner

- [ ] Approve intended-use/applicability and non-diagnostic disclaimer.
- [ ] Approve result/recommendation copy and claim-level citations.
- [ ] Approve authorship, legal/privacy/retention policy, SEO, canonical, and indexing.

### Independent medical reviewer

- [ ] Confirm identity, credentials, jurisdiction, independence, and review cadence.
- [ ] Review the final new-draft logic/content/evidence/measurement/test hash envelope.
- [ ] Approve or request changes through the authenticated Studio lifecycle.

## 8. Required immutable workflow after evidence arrives

1. Preserve every received artifact byte-for-byte and calculate SHA-256.
2. Verify submitter authority and map every decision to an exact `DIA-*` ID and source
   locator; never synthesize a compromise between conflicting sources.
3. Apply accepted decisions to a **new v2 draft** through Calculator Studio. Never
   mutate v1 or the historical workbook.
4. Bind only approved immutable measurement revisions.
5. Add the authorized complete source-worked example and reviewed boundary tests.
6. Run structural, semantic, clinical, publication, source/license, content, saved-test,
   dependency, accessibility, privacy, and deployment validations.
7. Submit the exact protected snapshot to a distinct qualified medical reviewer.
8. Approve and publish only through authenticated, transactional server actions.
9. Verify the public API and route, then run deployed browser, accessibility, privacy,
   and performance checks.

## 9. Current final disposition

`diabetes-risk` is not yet eligible for review approval or publication. The repository
now has enough evidence to make every remaining decision precise, but it does not have
authority to make those medical, source-owner, measurement, content/legal, or reviewer
decisions on their behalf.

**Do not publish. Keep the calculator draft and non-public until every open item above
is resolved with authentic evidence and the normal immutable workflow succeeds.**
