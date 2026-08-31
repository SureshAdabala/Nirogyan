# P8 Niro reconciliation boundary

This directory is the safe, metadata-only P8 reconciliation package. It does not change a source fixture, clinical threshold, point value, formula, domain weight, result category, or measurement definition.

## Diabetes review preparation

`evidence/diabetes-risk/review-preparation.v1.json` is a strictly non-executable,
pointer-only intake template for `diabetes-risk`. It locks all 12 external Diabetes
blockers open, records the exact source/fixture/measurement-seed hashes, and labels the
two revision-3 measurement matches as unapproved and non-bindable. It contains no
clinical value, worked-example output, reviewer identity, approval, or lifecycle
instruction. Verify the fail-closed boundary with:

```text
npm run p8:diabetes-review:check
```

The human-readable authoritative-source comparison, exact owner decisions, boundary
matrix, measurement candidates, and immutable handoff sequence are in
`docs/operations/diabetes-risk-clinical-review-dossier-2026-08-30.md`.

## Inputs and immutable preflight

`niro-draft-overlays.v1.json` records SHA-256 hashes for all five configuration fixtures and both original Niro source artifacts. `scripts/reconcile-niro-drafts.ts` verifies every hash, the checked source-extract manifest, exact source locators, all calculator-specific discrepancy sets, and a disposition for every overlay discrepancy before producing any candidate. A mismatch stops the whole run. Only these four fixture paths are allowlisted:

- `diabetes-risk.config.json`
- `heart-risk.config.json`
- `hypothyroid-risk.config.json`
- `niro-cws.config.json`

COVID is deliberately excluded. Any catalog path is rejected, preserving the 62-calculator/79-measurement quarantine.

## Safe commands

```text
npm run p8:reconcile
npm run p8:divergence:check
npm run p8:readiness:check
```

The reconciliation command is dry-run by default. It prints deterministic candidate hashes and does not write a file or database. The divergence check proves the checked JSON and Markdown reports still match the deterministic source. The readiness check validates the exact external blocker/evidence-request register, re-runs all four validation layers for the four reconciled candidates, proves none is publication eligible, and verifies the checked readiness JSON/Markdown reports byte-for-byte.

Regenerating the two checked divergence reports is an explicit repository write:

```text
npm run p8:divergence:write
npm run p8:readiness:write
```

`niro-evidence-requests.v1.json` is deliberately non-executable. It records 56 current calculator-specific external blocker IDs and 20 source-owner, measurement-review, complete-worked-example, content/governance, and independent-medical-review requests. It contains zero accepted evidence or clinical values and cannot be imported into MongoDB. The workflow and safe intake boundary are defined in `packages/contracts/specs/p8-evidence-handoff.v1.md`; the generated state is in `packages/contracts/reports/niro-publication-readiness.v1.{json,md}`.

## Guarded admin-API import

There is one canonical live path: `scripts/import-niro-drafts-live.ts`. The older import branch in the reconciliation command is disabled. The live harness authenticates through the loopback Admin API, derives exact measurement bindings from persisted revision-3 seed records, preflights all four targets before the first write, durably rereads each create, redacts credentials/server bodies, and treats an exact existing version-1 draft as a no-op.

```text
npm run p8:drafts:import-live -- \
  --allow-live-draft-import \
  --expected-node-env=development \
  --expected-db-name=niro_dev \
  --api-url=http://127.0.0.1:4000
```

The root `.env` supplies `MONGODB_URI`, `MONGODB_DB_NAME`, `ADMIN_BOOTSTRAP_EMAIL`, and `ADMIN_BOOTSTRAP_PASSWORD`; those values must never be printed or committed. The local server must already be running against the exact named non-production database. The harness rejects production, non-loopback APIs, database/environment mismatches, unknown arguments, source/hash drift, incomplete measurement coverage, partial existing state, or any payload/binding drift.

The accepted 2026-08-28 run created exactly four Atlas version-1 drafts in `niro_dev`; the immediate rerun returned four exact no-ops. Heart has five and CWS has 40 exact unapproved draft revision-3 measurement snapshots. Diabetes and Hypothyroid have zero because their source configs contain no `biomarkerKey`; the importer does not invent relationships. The harness never verifies measurements, approves, publishes, retires, updates, or deletes records.

