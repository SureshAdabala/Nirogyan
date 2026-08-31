# Engineering handover

## Purpose and authority

This document lets a new engineer reproduce the repository state without relying on chat history. `Implementation-Plan.md` is the canonical phase plan. P0A schema/specification files and registers in `packages/contracts/` govern calculation meaning, validation, publication, and clinical discrepancies. Source artifacts and their checked hashes outrank narrative summaries.

The supplied workspace has no `.git` metadata. Restore it from the owner-provided repository before expecting commit history, branch comparisons, or a config-only Git diff. Until then, recorded SHA-256 tree evidence is the only repository-local change proof.

## Current checkpoint

- P0A–P7 and P9 are complete.
- P8 repository engineering is complete; all four clinical candidates remain application drafts and publication-blocked.
- P10 is complete locally. The final post-hardening durable Atlas/production-standalone/Playwright/k6 evidence is under `docs/operations/evidence/p10/p10-1498c9b1042bee8c7d43a4af0443e9-374bf8c3/`; guarded cleanup completed, protected hash `c6316303cc13dc4f67ac137bc5e0c8db4af81f2cad7f5941660611c74f83b9df` was unchanged, and the self-generated manifest covers 44 retained artifacts plus local release/runtime identity. The run also exercised one real leased/HMAC-signed cache-invalidating publication event with zero failures. All 44 copied archive files hash-match the generated source archive, and the exact owned database namespace was verified absent. Earlier P10 archives remain retained for provenance.
- P11 selects Render native Node for the API/jobs and prepares the Vercel Next.js frontend contract in `apps/client/vercel.json`, with Render's native Next service retained as a fallback. It includes build, workload, scheduling, health, metrics, cache-invalidation, deploy verification, recovery verification, and runbooks. No provider staging/production deployment or restore drill is claimed.
- P12 repository documentation and an owner-addressed readiness register are present. Launch is blocked by the unchecked external gates in `launch-readiness.md`.
- The research catalog remains quarantined; bulk import is outside P0B–P12.

## First-hour verification

1. Install the Node/npm versions described in the root `package.json`, run `npm ci`, and create an ignored `.env` from `.env.example`.
2. Run `npm run contracts:check-generated`, `npm run fixtures:validate`, `npm run measurements:integrity`, `npm run p8:divergence:check`, and `npm run p8:readiness:check`.
3. Run `npm run check`, `npm run build`, `npm audit`, and `npm audit --omit=dev`.
4. Verify `MONGODB_DB_NAME` before any database command. Run the read-only ping first. Do not continue a fixture workflow if the resolved database differs from its exact expected name.
5. Review `packages/contracts/reports/niro-publication-readiness.v1.md` and `launch-readiness.md`. Never convert an unchecked item into a pass based on a local template or assumption.

## Local application walkthrough

1. Seed only missing draft measurement records with the dry run and explicit apply commands documented in the root README.
2. Bootstrap one admin account in the intended non-production database. Create separate `editor` and `medical-reviewer` accounts through the admin user UI/API when testing independent review; do not share credentials or let an editor self-approve.
3. Start `npm run dev`; verify `/healthz`, `/readyz`, the public directory, `/biomarkers`, `/admin/login`, Calculator Studio, and `/admin/analytics`.
4. Use the Studio workflow described in the README with a synthetic nonclinical definition. Do not copy an unresolved Niro threshold into a passing test or approval.
5. Confirm preview and public assessment use the same engine version. Check immutable version history, protected-hash invalidation after edits, ETags, rollback-as-new-version, audit records, and cache-invalidation records.

## Safe database acceptance

Integration harnesses either use transaction-scoped records or an exact owned temporary database name with the harness-specific random suffix. A temporary database may be removed only after its manifest, identity, and expected collection cardinalities prove ownership. If setup or cleanup is interrupted:

1. Record the exact nonce and expected database name from the evidence directory.
2. Reconnect with the same Atlas environment and run the fixture's read-only ownership inspection. The former interrupted P10 run in this workspace was already resolved using:

   ```powershell
   $env:MONGODB_DB_NAME = 'niro_p7_df0429f040fec8e84f41fdb3582eae'
   npx tsx scripts/p7-browser-fixture.ts inspect df0429f040fec8e84f41fdb3582eae
   ```

   Continue only if the JSON says `ownershipVerified:true` with `issue:null`.

3. Run its guarded cleanup command only when ownership verification returns clean. The command below is retained as historical evidence; do not rerun it after the database has been confirmed absent.

   ```powershell
   npx tsx scripts/p7-browser-fixture.ts cleanup df0429f040fec8e84f41fdb3582eae --allow-temporary-database-write
   ```

   Close that shell afterward or restore `MONGODB_DB_NAME` before any other application command.

