# Four-layer validation policy v1

**Normative status:** locked by P0A  
**Applies to:** calculator versions, associated content, measurement revisions, and publication transitions

Validation has four independent layers. A result from one layer must never be described as a result from another.

## 1. Result model

Every finding contains:

```text
id, layer, severity, artifact, jsonPath/locator, message,
relatedDiscrepancyIds[], remediation, status, evidence[]
```

Severities:

- `error` — layer fails
- `warning` — layer may pass, but reviewer attention is required
- `info` — traceable migration/deprecation information

Finding lifecycle is `open | accepted-with-evidence | resolved | superseded`. Only a named rule may permit `accepted-with-evidence`; acceptance records actor, timestamp, justification, affected version hash, and expiry if applicable.

Draft versions may be saved after structural pass even when later layers fail. Preview may run only after structural pass and the subset of semantic rules required for deterministic execution. Publishing requires every `PUB-*` gate.

## 2. Structural validation (`STR-*`)

Structural validation is deterministic JSON Schema validation. It proves only shape and primitive types.

| ID | Rule | Failure |
|---|---|---|
| STR-001 | JSON parses with no duplicate object member names. | error |
| STR-002 | Declared instance discriminator matches the selected schema; schema dialect is Draft 2020-12. | error |
| STR-003 | All required root properties exist and have the declared types. | error |
| STR-004 | Unknown properties are rejected wherever `additionalProperties:false` applies. | error |
| STR-005 | Enum, pattern, length, numeric, date/date-time, and URI constraints pass. | error |
| STR-006 | Each union uses exactly one declared discriminator/shape. | error |
| STR-007 | Arrays that are structurally required nonempty are nonempty. | error |
| STR-008 | Numbers represented in parsed artifacts are finite JSON numbers. | error |
| STR-009 | Approved/published/retired calculator versions contain engine version, content, sources, governance, and test cases. | error |
| STR-010 | Approved measurement revisions contain the required governance structure. | error |
| STR-011 | Content contains structured blocks, claims, citations, authorship, review, SEO, and publication records. | error |
| STR-012 | Deprecated legacy fields are accepted only where the compatibility schema explicitly declares them. | warning |

Structural validation does **not** prove uniqueness across arrays, references, band correctness, source accuracy, clinical safety, or publishability.

## 3. Semantic validation (`SEM-*`)

Semantic validation proves that the artifact can execute deterministically according to the contract.

### Identity and references

| ID | Rule | Failure |
|---|---|---|
| SEM-001 | Calculator slug/version, parameter, formula, aggregate, domain, lookup, floor, adjustment, test, block, claim, and citation IDs are unique in their scopes. | error |
| SEM-002 | All parameter, aggregate, formula, domain, option, category, UI-group, measurement, claim, citation, related-content, and override references resolve. | error |
| SEM-003 | Generated or explicit formula runtime symbols are unique and do not collide with parameters, aggregates, or reserved symbols. | error |
| SEM-004 | Published references point to immutable version/revision IDs, not only mutable keys. | error |
| SEM-005 | Alias/former-key resolution is acyclic and has one canonical target. | error |

### Inputs and units

| ID | Rule | Failure |
|---|---|---|
| SEM-010 | Required fields imply `block`; every reachable optional scored parameter declares a missing policy. | error |
| SEM-011 | Select options and option-points mappings are unique and complete; Boolean scoring defines true and false. | error |
| SEM-012 | `defaultOption` exists in options and is used only with `default-option`. | error |
| SEM-013 | Every `impute-rule` target has exactly one applicable rule path and a reachable fallback policy. | error |
| SEM-014 | Canonical unit is defined; accepted unit codes are unique; factors are finite and positive; offsets are finite. | error |
| SEM-015 | Conversions are directional, invertible, dimension/analyte compatible, and resolve directly to canonical units. | error |
| SEM-016 | Hard and soft bounds are coherent in canonical units; integer-only/lattice declarations match accepted inputs. | error |
| SEM-017 | Composite representations use a declared typed adapter and valid component bounds. | error |