## Publication status

| Calculator | Safe automatic work | Publication status | Manual/clinical blocker |
|---|---|---|---|
| Diabetes | Source locator, all 14 calculator discrepancies, Atlas draft v1 with zero non-inferred bindings | blocked | Niro endpoints/PP Sugar, missing/partial behavior, population/context, reviewed content/evidence, complete source golden |
| Heart | Source locator, all 20 calculator discrepancies, partial 13→10 base-stage check, five exact draft snapshots | blocked | Sex applicability, interval/floor/endpoints, scope/cap, population/context, approved measurements/content/evidence, complete final source golden |
| Hypothyroid | Source locator, all seven calculator discrepancies, Atlas draft v1 with zero non-inferred bindings | blocked | Symptom grouping, unknown/partial behavior, score lattice/max/population, reviewed content/evidence, complete source golden |
| CWS | Source locator, all 20 calculator discrepancies, 40 exact draft snapshots, explicit rejection block | source-rejected draft | N1 stratified-range decision plus gaps/contexts/missing/category/content/approved-dependency/golden gates |
| COVID | None; outside Niro reconciliation | permanently nonclinical | Internal demo fixture only |

The Heart golden in `data/goldens/heart-base-stage.v1.json` asserts only the source-provided intermediate formulas `base-points=13` and `base-risk=10`. Its source omits required later-stage inputs and final expected output, so the artifact explicitly has `satisfiesPUB007=false`. `PUB-007` requires a complete source-worked example with complete inputs, expected final score and category, a precise verified source locator, and boundary evidence; a generic regression cannot substitute.

`CWS-02` is resolved without a clinical-value change: public copy must distinguish 38 measured labs, 40 scored parameters, and 49 total parameters, or omit a count claim. The rule does not approve any CWS score and the N1 source rejection remains absolute.

`CWS-17`/`MEAS-08` is resolved without a clinical-value change: the revision-3 core measurement migration records corrected CWS scoring provenance, exact source/version linkage, and all 45 current calculator references while retaining stale legacy fields only as provenance. All measurements and CWS remain draft/unreviewed, and the N1 source rejection remains absolute.

## Validator count reconciliation

The untouched five fixtures remain structurally valid and non-publishable. Strengthened rule coverage changes their error totals by rule identity, without changing a fixture:

| Fixture | P0A baseline | Current | Exact reason for delta |
|---|---:|---:|---|
| COVID | 15 | 21 | adds `PUB-006`, `PUB-013`, `PUB-015`, `PUB-010`, and two `CLN-004` findings for root sources with no verification status |
| Diabetes | 11 | 16 | adds `PUB-006`, `PUB-013`, `PUB-015`, `PUB-010`, and one `CLN-004` finding for a root source with no verification status |
| Heart | 11 | 16 | removes two false `SEM-031` findings for quoted lookup key `points-to-risk`; adds `PUB-006`, `PUB-013`, `PUB-015`, `PUB-010`, two `CLN-004` findings for root sources with no verification status, and one `SEM-023` for the preserved age-50 overlap in the SBP imputation bands |
| Hypothyroid | 13 | 19 | adds `PUB-006`, `PUB-013`, `PUB-015`, `PUB-010`, and two `CLN-004` findings for root sources with no verification status |
| CWS | 29 | 33 | adds `PUB-006`, `PUB-013`, `PUB-015`, plus `PUB-010` because the untouched CWS fixture has no root evidence manifest |

`PUB-006` is scoped approval evidence, `PUB-013` is dependency/reproducibility snapshot evidence, and `PUB-015` is supported engine-version evidence. The validator now also enforces governance/source/medical-review status, claim-linked citation verification/expiry/license, authorship/reviewer identity, and canonical/indexing/content-publication coherence when those objects exist.

Some gates cannot be proven by a standalone JSON document and remain enforced by the admin lifecycle/infrastructure: review binding to current protected hashes, actual persisted test-run success, concurrent current-version publication (`PUB-014`), and deployment privacy/accessibility controls (`PUB-011`/`PUB-012`). The validator does not invent fields or claim those external gates passed.
