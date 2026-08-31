# Niro canonical contracts

**Contract release:** P0A v1 plus additive phase-boundary contracts  
**Status:** P0A v1 clinical/calculation meaning remains locked; compatible administrative, public API, biomarker-library, and analytics boundary specifications are maintained through P9. Clinical issues remain governed by the discrepancy register.  
**Scope:** canonical schemas and normative specifications. Application implementation remains in the workspace packages/apps.

This package began as the normative output of P0A and remains the shared contract boundary. It reconciles the canonical root plan with the five draft calculator configurations, Niro source artifacts, the 40-record biomarker library, the 79-record measurement extension, research documents, architecture documents, catalog audit, and the additive P3/P4/P6/P8/P9 API and governance decisions.

## Normative artifacts

### Machine-readable schemas

- `schemas/calculator-version.v1.schema.json` — strict structural contract for a calculator version and every primitive used by the five current configs.
- `schemas/measurement-definition.v1.schema.json` — canonical measurement/biomarker record and directional conversion contract. The existing two legacy datasets require migration before they conform.
- `schemas/content-page.v1.schema.json` — calculator-associated content, SEO, claim-level citations, authorship, publishing, and medical-review contract.

### Semantic specifications

- `specs/engine-semantics.v1.md` — deterministic execution semantics, expression grammar, missing-data behavior, bands, aggregation, formulas, categories, floors, trace, and failures.
- `specs/biomarker-measurement-units.v1.md` — measurement identity, range provenance, canonical units, linear/affine/composite conversion, storage, and migration rules.
- `specs/biomarker-library.v1.md` — P6 draft-only core migration, integrity gates, reviewed-only queries, safe relations, and public range/provenance presentation.
- `specs/content-governance.v1.md` — structured content, sanitization, SEO, citations, authorship, review, expiry, and publication rules.
- `specs/admin-api.v1.md` — P4 administrative authentication, RBAC, lifecycle/concurrency, preview/test, measurement revision, rollback, audit, and publication-invalidation boundary.
- `specs/public-api.v1.md` — active P3 public endpoint, projection, idempotency, caching, privacy, and reproducibility boundary.
- `specs/analytics.v1.md` — P9 first-party event semantics, privacy-safe identity, retention, cohort-safe rollups, jobs, dashboard APIs, exports, and operational reporting.
- `specs/validation-layers.v1.md` — structural, semantic, clinical, and publish-eligibility validation with stable rule identifiers.

### Evidence and decisions

- `reports/five-config-validation.md` — P0A validation results for all five current configuration files; no clinical value was changed.
- `reports/niro-external-divergence.v1.json` and `.md` — deterministic P8 Niro-versus-external divergence output generated from the checked source register.
- `data/reconciliation/README.md` (repository root) — P8 allowlists, byte-preservation boundary, metadata-only overlays, and guarded draft-import evidence.
- `registers/source-config-discrepancy-matrix.md` — source-versus-config discrepancies and their publication impact.
- `registers/architecture-decision-register.md` — decisions locked from P0A through P9 and explicitly deferred decisions with downstream deadlines.

## Authority and precedence

When sources conflict, use this order:

1. Original Niro clinical artifacts in `data/sources/risk-analysis/` for Niro-defined scoring.
2. Explicit, later client decisions recorded in `Claude-Context.md` and the canonical `Implementation-Plan.md` for product and architecture.
3. Fetch-verified authoritative medical sources for externally defined claims.
4. Current machine-readable draft configs and datasets as transcriptions of the above, never as authority over an original source.
5. Archived reports, backups, generated documents, and prose catalog records as historical evidence only.

No ambiguity may be silently resolved by an engine default. An unresolved clinical ambiguity is represented by a discrepancy ID and blocks publication when the validation policy says it does.

## Versioning rule

`v1` is immutable after P0A approval except for corrections that do not change meaning. Any change to accepted structure or execution meaning requires a new schema/semantic version and an explicit migration. Published calculator versions record the exact schema ID, semantic version, content version, measurement revisions, test evidence, and review evidence used to publish them.

## Current compatibility result

The five legacy draft configs are intentionally left untouched. They are assessed against this contract in `reports/five-config-validation.md`. Structural compatibility does not mean clinical or publish eligibility: all five remain non-publishable for documented reasons. P8 derived exactly four metadata-overlaid application drafts for guarded import into `niro_dev`; those derived drafts preserve the source clinical fields, remain unpublished, and do not confer measurement verification or medical review. The COVID fixture remains internal/nonclinical, and the quarantined catalog remains unimported.
