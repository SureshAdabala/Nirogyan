# QA verification — reconciled 2026-08-30

This record distinguishes tests executed against the settled local tree from historical artifacts and external checks that could not run. A repository unit test or manifest check is not a substitute for Atlas, browser, load, deployment, backup, restore, or monitoring evidence.

## Passed on the settled tree

| Gate                          | Result                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`               | PASS: workspace + root-tool TypeScript, ESLint, formatting, 471 tests                                                                                      |
| Contracts                     | 27 tests across 7 files                                                                                                                                    |
| Engine                        | 30 tests across 4 files, including 10 fixture-derived matrix tests                                                                                         |
| Server                        | 154 tests across 18 files, including 10 P10 hardening tests and required-input 422 regression                                                              |
| Client                        | 138 tests across 25 files, including automated axe/component and keyboard-reachability coverage                                                            |
| Root scripts                  | 122 tests across 22 files, including nine integration-write safety tests                                                                                   |
| Focused non-live P10 gate     | 41 tests across fixture matrices, security, fixture ownership, hashes, performance harness, link safety, and workflow/evidence wiring                      |
| `npm run build`               | PASS: contracts, engine, server, optimized Next.js 16 build and route generation                                                                           |
| Generated contracts           | PASS: non-writing drift check for all three generated artifacts; generator output is canonical Prettier format                                             |
| Immutable fixture diagnostics | PASS: structural true and semantic/clinical/publish false; exact error totals 21/16/16/19/33                                                               |
| Measurement integrity         | PASS: 40 records, 117 original sources, 45 config references, 565 value tags, 29 raw conversions, zero canonical conversions/claim links, no findings      |
| P8 reports                    | PASS: divergence and publication-readiness artifacts deterministic; four blocked, zero eligible, 56 external IDs, 20 open requests, zero accepted evidence |
| Generic engine grep           | PASS: no `niro` or `covid` terms in `packages/engine/src`                                                                                                  |
| Dependency audits             | PASS: `npm audit` and production-only audit each report zero vulnerabilities                                                                               |

The full test distribution is 27 + 30 + 154 + 138 + 122 = 471 across 76 files. The Heart fixture total is now 16 because its preserved age-50 SBP imputation overlap is explicitly diagnosed as `SEM-023`; no fixture or clinical value changed.

## Live P10 acceptance

- Playwright 1.62.1 passed blank Studio authoring, review/publication, public assessment/share, projection privacy, axe, focus-visible keyboard traversal, 1280×720/768×1024/375×812 layout/no-overflow, expected negative-path classification, zero unexpected console/page errors, and protected-source hashing against the staged production standalone artifact.
- The final post-hardening run is durably archived under `docs/operations/evidence/p10/p10-1e255924438c4d8ef8c3a63f19b3d5-0b7e75fd/`: its self-generated manifest identifies the 2026-08-30T02:10:34Z local fixture release, local workspace operator, runtime, pinned k6 version, and 43 retained summary/hash/cleanup/log/trace/video/report artifacts. Every listed byte count/SHA-256 was independently verified, protected source was unchanged, guarded cleanup completed, and a post-run Atlas name-only listing confirmed the exact fixture database absent. Earlier archives remain retained for provenance.
- Official checksum-verified k6 1.7.1 passed 20/20 checks, zero failed requests, cold 200, warm ETag 304, and 113.152975 ms assess p95. The independent 18-request sampler passed at 132.16 ms p95; both satisfy the strict `<300 ms` local budget.
- The earlier interrupted database was read-only ownership-verified before guarded cleanup, and its exact local `.next-p10-*` cache was removed and verified absent.
- The quarterly public/external link workflow is scheduled for January/April/July/October and requires a non-secret HTTPS `P11_PUBLIC_SITE_URL` repository variable.

## Current external failures/blockers

## Fresh Atlas integration rerun — 2026-08-30

The configured Atlas IP access rule also supported a fresh local integration pass:

- `db:integration -- --allow-temporary-database-write`: PASS against `niro_dev`; transaction committed and cleaned after production refusal and explicit opt-in.
- `public:integration -- --allow-temporary-database-write`: PASS; assessment/result/share/privacy/lead paths and ETag behavior verified after production refusal and explicit opt-in.
- `admin:integration -- --allow-temporary-database-write`: PASS; authentication, lockout, RBAC, Studio lifecycle, rollback, biomarker review, audit, exact ownership footprint, and namespace-removal cleanup verified in an isolated database.
- `p6:integration -- --allow-temporary-database-write`: PASS; biomarker inventory, aliases, filters, ETag behavior, immutable measurement binding, and owned-database cleanup verified.
- `analytics:integration -- --allow-temporary-database-write`: PASS; concurrent private event ingest, rollup, retention, RBAC/export, metrics, and owned-database cleanup verified.

These are local/Atlas-development acceptance results, not production Atlas or hosted-provider evidence.

| Check                    | Current result                                                                                                        | Required resolution                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source repository and CI | Supplied workspace has no `.git`; no authoritative remote commit or hosted CI run is evidenced                        | Restore/push the reconciled tree; configure protected `p10-test`, `P10_MONGODB_URI`, `P11_PUBLIC_SITE_URL`, required status checks, and retain the first full CI artifact           |
| Render deployment        | Provider/native Blueprint selected and locally validated; CLI is signed out and no account sync or service exists     | Authenticate, create protected staging services from `render.yaml`, populate external values, manually deploy the exact green commit, and capture immutable deployment/rollback IDs |
| Vercel deployment        | CLI is authenticated, but `athnect` is `project_not_found`; no link, deployment, URL, domain, or environment exists   | Create/link the project only after the exact revision, Render API URL, approved site URL/policy values, and revalidation secret are available; deploy and retain IDs                |
| Staging acceptance       | Local standalone Playwright/k6 passes; no remote staging acceptance exists                                            | Run Playwright smoke/accessibility/security checks and canonical k6 against staging; retain the `<300 ms` p95 evidence                                                              |
| Production validation    | Correctly refuses the current development policy environment                                                          | Run only inside the fully configured Render staging/production runtime                                                                                                              |
| Query plans              | Index contracts have repository tests; no production `.explain()` evidence exists                                     | Capture and review explain plans for the top production queries against the deployed data shape                                                                                     |
| Restore verifier         | Correctly refuses without explicit read-only authorization                                                            | Supply an isolated restored Atlas cluster/read-only identity and exact database assertion, then run the guarded verifier                                                            |
| Public link schedule     | Workflow is implemented but no deployed `P11_PUBLIC_SITE_URL` exists                                                  | Configure the deployed HTTPS site variable and retain the first scheduled/manual run evidence                                                                                       |
| Divergence schedule      | Deterministic local Niro divergence report passes; no accountable external scheduled run exists                       | Assign the external source owner/schedule and retain the first Niro-vs-external divergence run                                                                                      |
| Operations               | Local health/metrics/job contracts pass; no fleet backend, destination, on-call owner, or test incident is configured | Configure and evidence production monitoring, logs, errors, uptime, alerts, and incident response                                                                                   |

No authoritative Git commit/full hosted CI artifact, production Atlas, Render or Vercel deployment, remote staging Playwright/security/k6 run, external link crawl, scheduled divergence run, production query-plan review, production backup/restore drill, native deployment rollback drill, remote scheduler run, fleet scrape, alert delivery, DNS/TLS/HSTS, or incident exercise is recorded in this session. No container image is part of the selected deployment. Provider observations are preserved in `provider-access-audit-2026-08-30.md`.

## 2026-08-30 final UI and deployment-contract addendum

- The public shell was visually refreshed against the design language of the
  supplied reference site: navy/blue typography, soft gradient surfaces, pill
  navigation, rounded cards, restrained elevation, responsive hero composition,
  and reduced-motion-safe transitions. No reference content, claims, or assets
  were copied.
- The shared brand token was corrected after live axe caught a 4.38:1 admin
  button contrast ratio; the final blue passes the WCAG AA threshold.
- `apps/client/vercel.json` now prepares a Vercel Next.js project rooted at
  `apps/client`, with workspace-root `npm ci --include=dev` and the existing
  native client build. Render native API/jobs remain the selected backend path;
  its Next service remains a validated fallback. The client now emits the
  production HSTS header required by the release verifier, and a deployment
  artifact test locks that contract.
- Full repository tests pass at 471 tests (349 workspace, 122 root), the
  production build and native deployment verifier pass, and the complete
  Atlas-backed P10 run is durably archived under
  `docs/operations/evidence/p10/p10-1e255924438c4d8ef8c3a63f19b3d5-0b7e75fd/`.
  The fresh run passed Playwright/axe/keyboard/mobile checks, k6 20/20 with zero
  failed requests and 113.152975 ms assess p95, and the independent Node sampler at
  132.16 ms p95; the exact owned fixture database and local `.next-p10-*`
  cache were absent after cleanup. Earlier P10 archives remain retained for
  provenance.

## Release conclusion

Repository-local gates are green. Release status remains **NO-GO** because clinical/policy/environment evidence is external and incomplete. See `launch-readiness.md` for the authoritative owner/action register.
