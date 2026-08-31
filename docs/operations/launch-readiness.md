# Launch readiness register

Last repository reconciliation: 2026-08-30. An unchecked item is a blocker, not an implied pass. Evidence fields must contain a durable link/path, timestamp, environment/release identifier, and accountable owner before an item can be checked.

## Repository gates

- [x] P0A contract and validation semantics are frozen and implemented.
- [x] Config-driven engine, public APIs/site, admin lifecycle/Studio, biomarker library, and privacy-safe analytics are implemented.
- [x] Niro reconciliation and readiness reports are deterministic and reject clinical/source drift.
- [x] Generated contract types have a non-writing drift check in CI.
- [x] Fixture validation enforces the locked diagnostic baseline for all five immutable samples.
- [x] Root tools, Playwright code, and workspaces are included in strict TypeScript checking.
- [x] P10 security/authz/rate/injection, hash-gate, performance-harness, accessibility/browser, link-check, and deployment/recovery test implementations exist.
- [x] P11 native build/workload/scheduler/metrics/cache/deploy/recovery assets, Render Blueprint, and runbooks exist.
- Evidence for the eight repository-implementation checks above: `docs/operations/qa-verification-2026-08-29.md`, `docs/operations/final-go-live-report-2026-08-30.md`, and `docs/operations/final-real-calculator-biomarker-report-2026-08-30.md`, most recently verified 2026-08-30T05:32:00Z against local tree/release `p10-1498c9b1042bee8c7d43a4af0443e9-374bf8c3`, owner: local workspace operator.
- [x] Fresh P10 Atlas/Playwright/Reusability run passes with terminal evidence and verified owned-database cleanup. Evidence: `docs/operations/evidence/p10/p10-1498c9b1042bee8c7d43a4af0443e9-374bf8c3/`, completed 2026-08-30T05:32:00Z, local isolated Atlas fixture/release `p10-1498c9b1042bee8c7d43a4af0443e9-374bf8c3`, owner: local workspace operator. Its self-generated manifest covers 44 artifacts with verified sizes/SHA-256; all 44 copied archive files were independently hash-matched. The run exercises the leased HMAC-signed cache dispatcher, validates ownership, and verifies namespace removal. Earlier P10 archives remain retained for provenance.
- Historical cleanup note, not a separate launch gate: interrupted database `niro_p7_df0429f040fec8e84f41fdb3582eae` was read-only ownership-verified before guarded cleanup; matching cache `C:\athnect\apps\client\.next-p10-df0429f040fec8e84f41fdb3582eae` was removed and verified absent in the 2026-08-29 engineering session. The current run's owned cleanup has durable evidence in the item above.
- [x] Canonical checksum-identified k6 2.2.0 run passed 20/20 checks, warm 304, zero failed requests, and 106.37 ms assess p95; independent sampler p95 was 164.83 ms against the 300 ms budget. Evidence: `archive-manifest.json`, `summary.json`, and `k6-summary.json` in the terminal evidence directory above; owner/release/timestamp are the same.
- [ ] Scheduled external public-link run completes from the selected CI environment. Owner: content operations. Evidence: pending.

## Clinical and content gates

- [ ] Source owners resolve all 56 current calculator-specific external blocker IDs with versioned evidence and precise locators. Owner: Niro source owner. Evidence: pending. CWS-17 is already closed as a nonclinical revision-3 engineering disposition.
- [ ] Each candidate has a complete source-worked example with complete inputs, final score/category, current locator, and reviewed boundary cases. Owner: Niro source owner. Evidence: pending.
- [ ] All medical parameters used by a candidate bind to independently approved immutable measurement revisions. Owner: qualified measurement reviewer. Evidence: pending; all 40 core measurements are draft.
- [ ] Structured content, applicability, disclaimers, claims/citations, SEO, authorship, licensing, and review cadence are approved. Owner: content/governance owner. Evidence: pending.
- [ ] A distinct qualified medical reviewer with accepted credentials/jurisdiction approves each candidate's current protected logic/content/citation/measurement/test hashes. Owner: independent medical reviewer. Evidence: pending.
- [ ] CWS N1 has a signed/versioned disposition of the explicitly rejected framework and stratified-range issue. Owner: Niro source owner. Evidence: pending.
- [ ] Complete the P12 end-to-end walkthrough with two independently evidence-complete, measurement-approved, clinically reviewed calculators; synthetic fixtures do not clear this gate. Owner: clinical governance + release owner. Evidence: pending; no candidate is eligible.
- [x] COVID remains excluded from clinical reconciliation and public launch.
- [x] The research catalog remains quarantined and no bulk import is authorized.
- [x] All 62 calculator rows and 79 measurement rows have an individually enumerated deterministic quarantine disposition. Evidence: `data/catalog/Catalog-Publication-Readiness.v1.md` and `.json`; 0 eligible/imported, 62 calculator rows quarantined, and 79 measurement rows quarantined.

Current clinical state: `diabetes-risk`, `heart-risk`, `hypothyroid-risk`, and `niro-cws` are drafts and blocked; published Niro calculators: zero; eligible Niro calculators: zero.

## Privacy, legal, and product gates

