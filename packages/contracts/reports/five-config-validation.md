# P0A validation report — five calculator configurations

**Run date:** 2026-08-21  
**Schema dialect:** JSON Schema Draft 2020-12  
**Structural schema:** `../schemas/calculator-version.v1.schema.json`  
**Semantic policy:** `../specs/engine-semantics.v1.md`  
**Validation layers:** `../specs/validation-layers.v1.md`  
**Clinical values changed:** none  
**Configuration files changed:** none

## 1. Method and reproducibility

1. Parsed each config as JSON.
2. Validated all three P0A schemas with `jsonschema` 4.19.2 `Draft202012Validator.check_schema`.
3. Validated each config against the strict calculator schema with Draft 2020-12 and format checking enabled.
4. Performed cross-reference, uniqueness, option, context, band, aggregate, formula-symbol/DAG, maximum-range, missing-policy, and source reconciliation checks.
5. Compared Niro calculators with the original CWS PDF/XLSX and existing extraction/source matrix.
6. Applied the four-layer rules without altering a config to make it pass.

Structural validation command used during P0A:

```powershell
python -c "import json,pathlib; from jsonschema import Draft202012Validator; s=json.loads(pathlib.Path('packages/contracts/schemas/calculator-version.v1.schema.json').read_text(encoding='utf-8')); v=Draft202012Validator(s,format_checker=Draft202012Validator.FORMAT_CHECKER); print([(p.name,len(list(v.iter_errors(json.loads(p.read_text(encoding='utf-8')))))) for p in sorted(pathlib.Path('data/fixtures/config-samples').glob('*.config.json'))])"
```

Observed structural errors: zero for every config.

## 2. Artifact hashes

Hashes identify the exact untouched fixtures assessed:

| File | SHA-256 |
|---|---|
| `covid-risk.config.json` | `82180cbfa630eba514f536419bcdb969ee74da36cca5e44236fe7f1bf8897de3` |
| `diabetes-risk.config.json` | `1dee527ed5ce64ac64f7a567577d1e3cee49a0c442a7afc2793a3b956d75152a` |
| `heart-risk.config.json` | `2c4c70c6b1264abbe2db2c12638052abbc83255fab76ef7bc06968d76c802f93` |
| `hypothyroid-risk.config.json` | `a6ebd589f2b5ae105ed3b96376bfb263e2f5ba1432d291a0e37a3988177fb7c8` |
| `niro-cws.config.json` | `42e0a1826efb32fbc7df593a5574424df08d93b855abc4026a64b4ce6bbce52e` |

## 3. Configuration inventory

| Config | Parameters | Rules | Special structures | Result bands |
|---|---:|---:|---|---:|
| COVID demo | 10 | 10 | 1 implicit domain, 1 formula | 3 |
| Diabetes | 8 | 7 | 1 max aggregate, 1 imputation, 2 category overrides | 3 |
| Heart | 9 | 7 | 1 imputation, 1 lookup/24 rows, 6 formulas, 1 floor/5 tiers | 3 |
| Hypothyroid | 8 | 8 | 1 implicit domain, 1 formula | 3 |
| CWS v2 | 49 (42 number, 5 select, 2 derived) | 40 | 9 domains, 3 formulas, 4 adjustments | 5 |

All ordinary parameter, domain, aggregate, option, category, and UI-group references resolve. All keys/orders in their required uniqueness scopes are unique. Under the locked kebab-to-lowerCamel formula alias rule, formula references bind and the formula/derived graphs are acyclic.

## 4. Layer summary

| Configuration | Structural | Semantic | Clinical | Publish eligibility |
|---|---|---|---|---|
| COVID demo | **PASS** | **FAIL** | **NONCLINICAL / FAIL for clinical use** | **BLOCKED** |
| Diabetes | **PASS** | **FAIL** | **FAIL / unresolved** | **BLOCKED** |
| Heart | **PASS** | **FAIL** | **FAIL / unresolved** | **BLOCKED** |
| Hypothyroid | **PASS** | **FAIL** | **FAIL / unresolved** | **BLOCKED** |
| CWS v2 | **PASS** | **FAIL** | **FAIL / source explicitly rejected** | **BLOCKED** |

Structural PASS means the files conform to the P0A schema as drafts. It does not imply a runnable, medically correct, or publishable calculator.

All five also fail common publish gates PUB-006 through PUB-010 because they do not yet snapshot conforming content, claim-level citation manifests, authorship/medical approval, required test cases, SEO, and reviewed source/license status.

## 5. COVID demonstration

### Structural

PASS. The scale maximum 14 equals the sum of the configured illustrative maxima, and bands cover the scale under `[min,max)`.

### Semantic failures

- **SEM-010:** `/parameters/2` through `/parameters/9` are optional Booleans with no missing policy. Missing must not become false.
- **SEM-052/PUB-009:** no associated page/SEO/noindex contract exists in the fixture.

### Clinical failures

- **CLN-003, CLN-013:** every point weight/category is explicitly illustrative; the cited material supports a general factor list, not a clinical score.
- **CLN-004:** time-sensitive CDC factor evidence was not fetch-verified and says reverify before production.

### Discrepancies

`COV-01` through `COV-06`, plus `GEN-03`, `GEN-06`, `GEN-07`.

Disposition: internal nonclinical fixture only. It cannot become a clinical-public risk calculator merely by adding review metadata.

## 6. Hypothyroid Risk

### Structural

PASS. Current single-cluster interpretation yields a theoretical maximum of 85, matching the declared scale.

### Semantic failures

- **SEM-010:** `/parameters/2`–`/4` lack explicit Boolean missing policies.
- **SEM-024/027:** continuous category interval 15–16 is uncovered. It is unreachable only if an explicit integer/multiple-of-five score lattice is declared.

