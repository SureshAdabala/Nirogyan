# Calculation engine semantic contract v1

**Semantic version:** `1.0.0`  
**Schema:** `../schemas/calculator-version.v1.schema.json`  
**Normative status:** locked by P0A  
**Implementation status:** implemented in `packages/engine` as deterministic semantic v1; this specification remains the authority for every execution rule

The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative. A calculator may be structurally valid while failing this semantic contract. Drafts may be retained with semantic failures; approved, published, and retired versions must have passed the rules that were current when they were approved.

## 1. Determinism and authority

1. The server is the authoritative executor. A browser may mirror visibility and field validation for UX but cannot produce the authoritative score.
2. Execution is a pure function of the immutable calculator version, its declared semantic version, canonicalized inputs, and referenced immutable measurement revisions.
3. No stage may read mutable database state, current time, locale defaults, environment variables, network resources, or random values.
4. The full internal trace is retained for authorized audit but is never included in the public calculator projection.
5. There is no implicit clinical correction, fallback, interpolation, clamping, or coercion. Unresolved meaning produces a validation error, no-score state, or publish blocker as specified below.

## 2. Value and number model

- JSON input values are strings, booleans, or finite numbers. `NaN`, positive/negative infinity, numeric strings, and empty strings are rejected.
- Runtime arithmetic uses IEEE-754 binary64 consistently on the authoritative Node runtime.
- The engine performs no intermediate rounding, threshold tolerance, or epsilon comparison. Display rounding occurs only after categorization and never changes a score or category.
- `round(x, n)` is an explicit formula operation and uses decimal half-away-from-zero at `n` decimal places. It changes the formula value because the author explicitly requested it.
- Unit conversions use `canonical = entered × factor + offset`. They are not rounded before validation or scoring.
- Division by zero, an invalid logarithm/square-root domain, overflow to a nonfinite number, or a result magnitude greater than `1e15` is an execution error.
- Result scale bounds are assertions, not clamps. A reachable value outside the declared scale is a semantic error unless the config explicitly declares `scale.clamp:true`; medical calculators must obtain clinical approval for any clamp.

## 3. Identifier namespaces

The following namespaces are unique within one calculator version:

- parameter keys
- aggregate keys
- domain keys
- lookup-table keys
- adjustment-rule keys
- floor-rule keys
- formula keys and formula runtime symbols

Parameter, aggregate, and formula runtime symbols share one expression namespace and therefore may not collide.

For compatibility with the five P0A fixtures, a formula without `symbol` receives a deterministic lower-camel alias from its kebab-case key: `base-points → basePoints`, `raw-score → rawScore`. A configured `symbol` overrides only that formula's generated alias. Alias collisions are semantic errors. New Studio output SHOULD write `symbol` explicitly.

Reserved symbols are:

- `points` — scoped direct point contributions
- `maxPoints` — scoped possible points after applicability/missing rules
- `domains` — scored domain records
- `adjustments` — applied adjustment records
- `floorPenalty` — maximum applicable numeric floor

`final-score` is the required final formula key. Its runtime symbol is `finalScore`.

## 4. Dependency graph and execution order

The apparent linear pipeline is implemented as a dependency graph because an imputation may depend on a scored aggregate. The normative order is:

1. Validate calculator structure and semantics.
2. Reject unknown input keys; type-check entered values and unit codes.
3. Normalize units.
4. Apply hard validation bounds in canonical units; record soft warnings separately.
5. Resolve server-side visibility/applicability.
6. Apply blocking/default missing policies that do not depend on calculated values.
7. Evaluate derived parameters topologically.
8. Select scoring contexts for available parameters and score available direct parameters.
9. Compute prerequisite aggregates needed by imputation conditions.
10. Apply dependent imputations topologically.
11. Recompute affected contributions and finalize aggregates.
12. Compute domain numerators, possible points, coverage, and domain scores.
13. Evaluate formulas topologically, including weighted domain formulas.
14. Apply adjustment rules.
15. Evaluate floor rules and the final formula.
16. Categorize the final score and apply category-severity overrides.
17. Rank harmful and protective contributors separately.
18. Emit result and ordered trace.

A dependency cycle between derived values, aggregates, imputations, formulas, floors, or overrides is a semantic error. Evaluation may not depend on declaration order.

## 5. Input, units, applicability, and missing values

### 5.1 Unit normalization

