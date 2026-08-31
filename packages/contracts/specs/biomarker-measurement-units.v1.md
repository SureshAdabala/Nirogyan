# Biomarker, measurement, and unit contract v1

**Schema:** `../schemas/measurement-definition.v1.schema.json`  
**Normative status:** locked by P0A  
**Legacy inputs:** `data/fixtures/config-samples/biomarker-dataset.json` and `data/catalog/measurements-reference-extension.json` do not yet conform and must not be bulk imported.

## 1. Identity and versioning

1. A **measurement** is the common entity. Laboratory biomarkers, vitals, anthropometrics, derived measurements, questionnaire responses, and contextual selectors are measurement kinds.
2. Every measurement has a stable lowercase kebab-case `key` and positive immutable `version`.
3. Renames use `formerKeys` and aliases. An existing key is never silently repurposed for a different analyte, specimen, method, or dimension.
4. Calculator parameter keys are local to a calculator and may remain camelCase. A medical parameter links explicitly to a measurement via `biomarkerKey`/future `measurementKey` plus an immutable measurement revision.
5. Published calculator versions snapshot their parameter label, help, units, conversions, bounds, and medical sources. The mutable library is a Studio prefill/navigation source, never a live scoring dependency.
6. A result records the measurement revision and conversion hash used for every linked input.

## 2. Concepts that must remain separate

The following are different data types and cannot be copied between one another automatically:

1. **Hard input bounds** — impossible/unsafe engineering values; block entry.
2. **Soft input bounds** — unusual but possible values; warn without changing the value.
3. **Reference intervals** — informational laboratory/population ranges.
4. **Diagnostic classifications or treatment targets** — contextual medical statements.
5. **Calculator scoring bands** — immutable logic belonging to one calculator version.

Reference intervals are never executable scoring defaults. A Studio author may deliberately create a scoring rule from an evidence source, but that creates a separately cited calculator rule and requires medical review.

## 3. Canonical measurement record

`measurement-definition.v1` requires:

- stable identity and lifecycle
- kind and value type
- canonical unit and controlled accepted units
- explicit directional conversions
- hard and optional soft bounds
- structured, contextual, source-linked reference ranges
- sources and review status
- executable derivation metadata for derived measurements

Core context vocabulary includes:

- sex at birth, distinct from gender identity
- age
- pregnancy and menopausal status
- fasting/preparation state
- specimen type
- sample timing
- assay/method
- population

The five current configs retain their legacy parameter key `sex` for compatibility. Before publication, each calculator must document whether it means sex at birth, current physiology, administrative sex, or another context.

## 4. Unit identity

1. Unit codes are controlled identifiers normalized to Unicode NFC. Display labels and aliases are separate fields.
2. Equivalent spelling aliases, such as `µIU/mL` and `mIU/L` when dimensionally identical for the declared analyte, are reviewed aliases—not string replacements guessed by the engine.
3. A conversion is valid only between dimensionally compatible values for the same measurement/analyte.
4. Molar-to-mass conversion factors are analyte-specific because molecular mass is part of the conversion. They are never registered as global `mmol/L ↔ mg/dL` rules.
5. A unit code must not contain arrows, prose, conditions, dosage assumptions, serving sizes, or component instructions.

## 5. Directional conversion

The single v1 equation is:

```text
canonicalValue = enteredValue × factor + offset
```

Rules:

- `fromUnit` is the entered unit.
- `toUnit` must equal the measurement's canonical unit.
- `factor` must be finite and greater than zero.
- `offset` must be finite; zero represents a linear conversion.
- The canonical unit has identity conversion factor 1 and offset 0.
- Inverse display conversion, when needed, is `(canonicalValue - offset) / factor`.
- Input is type-checked and the unit code accepted before conversion.
- Hard/soft bounds are evaluated after conversion in canonical units.
- No intermediate rounding occurs. Display formatting does not change stored or scored values.
- Persist entered value/unit, canonical value/unit, measurement version, and conversion hash.
- Duplicate `fromUnit` definitions or more than one route to the same canonical unit are semantic errors.

The legacy calculator shape `{code, factor}` is interpreted only as `{fromUnit:code, toUnit:canonical, factor, offset:0}`. This compatibility rule applies to the five config fixtures, not to new measurement records.

### Examples

```text
inches to centimetres:       cm = in × 2.54 + 0
fahrenheit to celsius:       °C = °F × (5/9) - 17.77777777777778
millimoles/L cholesterol:    mg/dL = mmol/L × analyte-specific factor + 0
```

Heart's source-specific cholesterol factor `38.61` and the CWS/library factor `38.67` remain separate, cited snapshot values. The runtime calculator snapshot wins; the library may not overwrite it.