### Clinical failures

- **CLN-001/007:** symptom cluster versus per-symptom points remains unresolved (N5).
- **CLN-007:** `unknown` lab options score zero without source-approved missing semantics.
- **CLN-007/008:** partial-completion behavior and the scale maximum depend on N5.
- **CLN-006:** adult-only population is not established.

### Discrepancies

`HYP-01` through `HYP-07`, plus common findings.

## 7. Diabetes Risk

### Structural

PASS. All ordinary references resolve. Aggregate-dependent imputation is structurally represented.

### P0A semantic resolutions

- `sum(points)` excludes raw component members consumed through `aggregateKeys`; therefore the formula does not double-count the three lab scores.
- Imputation targets only a missing value and runs after prerequisite aggregate scoring through the dependency DAG.

These resolutions make the intended structures expressible; they do not close clinical/source gaps.

### Semantic failures

- **SEM-024:** age 49–50, HbA1c 6.4–6.5, and FBS 125–126 are reachable gaps under continuous inputs; age has no integer declaration.
- **SEM-033:** `max(empty)` has no empty policy when all labs are missing.
- **SEM-013:** waist imputation has no fallback when the glycemic condition is false/missing.
- **SEM-043:** theoretical maximum 110 exceeds declared scale maximum 100.

### Clinical failures

- **CLN-001/008:** source age 35 belongs to two bands; config chooses zero.
- **CLN-001/008:** exact HbA1c 6.5 and FBS 126 are assigned high points despite source wording `>6.5` and `>126`.
- **CLN-003:** PP Normal/Borderline/High lacks numeric/source criteria.
- **CLN-007:** empty glycemic and missing-waist behavior is not approved.
- **CLN-001:** Moderate activity 3 is source-transcribed but anomalous and needs explicit confirmation.

### Discrepancies

`DIA-01` through `DIA-14`, plus common findings.

## 8. Heart Risk

### Structural

PASS. The legacy lookup shape, formula aliasing, floor tiers, and imputation shape conform.

### P0A semantic resolutions

- Kebab formula aliases bind `basePoints`, `baseRisk`, `sLipid`, `mYoung`, `adjustedRisk`; `floorPenalty` is a reserved stage output.
- No applicable floor produces numeric zero plus a no-floor trace.
- Multiple applicable floors select the maximum and retain every matched message.
- Missing values do not satisfy `ne`; missing `bpTreated` cannot mean untreated.

### Semantic failures

- **SEM-024:** triglyceride gaps 150–151 and 200–201.
- **SEM-023:** SBP imputation bands overlap at age 50.
- **SEM-010/025:** optional `bpTreated` can leave SBP with no context.
- **SEM-040:** prose says “only lipids elevated,” but executable conditions do not implement that meaning.
- **SEM-043:** accepted inputs can reach approximately `30.1 × 3.65 × 1.8 = 197.757`, outside max 60.
- **SEM-044:** the source example validates base 13→10%, not a full final result, and omits required LDL.

### Clinical failures

- **CLN-001/006:** sex/coefficient/unisex applicability unresolved (N6).
- **CLN-001/003:** `<1` and `>30` were converted to invented 0.9/30.1 computation values.
- **CLN-001/007:** floor condition is incomplete; 12 selected from 12–15%; LDL 190 and TC operator are undefined.
- **CLN-008:** source category 10–19/>20 differs from config treatment of exact 20/fractional seams.
- **CLN-007/008:** no approved probability cap/validity behavior.
- **CLN-003:** non-HDL and vascular-age claims lack executable source logic.

### Discrepancies

`HRT-01` through `HRT-20`, plus common findings.

## 9. Comprehensive Wellness Score v2

### Structural

PASS. The 40 rules, 49 parameters, nine domains, weights, formulas, and ordinary references are connected; weights sum to 1.

### P0A semantic resolutions

- `rawScore` binds to formula key `raw-score` through the compatibility alias.
- Negative protective points remain negative; the engine does not apply the plan's former implicit zero clamp.
- Source-preserved gaps produce no-score only after they are explicitly annotated with clarification IDs.

### Semantic failures

- **SEM-037:** entirely missing-domain behavior/weight handling is absent.
- **SEM-024/025:** numerous reachable source gaps, missing cortisol context, and missing postmenopausal estradiol context lack required `asWritten` metadata.
- **SEM-038:** afternoon cortisol's only zero-point band yields a zero maximum and cannot form a normalized scorable domain contribution.
- **SEM-043:** raw maximum 100 plus adjustments 14 exceeds scale max 110; sparse protective scoring may fall below the declared minimum.
- **SEM-010/025:** cortisol time and menopausal selector are optional when their values are needed.

### Clinical failures

- **CLN-001/010:** source explicitly rejected the framework (N1).
- **CLN-007:** partial parameter denominator and whole-domain missing semantics are unapproved.
- **CLN-003/008:** source gaps, fractional categories, activity/smoking boundaries, cortisol, and estradiol remain unresolved.
- **CLN-003:** eAG derivation provenance is conflated with Niro's decision to score it.

Complete known gap paths are in the discrepancy register under CWS-20.

### Discrepancies

`CWS-01` through `CWS-20`, plus common findings.

## 10. Publish decision

No P0A validation action changes a config's clinical value or promotes its lifecycle. All remain `status:"draft"`.

- CWS is held because its source is rejected and semantics are incomplete.
- Heart, Diabetes, and Hypothyroid require explicit source-owner/medical dispositions and approved full golden tests.
- COVID remains a nonclinical fixture and should be `noindex`/internal when a content wrapper is eventually added.

P0B may scaffold the platform and validation harness against these fixtures. It must not seed any fixture as published, silently repair values, or treat structural PASS as medical readiness.