- A number supplied without a unit is interpreted in the parameter's canonical unit.
- A supplied unit must be the canonical code or a declared allowed code.
- The canonical code has the implicit transform `factor=1, offset=0`; it need not be repeated in `allowed`.
- Conversion factors must be finite and greater than zero. Offset is finite and defaults to zero.
- Unit aliases and composite input parsing are governed by the measurement contract, not inferred from strings.
- The entered value/unit, canonical value/unit, conversion contract version, and conversion hash must be retained with an assessment.

### 5.2 Applicability

The server reevaluates `visibility`. A false visibility condition means the parameter is not applicable. Stale submitted values for a non-applicable parameter are ignored, never scored, and recorded in trace; they are not treated as malicious unknown keys.

Until a separate applicability condition is added in a later schema version, `visibility` is both presentation visibility and applicability. A medical config that needs different concepts must use a new schema version rather than relying on UI behavior.

### 5.3 Missing policies

Missing is distinct from `false`, zero, an empty string, and an unknown select option.

| Policy | Normative behavior |
|---|---|
| `block` | Stop with a field error. A parameter with `validation.required:true` is equivalent to `block`. |
| `default-option` | Insert the declared option only when input is absent; the option must exist and the imputation is traced. |
| `impute-rule` | Exactly one applicable imputation action supplies points. A `fallbackPolicy` is required when no action may match. |
| `exclude-from-max` | No earned points and no possible points; coverage decreases. |
| `exclude-from-group` | Remove the member from its group aggregate. |
| `zero-points` | Contribute zero earned points while retaining the applicable maximum in coverage/denominator. |
| `not-applicable` | No earned or possible points; excluded from coverage denominator and reported separately from missing. |

An optional scored parameter without an explicit missing policy is a semantic error. A missing boolean is never converted to `false`. A select option named `unknown` is an authored value and receives only its explicitly configured points; it must not be synthesized from an absent input.

Derived values become missing when any required dependency is missing or not applicable. The derived parameter's missing policy then controls the result.

## 6. Condition DSL

Conditions contain `all`, `any`, `not`, or one predicate. Supported predicate operators are:

`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `not-in`, `exists`, `missing`.

Rules:

- `all` and `any` evaluate left-to-right only for trace; their truth value has ordinary Boolean semantics.
- A predicate referencing a missing value evaluates `false`, including `ne`. Only `exists` and `missing` inspect absence directly.
- Comparisons do not coerce types.
- `in` and `not-in` require an array operand.
- A condition reference must resolve to a declared parameter, aggregate, or formula symbol available at that stage.
- Resource limits: maximum condition nesting 32 and maximum 256 condition nodes per calculator version.

## 7. Bands and contexts

### 7.1 Boundaries

Default `bandEdges:"min-inclusive"` means `[min,max)`:

- lower bound inclusive
- upper bound exclusive
- omitted or `null` bound open

`minExclusive`, `minInclusive`, `maxExclusive`, and `maxInclusive` override their respective defaults. Contradictory flags on one bound are semantic errors.

Array order never resolves overlap. At a given value exactly one band must match. Overlap is always an error.

A gap is allowed only when the affected rule/context carries `asWritten:true` and at least one `clarificationRefs` value. Entering a value in such a gap yields a deterministic `NO_SCORING_BAND` no-score trace for that parameter; it never yields zero points. A gap may alternatively be proved unreachable by an explicit input lattice such as integer-only input or a result `scoreLattice`.

### 7.2 Context selection

- Evaluate non-null contexts first.
- Exactly one explicit context may match.
- A single `when:null` context is the fallback only when no explicit context matches.
- More than one match is an ambiguity error.
- No match and no fallback yields `NO_SCORING_CONTEXT`, not zero points.
- A context referring to an absent selector does not match.

### 7.3 Option points

Every authored option of a scored select parameter must have exactly one option-points entry. A Boolean scoring rule must explicitly define both `true` and `false`. Unknown option values are input errors.

Negative points are valid and retained as protective contributions.

## 8. Aggregation, maximum points, and coverage

### 8.1 Parameter groups

Group operations are `max`, `min`, `sum`, and `mean` over present scored members after member missing policies.

- `max(empty)`, `min(empty)`, `sum(empty)`, and `mean(empty)` are missing by default, not zero.
- A group must declare `emptyPolicy` when an empty group is reachable.
- A member consumed through a domain's `aggregateKeys` is not also counted as a direct contribution.

### 8.2 `sum(points)`

- In `per-domain` scope, it means unique direct contributions listed in that domain's `parameterKeys` plus the domain's finalized aggregate contributions.
- In global scope, it means unique direct contributions referenced by domains plus finalized aggregates referenced by `aggregateKeys`.
- Raw parameter members consumed by an aggregate are excluded from global/direct sums.
- Imputed contributions are included once and marked as imputed.

This definition makes the Diabetes formula `sum(points) + glycemicIndex` executable without double-counting the three laboratory component scores, because those components are consumed by the `glycemicIndex` aggregate rather than listed as direct domain parameters.

**Implementation clarification (P2):** the reserved `points` runtime array contains
unique direct contributions only. A finalized aggregate is exposed under its
declared aggregate key and is included only when the authored formula references
that key (for example, `glycemicIndex` above). Raw aggregate members are never
implicitly re-added. This resolves the otherwise ambiguous wording while
preserving the source-authored Diabetes formula and its no-double-counting rule.

### 8.3 Maximum points

For each applicable, supplied or included parameter, possible points are the greatest points reachable in its selected context. Protective negative values do not reduce the maximum. For a `max` aggregate, possible points are the maximum of its included members' possible points. Excluded/not-applicable values contribute neither earned nor possible points.

`domainScore = sum(points) / maxPoints × 100` only when `maxPoints > 0`. A zero-denominator domain is unscored, never zero.

### 8.4 Missing domains

A multi-domain config must explicitly choose one policy in `domainAggregationPolicy.missingDomainPolicy`:

- `block` — no final score unless all required domains are scorable
- `exclude-and-renormalize` — remove unscored domains and renormalize remaining weights to 1
- `zero-contribution` — keep their weights and contribute zero; clinically risky and publish-blocked unless specifically approved
- `no-score` — return domain detail but no overall score

No current CWS config field chooses this policy; that is a semantic and publication blocker.

Coverage is reported independently as supplied/applicable scorable count and possible-weight coverage. It must accompany any partial result and is never presented as confidence unless a reviewed confidence model exists.

Domain weights must be finite, nonnegative, and sum to 1 within `1e-9`. Negative domain scores are preserved unless an explicit, clinically approved clamp is configured. The engine has no implicit zero clamp.

## 9. Derived values and expression language

Allowed tokens:

- numeric, Boolean, and string literals
- declared identifiers and reserved symbols
- parentheses
- `+`, `-`, `*`, `/`
- `<`, `<=`, `>`, `>=`, `==`, `!=`
- ternary `condition ? a : b`

Allowed functions in semantic v1:

- numeric: `min`, `max`, `abs`, `round`, `pow`, `sqrt`, `ln`, `log10`, `exp`
- engine aggregates: `sum`, `weightedSum`
- table access: `lookup`

Forbidden: property access, indexing, assignment, statements, loops, user-defined functions, dynamic function names, date/time, network access, randomness, and arbitrary code evaluation.

Limits:

- expression length 2,048 characters
- at most 256 AST nodes per expression
- nesting depth 32
- at most 100 formulas plus derived expressions per version
- at most 10,000 evaluated AST operations per assessment

`pow` follows mathematical real-number behavior supported by binary64, including fractional and negative exponents, and errors when no finite real result exists.

## 10. Imputation semantics

An imputation rule applies only when its target is missing and its `when` condition is true. Exactly one rule may apply to a target at a time.

- `setPoints` supplies the target's contribution directly.
- `setPointsByBand` selects exactly one band using the other declared parameter's canonical value.
- Imputation does not fabricate a raw measurement value.
- An aggregate-dependent imputation declares a dependency on that provisional aggregate; the DAG evaluates it after available group members are scored.
- If no imputation rule applies, use the target's required `fallbackPolicy`; absence of a reachable fallback is a semantic error.

## 11. Lookups, adjustments, floors, and overrides

### 11.1 Lookups

`lookup(table, value)` performs an exact match. Semantic v1 does not interpolate.

- At most one row may declare `orBelow` and at most one `orAbove`.
- Exact rows must be unique.
- Endpoint sentinel rows cover values beyond the table only in their declared direction.
- A display string such as `<1` or `>30` is not a numeric value. If later arithmetic requires a numeric proxy, that proxy is a clinical assumption requiring a discrepancy and approval.

### 11.2 Adjustments

Band and option adjustments use the same boundary and option semantics as scoring rules. `sum(adjustments)` contains each applicable adjustment once. Negative adjustments remain protective.

### 11.3 Floors

Floor conditions are executable JSON only; prose in `description` has no effect. For every applicable floor rule:

1. Find all matching tiers.
2. Retain every matched message for audit/presentation.
3. Set that rule's floor to the maximum matched `floorPct`.
4. Set reserved `floorPenalty` to the maximum across applicable floor rules, or zero when none apply.

Ambiguous tier overlaps remain semantic errors even though the maximum operation is deterministic.

### 11.4 Category overrides

First categorize the numeric final score. Then evaluate overrides. Result bands are declared from best/lowest-severity to worst/highest-severity regardless of numeric direction. `minCategory` raises severity to that label or leaves a worse category unchanged; it never changes the numeric score. Labels must be unique and referenced exactly.

## 12. Result categorization

- Exactly one result band must match every value allowed by the declared scale unless a source-preserved gap is explicitly flagged.
- Boundary rules are identical to scoring-band rules.
- `scoreLattice` may prove a numeric interval unreachable; otherwise continuous coverage is required.
- Direction affects presentation and contributor language, not numeric band membership.
- Display rounding occurs after band selection.
- A score outside the asserted scale is `SCALE_ASSERTION_FAILED`, not silently moved to an endpoint.

## 13. Contributors and trace

Harmful and protective contributions are separate ordered lists:

- harmful: positive contribution descending, stable tie-break by parameter key
- protective: negative contribution ascending, stable tie-break by parameter key
- zero/no-score/missing/not-applicable values are explanatory records, not ranked contributors

Every execution emits an ordered trace record with at least:

`sequence`, `stage`, `ruleRef`, `inputRefs`, `enteredValue`, `canonicalValue`, `conditionResult`, `selectedContext`, `selectedBandOrOption`, `earnedPoints`, `possiblePoints`, `output`, `status`, `sourceRefs`, and `message` as applicable.

The persisted result snapshots:

- calculator slug/version/schema/semantic version and content version
- measurement revisions and conversion hashes
- entered and canonical inputs
- derived values
- scored/no-score/missing/not-applicable/imputed contributions
- group/domain calculations and coverage
- adjustments, formulas, floors, category and overrides
- complete internal trace

Public responses are a sanitized projection and never include proprietary thresholds, points tables, formulas, lookup contents, or the internal trace.

## 14. Failure classes

| Code | Meaning |
|---|---|
| `CONFIG_STRUCTURAL_INVALID` | JSON Schema failure |
| `CONFIG_SEMANTIC_INVALID` | reference, coverage, DAG, range, scale, or contract failure |
| `INPUT_INVALID` | unknown key, wrong type/unit, or hard-bound failure |
| `INPUT_REQUIRED` | blocking value missing |
| `NO_SCORING_CONTEXT` | no context matched |
| `NO_SCORING_BAND` | value falls in an approved source-preserved gap |
| `AGGREGATE_EMPTY` | empty group lacks an explicit policy |
| `DOMAIN_UNSCORABLE` | zero denominator or unresolved missing-domain policy |
| `FORMULA_DOMAIN_ERROR` | invalid arithmetic domain/nonfinite result |
| `LOOKUP_MISS` | no exact/sentinel lookup row |
| `SCALE_ASSERTION_FAILED` | reachable/result value outside declared scale |

User-correctable input errors map to field-level 422 responses. Configuration and execution-contract errors are server/configuration failures, block publication, and must not be presented as a user's medical result.

## 15. Consequences for the five P0A fixtures

- Kebab-to-camel aliasing binds Heart's `basePoints`, `baseRisk`, `sLipid`, `mYoung`, `adjustedRisk`, and CWS `rawScore`; `floorPenalty` is the reserved floor output.
- Diabetes aggregate-dependent waist imputation is executable only through the dependency order above.
- Diabetes must add an empty-group and imputation fallback policy before semantic pass.
- Missing Boolean policies in COVID and Hypothyroid are semantic failures; absence is not false.
- CWS must choose a missing-domain policy and annotate source-preserved gaps before semantic pass.
- No implicit clamping resolves CWS or Heart scale mismatches. Those remain source/config discrepancies.