### Conditions, bands, and contexts

| ID | Rule | Failure |
|---|---|---|
| SEM-020 | Condition references exist at the stage where evaluated; operator and operand types are compatible. | error |
| SEM-021 | Condition depth/node resource limits pass. | error |
| SEM-022 | Bounds are coherent; explicit inclusivity flags do not contradict each other. | error |
| SEM-023 | Scoring, imputation, floor, and category bands do not overlap. Array order cannot resolve overlap. | error |
| SEM-024 | Reachable gaps are absent, proved unreachable by lattice/bounds, or explicitly marked `asWritten` with clarification references. | error |
| SEM-025 | Every applicable input selects exactly one scoring context or a deterministic flagged no-context outcome. | error |
| SEM-026 | At most one fallback context exists and no two explicit contexts can match the same supported context combination. | error |
| SEM-027 | Result categories cover the declared scale/lattice exactly once. | error |

### Graph, aggregation, and formulas

| ID | Rule | Failure |
|---|---|---|
| SEM-030 | Derived/formula/aggregate/imputation/floor dependency graph is acyclic and all dependencies are stage-valid. | error |
| SEM-031 | Expressions parse under the whitelist; identifiers/functions are allowed; AST/operation limits pass. | error |
| SEM-032 | Formula operations are type-correct and have no statically provable division/log/sqrt/pow domain failure. | error |
| SEM-033 | Every group declares a deterministic empty policy when empty is reachable. | error |
| SEM-034 | Group members consumed through `aggregateKeys` are not also direct domain contributions. | error |
| SEM-035 | Domain parameter/aggregate membership is unique and complete for intended scoring contributions. | error |
| SEM-036 | Domain weights are finite/nonnegative and sum to 1 within `1e-9`. | error |
| SEM-037 | Multi-domain calculators explicitly define zero-denominator and missing-domain behavior. | error |
| SEM-038 | Maximum-points calculation is finite and positive for every scorable domain/context. | error |
| SEM-039 | Lookup inputs/outputs are type-compatible; exact keys are unique; lower/upper sentinels are unique; no undeclared interpolation is required. | error |
| SEM-040 | Floor conditions are fully executable; tier matches are unambiguous; referenced parameters and final floor symbol resolve. | error |
| SEM-041 | Category override labels exist; result-band labels are unique and ordered best-to-worst. | error |
| SEM-042 | Exactly one `final-score` formula exists and every successful path produces a finite number. | error |
| SEM-043 | Static/reachable score analysis stays within declared scale unless an explicit approved clamp exists. | error |
| SEM-044 | Required source examples and saved test cases agree with the declared execution semantics. | error |

### Content and measurement semantics

| ID | Rule | Failure |
|---|---|---|
| SEM-050 | Content block IDs, claim IDs, and citation IDs are unique; all links resolve; no orphan medical claims/citations. | error |
| SEM-051 | Markdown/URLs/assets pass the allowlist; arbitrary HTML/JSON-LD is absent. | error |
| SEM-052 | Canonical path is normalized and unique; aliases redirect to one canonical page; related keys resolve. | error |
| SEM-053 | JSON-LD types are allowed and derivable from visible structured content. | error |
| SEM-054 | Reference ranges are structured, contextual, source-linked, and marked interpretation-only. | error |
| SEM-055 | Measurement derivations are executable, acyclic, dimensionally valid, and source-linked. | error |
| SEM-056 | Published calculator parameter snapshots agree with the recorded measurement/conversion revision hashes. | error |

## 4. Clinical validation (`CLN-*`)

Clinical validation is an evidence/reviewer judgment. Automation can identify missing evidence but cannot approve medicine.