## 6. Composite representations

`ft+in` and `st+lb` are multi-component inputs, not unit codes with one multiplicative factor.

Semantic v1 recognizes only typed composite adapters:

- `feet-inches-to-centimetres`
- `stone-pounds-to-kilograms`

Each receives two named finite numeric components, validates component bounds, and returns the canonical unit. A calculator that does not explicitly declare a composite adapter cannot accept the composite representation.

Formula coefficients, caffeine serving amounts, dosage multipliers, and component conversions attached to a derived BMI record are not unit conversions.

## 7. Reference ranges and evidence

Each reference range is structured and includes:

- stable ID and label
- unit and exact boundary inclusivity
- population/method/specimen/preparation context
- source claim IDs
- review expiry where applicable
- `interpretationOnly:true`

Conflicting organizations' ranges remain separate. They may share a `conflictGroup`, but the platform never averages or merges them. A lab-supplied reference interval takes precedence for user-facing interpretation when the product supports it; it does not modify calculator scoring.

Every numeric value must link to the claim/source that supports it. A bibliography attached only to the whole measurement record is insufficient for publication when different sources support different ranges or conversions.

## 8. Derived measurements

A derived measurement requires:

- safe expression under the engine grammar
- explicit dependencies
- output unit
- source claims
- semantic version

Dependencies form an acyclic graph. Prose such as `none (direct measurement)` is not a derivation and must be removed during migration.

## 9. Core dataset disposition

The 40-record core dataset is the only candidate baseline for P6 after migration and review.

Known cleanup required before seeding:

- stale `niroScoring` text says the scoring sheet was unavailable even though the Risk Analysis sources later arrived
- `usedIn` metadata is incomplete
- source claims are not linked at per-value granularity
- ranges and scoring provenance need the new structured separation
- the TSH unit alias needs explicit normalization

All 45 `biomarkerKey` references in the five configs resolve to the core dataset. That referential success does not make the mutable library a runtime scoring source.

## 10. Measurement-extension quarantine

The 79-record extension remains research-only until it is migrated and passes all four validation layers. No P0A file changes its medical or conversion values.

At least these reciprocal/direction defects are recorded for reviewed correction:

| Records | Stored factor problem under entered × factor → canonical |
|---|---|
| hematocrit | L/L → % stored `0.01`; expected direction requires ×100 |
| MCHC | g/L → g/dL stored `10`; expected direction requires ×0.1 |
| five absolute WBC differentials | 10^9/L → cells/µL stored `0.001`; expected direction requires ×1000 |
| serum iron, TIBC | µmol/L → µg/dL stored about `0.179`; expected direction requires about ×5.587 |
| total calcium | mmol/L → mg/dL stored `0.2495`; expected direction requires about ×4.008 |
| phosphate | mmol/L → mg/dL stored `0.3229`; expected direction requires about ×3.097 |
| VLDL cholesterol | mmol/L → mg/dL stored `0.02586`; expected direction requires about ×38.67 |
| ALP, amylase, lipase, LDH | µkat/L → U/L stored `0.0167`; expected direction requires ×60 |
| direct and indirect bilirubin | µmol/L → mg/dL stored `17.104`; expected direction requires about ×0.0585 |
| total protein and globulin | g/L → g/dL stored `10`; expected direction requires ×0.1 |

Additional blockers:

- fasting-insulin factor `0` is an unresolved sentinel
- temperature cannot use the current slope-only representation
- `ft+in` and `st+lb` are falsely represented as factors
- pre-pregnancy BMI carries component conversions on a derived output
- caffeine coefficients are mislabeled conversions
- several renal/water records mix conversion directions
- ranges/conflicts/derivations remain free text
- imported active hosts would lose nested `mergedFrom` functionality and citations

These findings are data-integrity discrepancies, not authorization to modify clinical values. Catalog repair is a separately reviewed post-P0A workstream and remains a hard prerequisite to bulk import.

## 11. Validation and publication rules

Structural validation checks shape, field types, keys, lifecycle values, and finite conversion fields.

Semantic validation additionally checks:

- unique and resolvable identifiers
- exactly one identity/canonical route
- invertible and dimension-compatible conversions
- no factor zero
- derivation DAG
- coherent context/range boundaries
- per-value source references
- immutable measurement revision references in published configs

Clinical validation checks source fidelity, analyte/method/population applicability, conflicts, factor agreement, and medical review.

Publication requires all three layers plus publish eligibility. `search-verified`, `blocked-cited`, and `needs-verification` numeric medical values are publish blockers until reverified under the sourcing policy.