4. Preserve the evidence and report the database as unverified if connectivity prevents inspection. Never guess ownership or use a broad database-name pattern to delete data.

The transaction, public API, and P4 admin integration commands now also require
`--allow-temporary-database-write` and reject `NODE_ENV=production` before
connecting. P4 additionally uses an owned temporary database manifest, exact
collection/cardinality allowlist, model-initializer drain, and verified
post-drop namespace removal. P8 is deliberately different: its allowlisted
importer writes exactly four version-1 drafts to `niro_dev`, after full
preflight, and never deletes, approves, or publishes them.

## P10 acceptance walkthrough

1. Build all workspaces and install the pinned Playwright Chromium browser.
2. Confirm the Atlas host resolves and the current host has an exact development access-list rule.
3. Inspect and, only if verified, clean any prior interrupted P10 fixture database.
4. Put the current official k6 binary on `PATH`, set `P10_RUN_K6=true`, and run `npm run p10:e2e`. The latest retained run used checksum-verified k6 2.2.0. Preserve the created `tmp/p10-evidence/<run-id>/` directory whether it passes or fails. Each passing run now self-generates its summary, cleanup verification, child logs, k6 result, run-scoped Playwright artifacts/report, runtime/version data, sorted SHA-256 artifact manifest, owner, timestamp, and release ID; copy the complete verified run directory to a durable evidence location.
5. A passing run must contain protected-before/protected-after hashes, browser results, accessibility checks, performance output, owned-database cleanup evidence, and a terminal summary. The protected source hashes must be byte-identical.
6. Run the k6 command against the authorized local/staging target and archive its thresholds. The Node fetch harness is useful diagnostic evidence but does not replace the canonical k6 gate.
7. Run the external public link check from the scheduled environment; a unit test of URL classification does not prove remote link health.

## Deployment and recovery handoff

Follow `deploy/native/render.md`, `production-deployment-runbook.md`, and `recovery-and-rollback-runbook.md`. Render native Node and root `render.yaml` are selected; retained Docker/Kubernetes files are non-selected references and not evidence that infrastructure exists. Before promotion, the selected owners must provide:

The current provider audit is `provider-access-audit-2026-08-30.md`: Render is
signed out, Vercel is authenticated but has no `athnect` project, Atlas access
is development-only, and no DNS/monitoring/recovery control plane is available.

- the restored authoritative Git repository/commit containing the reconciled tree, required branch/status checks, a protected GitHub `p10-test` environment with `P10_MONGODB_URI`, the non-secret deployed `P11_PUBLIC_SITE_URL`, and the first retained full CI artifact;
- immutable Render service/deploy/release identifiers, load-supported production plan/capacity and budget approval, and a secret configuration that passes `npm run deploy:validate`;
- evidence that each changed `fromService` source was Blueprint-resynced, newly added `sync: false` values were populated manually on existing services, and the exact-revision web artifact was rebuilt after every changed `NEXT_PUBLIC_*` value;
- Atlas production network/user/index/TTL/backup/PITR evidence and an isolated restore verifier environment;
- remote staging Playwright/accessibility/security smoke plus canonical k6 `<300 ms` p95 evidence for the exact green release;
- reviewed `.explain()` output for the top production queries against the deployed data shape;
- Render scheduler evidence for partial/nightly/reconciliation analytics and cache dispatch, scheduled-environment evidence for public-link checking, and a separately owned recurring Niro-vs-external divergence run;
- fleet metrics/log/error/uptime backends, tested alerts, and an on-call destination;
- proof that every Next replica receives invalidations, or a supported shared-cache strategy;
- DNS, TLS, HSTS, canonical-host, privacy, retention, consent, disclaimer, and legal-copy approvals.

Run deployment and restore verification against the real endpoints/restored cluster. Record timestamps, release IDs, RPO/RTO, evidence locations, owner names, and incident/rollback outcomes in `launch-readiness.md`.

## Clinical handoff

The generated readiness report is the authoritative queue: 56 calculator-specific external blocker IDs, 20 evidence requests, zero accepted evidence, and zero eligible calculators. CWS-17 is a completed revision-3 engineering disposition, not clinical approval. Evidence must be collected outside executable configuration, verified for provenance/authority/credentials/jurisdiction/completeness, then applied through a new Studio draft. A distinct qualified reviewer approves only the resulting current protected hashes.

All 40 core measurements remain draft and unreviewed. COVID remains an internal nonclinical fixture. The 62-calculator/79-measurement catalog is not an executable data source; each allowed post-launch candidate requires re-verification, licensing/applicability closure, Studio authoring, validation, complete source tests, and independent review. Every catalog row and its exact current blocker codes are enumerated in `data/catalog/Catalog-Publication-Readiness.v1.md` and `.json`; the deterministic check is `npm run catalog:readiness:check`.