| ID | Rule | Failure |
|---|---|---|
| CLN-001 | Niro scoring values agree with the original Niro artifact and precise locator, or an approved discrepancy disposition exists. | error |
| CLN-002 | External medical values/claims use allowed authoritative sources with exact claim attachment. | error |
| CLN-003 | Every threshold, conversion, formula coefficient, category, recommendation, and diagnostic-style statement has supporting evidence. | error |
| CLN-004 | `search-verified`, `blocked-cited`, `needs-verification`, expired, or superseded evidence is reverified before publication. | error |
| CLN-005 | Source conflicts remain separate, attributed, and reviewed; no synthetic merge is presented as sourced fact. | error |
| CLN-006 | Population, sex-at-birth, age, pregnancy, menopause, fasting, specimen, timing, and assay contexts are medically appropriate and complete. | error |
| CLN-007 | Missing-data, imputation, sparse-domain, no-score, floor, override, and clamping behavior has explicit medical approval. | error |
| CLN-008 | Result scale and category boundaries match source meaning across integer/fractional values. | error |
| CLN-009 | Educational/non-diagnostic wording and result recommendations are approved; urgent/crisis language is appropriate. | error |
| CLN-010 | Medical reviewer is authorized, independent under policy, and approval covers current protected hashes. | error |
| CLN-011 | Clinical/source review is current and not expired. | error |
| CLN-012 | Licensing/branding/permission requirements are clear and satisfied. | error |
| CLN-013 | A nonclinical fixture is explicitly labeled, `noindex`, unavailable as medical advice, and cannot transition to clinical publish state. | error |

An unresolved source ambiguity may be `accepted-with-evidence` only when the source owner and medical reviewer explicitly approve the chosen interpretation, affected paths and tests are recorded, and no higher-authority contradiction remains.

## 5. Publish eligibility (`PUB-*`)

Publish eligibility is computed from immutable evidence. No `publishEligible` field may be authored directly.

| ID | Gate |
|---|---|
| PUB-001 | Structural validation has zero open errors. |
| PUB-002 | Semantic validation has zero open errors. |
| PUB-003 | Clinical validation has zero open errors for every protected path/claim. |
| PUB-004 | Calculator lifecycle is `approved`; the transition to `published` is atomic and authorized. |
| PUB-005 | No open discrepancy marked `blocks-publication` affects the version. |
| PUB-006 | Medical/source approvals cover current logic, medical-content, citation-manifest, measurement-snapshot, and test-evidence hashes. |
| PUB-007 | All required tests pass. Clinical publication includes at least one complete source-worked example with complete inputs, expected final score and category, a precise current source locator, plus boundary evidence; a generic regression or partial-stage check cannot substitute. Optional test failure cannot be mislabeled required. |
| PUB-008 | Associated structured content and typed educational disclaimer exist and pass sanitization. |
| PUB-009 | SEO canonical/indexing/redirect/sitemap rules are coherent and result/share routes remain `noindex`. |
| PUB-010 | Every medical claim/value has allowed current evidence; source and license gates pass. |
| PUB-011 | Privacy classification, consent, retention, result-sharing, and PII linkage decisions required by this calculator are approved. |
| PUB-012 | Accessibility-critical content alternatives and crisis behavior, when applicable, pass required tests. |
| PUB-013 | Version is immutable, snapshots all runtime dependencies, and can reproduce saved golden results. |
| PUB-014 | A concurrent publish cannot create two current versions; audit and rollback evidence will be written atomically. |
| PUB-015 | Environment supports the declared engine/schema version and required feature flags. |

## 6. Layer outcomes for the current five configs

At P0A:

- All five parse and are evaluated as draft fixtures.
- Structural compatibility is tested against `calculator-version.v1`.
- All five fail at least one semantic and/or clinical rule.
- All five fail publish eligibility because content, review evidence, and required saved tests are absent.
- CWS additionally has an explicit source rejection blocker.
- COVID is intentionally nonclinical and cannot become a clinical publication without a new reviewed instrument/config version.

The detailed results and discrepancy IDs are in `../reports/five-config-validation.md` and `../registers/source-config-discrepancy-matrix.md`.