- [ ] Approve assessment/result retention in days. Owner: privacy/legal. Config: `ASSESSMENT_RETENTION_DAYS`.
- [ ] Approve analytics event retention, reporting timezone, identity-key version, minimum cohort size, and visitor persistence/retention/consent. Owner: privacy/legal + analytics product owner. Config: `ANALYTICS_EVENTS_RETENTION_DAYS`, `ANALYTICS_REPORTING_TIMEZONE`, `ANALYTICS_IDENTITY_KEY_VERSION`, `ANALYTICS_MIN_COHORT_SIZE`, and the visitor policy variables.
- [ ] Approve an explicit lead-retention/consent policy or a versioned disabled-source policy. Owner: privacy/legal + product. Config: `LEAD_RETENTION_DAYS`, `LEAD_CONSENT_VERSION`, and matching public flags/copy when enabled.
- [ ] Approve canonical production site/API hosts, brand/social assets, robots/indexing decisions, privacy notice, educational disclaimers, and publication copy. Owner: product/legal/content. Config: `SITE_URL`, `API_BASE_URL`, matching `NEXT_PUBLIC_*` URLs, and reviewed content records.
- [ ] Confirm launch calculator scope in a signed decision based only on eligible candidates. Owner: product + clinical governance. Evidence: pending; the template is `launch-decision-template.md`.

## Hosting, data, security, and operations gates

- [ ] Restore owner-provided `.git` metadata, push the reconciled tree to the authoritative remote, and record the exact commit containing this closeout. Owner: repository owner. Evidence: pending; the supplied workspace has no `.git`.
- [ ] Configure required branch/status checks and the protected GitHub `p10-test` environment with `P10_MONGODB_URI`; configure the non-secret deployed `P11_PUBLIC_SITE_URL`; retain the first complete lint → unit/integrity → guarded Atlas integration → build → live P10 artifact. Owner: repository/release administrator. Evidence: pending.
- [x] Select staging/production API and scheduler provider: Render native Node in Singapore, with automatic deploy disabled; prepare the Vercel Next.js frontend project contract (Render native Next remains a validated fallback). Evidence: `render.yaml`, `apps/client/vercel.json`, `deploy/native/render.md`.
- Provider-access evidence: `provider-access-audit-2026-08-30.md`, captured 2026-08-30T02:04:37Z by the local workspace operator. Render is unauthenticated; Vercel is authenticated but has no `athnect` project; Atlas is development-only/signed out; no DNS or monitoring control plane is available. This evidence explains the unchecked provider gates and is not a pass.
- [ ] Select and load-validate production Render service/cron plans, scaling headroom, and budget; repository topology defaults are not sizing evidence. Owner: platform/finance owner. Evidence: pending.
- [ ] Select/configure the metrics, logs, error tracking, uptime, alerting, and secret-management/account policy within or alongside Render. Owner: platform owner. Evidence: pending.
- [ ] Configure production Atlas least-privilege users, exact network rules/private connectivity, indexes/TTL, continuous backups/PITR, alerting, and capacity region/tier. Owner: Atlas administrator. Evidence: pending.
- [ ] Sync every changed `fromService` source, manually populate newly introduced `sync: false` values on existing services, rebuild `NEXT_PUBLIC_*` into the exact-revision web artifact, and deploy immutable server/client releases to staging; `deploy:validate` and `deploy:verify` pass against real endpoints. Owner: release engineer. Evidence: pending.
- [ ] Run remote Playwright smoke/accessibility/security acceptance and canonical k6 against the exact staging release; retain proof that assess p95 is `<300 ms`. Owner: QA/performance owner. Evidence: pending; local P10 evidence is not staging evidence.
- [ ] Capture and review `.explain()` plans for the top production queries against the deployed data shape. Owner: Atlas/database owner. Evidence: pending.
- [ ] Prove cache coherence/invalidation delivery across every active Next replica, or use a supported shared cache. Owner: hosting owner. Evidence: pending.
- [ ] Attach the guarded current-day partial, nightly final/reconciliation, and cache-dispatch commands to the selected Render scheduled jobs; observe successful and failed/retried runs. Owner: platform owner. Evidence: pending.
- [ ] Assign and execute a recurring Niro-vs-external divergence run independently of the Render analytics/cache jobs; retain its source snapshot and report. Owner: Niro source/content operations. Evidence: pending.
- [ ] Configure protected fleet metrics scraping, centralized redacted logs, error tracking, uptime checks, alert destinations, retention, and named on-call ownership. Owner: operations/security. Evidence: pending.
- [ ] Exercise a test incident and confirm health/readiness behavior, graceful drain, alerts, dashboards, and operator response. Owner: incident commander. Evidence: pending.
- [ ] Configure DNS, managed TLS, apex/`www` policy, HSTS, trusted-proxy hop count, exact CORS origins, and ingress capability-token redaction. Owner: security/hosting. Evidence: pending.
- [ ] Run `npm audit` and `npm audit --omit=dev` on the promoted lockfile; resolve or formally waive every finding. Owner: security/release. Evidence: pending promotion run.

## Backup, restore, and rollback gates

- [ ] Perform an isolated Atlas restore from the production backup/PITR system using a read-only restore-verifier identity. Owner: Atlas administrator. Evidence: pending.
- [ ] `npm run recovery:verify` passes against the restored database, including the actual `biomarkers` collection inventory. Owner: recovery lead. Evidence: pending.
- [ ] Record achieved RPO/RTO and compare them with approved targets. Owner: business/operations. Approved targets and evidence: pending.
- [ ] Rehearse native server/client deployment-artifact rollback, Calculator Studio rollback-as-new-version, and database recovery decision/escalation. Owner: release/recovery leads. Evidence: pending.
- [ ] Confirm no isolated test/restore databases or temporary credentials remain after ownership-verified cleanup. Owner: Atlas administrator. Evidence: pending.

## Launch decision

Launch status: **NO-GO — external evidence and environment gates remain open.**

This is not a judgment that the code is clinically fit. Repository-local completion cannot substitute for clinical evidence, policy approval, a real deployment, a backup restore, monitoring, or an accountable launch decision.
