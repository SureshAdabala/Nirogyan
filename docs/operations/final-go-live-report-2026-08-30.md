# Final go-live report — 2026-08-30

Evidence cutoff: 2026-08-30T02:10:34Z. This report is reconstructed from the
current repository and current provider sessions; prior chat claims are not
treated as evidence. The authoritative gate register is `launch-readiness.md`.

## 1. Initial repository state

The application implementation was extensive and locally healthy, but launch
was and remains `NO-GO`. The readiness register contained 13 checked and 33
unchecked gates. The workspace had no Git metadata or authoritative revision;
four Niro calculators were blocked drafts; all 40 core measurements were draft
and unreviewed; production Atlas/Render/Vercel/DNS/monitoring/recovery evidence
was absent. Render and Vercel files were contracts, not deployed resources.

## 2. Blockers discovered

- One clinical count was stale: `CWS-17`/`MEAS-08` was an engineering
  provenance disposition, not an external clinical decision.
- Six catalog records and an affine-conversion note understated already
  implemented generic engine capability.
- Vercel automatic Git deployments conflicted with exact-revision promotion.
- The older P4/P3/transaction integration harnesses lacked the current
  production-refusal and explicit-write-authorization standard.
- P10 browser artifacts were not run-scoped and each run did not create its own
  complete hash manifest/cleanup artifact.
- The frontend lacked a global CSP, anti-framing, referrer, and cross-origin
  isolation header contract; the API default allowed same-origin framing.
- Tablet layout and unexpected browser console/page errors were not explicitly
  asserted in the live P10 flow.
- Canonical documents cited stale test counts, evidence runs, and performance
  numbers.
- Production provider resources, policy/legal decisions, clinical approvals,
  a source revision, domains, monitoring, backups, and recovery evidence were
  genuinely unavailable.

## 3. Blockers resolved

- Resolved `MEAS-08` and reclassified `CWS-17` from external blocker to locked
  revision-3 engineering disposition. External clinical decisions are now 56.
- Corrected catalog capability annotations without importing or publishing any
  research record.
- Disabled Vercel automatic Git deployment and documented the complete browser
  privacy/cache-invalidation environment handoff.
- Added explicit `--allow-temporary-database-write`, production refusal,
  nonce/database ownership, exact footprint checks, model-initializer drain,
  verified namespace removal, and aggregated cleanup errors to integration
  harnesses as appropriate.
- Made P10 evidence run-scoped and self-manifesting; every retained artifact has
  a byte count and SHA-256, including cleanup, logs, trace, video, report,
  runtime, k6, and protected-tree evidence.
- Added frontend CSP/frame/referrer/COOP/CORP headers and API frame denial.
- Added desktop, 768×1024 tablet, and 375×812 mobile overflow checks and a
  fail-closed unexpected browser-console/page-error assertion. Expected 401
  auth-boundary and one intentional 503 error-state response remain recorded
  separately.

## 4. Phase/task completion

P0A–P7 and P9 application phases are implemented. P8 engineering reconciliation
is deterministic, but its clinical publication tasks are externally blocked.
P10 local Atlas/production-standalone/browser/reusability/performance acceptance
passes. P11/P12 provider and launch acceptance are incomplete because no real
production deployment, operations control plane, recovery drill, policy/legal
approval, or clinical approval exists.

## 5. Implemented application features

The repository implements the generic calculation engine, public calculator
directory and flow, validation/conditional fields/units/omissions/results,
biomarker directory/detail, result sharing/revocation/expiry, SSR/ISR SEO,
admin authentication/RBAC/CSRF/lockout/session handling, Calculator Studio
authoring/preview/tests/review/publish/rollback, measurement revision review,
audit records, privacy-safe analytics, dashboards/CSV exports, leased jobs,
cache invalidation, health/readiness/metrics, native Node process contracts,
and recovery/deployment verifiers. Implementation does not substitute for the
open clinical, legal, provider, and production-operation gates.

## 6. Every application calculator

| Calculator         | State                                             | External clinical decisions | Public |
| ------------------ | ------------------------------------------------- | --------------------------: | ------ |
| `diabetes-risk`    | draft, publication-blocked                        |                          12 | no     |
| `heart-risk`       | draft, publication-blocked                        |                          18 | no     |
| `hypothyroid-risk` | draft, publication-blocked                        |                           7 | no     |
| `niro-cws`         | draft, publication-blocked                        |                          19 | no     |
| `covid-risk`       | immutable internal/nonclinical diagnostic fixture |    not a clinical candidate | no     |

Published Niro calculators: 0. Eligible Niro calculators: 0. No clinical value
or approval was invented to change those results.

## 7. Every measurement

All current core definitions below are revision 3, `draft`, `unreviewed`, and
publication-blocked; none is public or an approved immutable dependency:

`albumin`, `alt`, `anti-tpo`, `apob-apoa-ratio`, `ast`, `bun`, `cortisol`,
`creatinine`, `crp`, `eag`, `egfr`, `esr`, `estradiol`, `fasting-glucose`,
`fasting-insulin`, `ferritin`, `folate`, `free-t3`, `free-t4`, `ggt`, `hba1c`,
`hdl-cholesterol`, `hemoglobin`, `hscrp`, `il6`, `ldl-cholesterol`, `magnesium`,
`mcv`, `platelets`, `systolic-bp`, `testosterone`, `total-bilirubin`,
`total-cholesterol`, `triglycerides`, `tsh`, `uric-acid`, `vitamin-b12`,
`vitamin-d`, `wbc`, `zinc`.

All 79 measurement-extension records are research-only and quarantined:

`height`, `weight`, `waist-circumference`, `hip-circumference`,
`neck-circumference`, `systolic-bp`, `diastolic-bp`, `resting-heart-rate`,
`total-cholesterol`, `hdl-cholesterol`, `ldl-cholesterol`,
`non-hdl-cholesterol`, `triglycerides`, `mean-arterial-pressure`,
`pulse-pressure`, `fasting-glucose`, `ogtt-2h-plasma-glucose`, `hba1c`,
`fasting-insulin`, `creatinine`, `bun`, `bun-creatinine-ratio`, `urine-acr`,
`egfr`, `creatinine-clearance`, `total-water-intake`, `ast`, `alt`, `platelets`,
`respiratory-rate-adult`, `spo2`, `fev1-fvc-ratio`, `peak-expiratory-flow`,
`menstrual-cycle-length`, `menstrual-bleeding-duration`, `pre-pregnancy-bmi`,
`gestational-age-classification`, `sleep-duration-by-age`,
`caffeine-daily-limit`, `physical-activity-weekly-target`,
`child-screen-time-limits`, `rbc-count`, `hematocrit`, `mch`, `mchc`, `rdw`,
`neutrophils-percent`, `neutrophils-absolute`, `lymphocytes-percent`,
`lymphocytes-absolute`, `monocytes-percent`, `monocytes-absolute`,
`eosinophils-percent`, `eosinophils-absolute`, `basophils-percent`,
`basophils-absolute`, `serum-iron`, `tibc`, `transferrin-saturation`, `sodium`,
`potassium`, `chloride`, `co2-bicarbonate`, `calcium-total`, `phosphate`,
`vldl-cholesterol`, `alp`, `bilirubin-direct`, `bilirubin-indirect`,
`total-protein`, `globulin`, `ag-ratio`, `amylase`, `lipase`, `ldh`,
`creatine-kinase`, `fructosamine`, `psa`, `body-temperature`.

## 8. Clinical approval

Clinical approval is not complete. There are 56 external calculator-specific
decisions, 20 evidence requests, zero accepted evidence, zero eligible
calculators, and no qualified independent reviewer approvals. Complete worked
examples are missing for Diabetes and Hypothyroid; Heart is partial; CWS retains
the source framework's explicit rejection/stratified-range issue. All four
remain non-public as required.

## 9. MongoDB Atlas

Development Atlas is live: ping, transactions, P3/P4/P6/P9/P10 integration, and
owned cleanup pass. Production Atlas is absent/unverifiable: there is no
production project/cluster/database/user/network policy/tier, no production
index inspection, no backups/PITR or alerts, and no safe production credential.
The Atlas browser is signed out.

## 10. Render

`render.yaml` passes the current official Blueprint schema and four provider
contract tests. Native Node 24.11.0/npm 11.6.1 artifacts and all five process
contracts pass. Render CLI requires login; no workspace/service/cron/plan/env,
deployment, URL, logs, metrics, or rollback ID exists. Render deployment: FAIL.

## 11. Vercel

Vercel CLI 59.10.0 is authenticated, but `athnect` returns
`project_not_found`; there is no linked project or deployment. The config is
ready for a deliberate exact-revision deployment and auto Git deploy is off,
but required production API/site/policy values are absent. Vercel deployment:
FAIL.

## 12. Production URLs

Frontend URL: none. Backend URL: none. Custom domains: none. Local and isolated
test URLs are not production URLs.

## 13. DNS/TLS/HTTPS

No approved hostnames or DNS-provider access exist. No DNS records, public TLS
certificate, canonical redirect, remote HSTS, remote CORS, sitemap, robots, or
external-link crawl can be verified. Local production builds emit the required
security/SEO contracts only.

## 14. Monitoring and alerting

Health/readiness/protected Prometheus metrics, alert templates, operations
dashboard, redacted logging, and runbooks exist. No real fleet scraper, log or
error backend, uptime monitor, alert destination, named on-call owner, test
alert, or escalation exercise exists. Real monitoring status: FAIL.

## 15. Scheduler/workers

The analytics partial/final and cache-dispatch jobs have leases, retries,
idempotency, duplicate prevention, multi-instance-safe persistence, and Render
cron contracts. Local analytics integration passes. No remote cron exists or
has executed, and no provider failure/retry notification was observed.

## 16. Backup/PITR

The repository contains backup and recovery requirements, but production Atlas
backup/PITR is not configured or inspectable. Status: FAIL.

## 17. Restore evidence

The read-only restore verifier correctly refuses without explicit authorization.
No isolated restore from a production backup exists, so restored inventory and
application recovery were not verified. RPO/RTO were not measured.

## 18. Rollback/recovery

Calculator rollback-as-new-version passes locally. Native deployment and data
recovery runbooks exist. There is no deployed artifact/revision or production
backup to roll back, so no provider rollback/recovery drill or achieved RTO/RPO
exists.

## 19. Security results

Authentication, RBAC, CSRF, lockout, secure cookies, rate limits, idempotency,
injection rejection, public DTO allowlists, share capabilities, audit logging,
log URL/token redaction, CSP, frame denial, COOP/CORP, referrer policy, HSTS,
and protected metrics have automated coverage. Both dependency audits report
zero vulnerabilities. A targeted authored-tree scan found no embedded current
development Atlas hostname or private-key file outside ignored `.env`/generated
evidence. No remote TLS/ingress/secret-manager/production-log audit exists.

## 20. Privacy results

Health inputs, formula/weights/traces, identifiers, and tokens are excluded from
public DTOs and privacy-safe analytics; share/result routes are no-store,
noindex, and capability-redacted in logs; low cohorts are suppressed. Production
assessment/event/visitor/lead retention and consent values and approved privacy
or legal text remain absent, so production privacy acceptance is incomplete.

## 21. Accessibility

Component tests and the live P10 browser run pass automated axe checks,
focus-visible/keyboard-only journeys, named scrollable regions, and no overflow
at 1280×720, 768×1024, and 375×812. This is local production-standalone
evidence, not final deployed-site accessibility evidence.

## 22. Performance

Canonical local P10 measurements against the production-mode standalone build:

| Measurement             |                   Result |     Budget |
| ----------------------- | -----------------------: | ---------: |
| Config cold             |                 34.00 ms | diagnostic |
| Config warm / 304       |                  5.24 ms | diagnostic |
| k6 assessment p95       |            113.152975 ms |    <300 ms |
| Node assessment p50     |                 95.22 ms | diagnostic |
| Node assessment p95/max |                132.16 ms |    <300 ms |
| k6 checks/failures      | 20/20, 0 failed requests |   all/zero |

No real production URL exists, so homepage, biomarker, admin, cold-region, or
provider-edge production latency cannot be measured.

## 23. Browser/E2E

The final local production-standalone P10 browser run passed one complete
Studio/public/share flow, axe, keyboard, desktop/tablet/mobile layout, link
checks, privacy projections, ETag 304, error state, and zero unexpected HTTP,
console, page, hydration, or navigation errors. Tests against a deployed system
could not run because there is no deployed URL.

## 24. Reusability Gate

PASS locally. Execution
`p10-1e255924438c4d8ef8c3a63f19b3d5-0b7e75fd` created a calculator from a blank
Studio draft, edited it, added tests, validated, previewed, reviewed, published,
executed, rendered, shared, and cleaned it without calculator-specific
engine/renderer/API changes. Protected before/after hash:
`78dafa32c62a692b4bbaf2367636554ae133fd17c672bf6d33f8a1b8519840b1`.
The manifest covers 43 artifacts with no hash/size mismatch; an independent
Atlas name-only listing confirmed the owned database absent. Evidence is in
`docs/operations/evidence/p10/p10-1e255924438c4d8ef8c3a63f19b3d5-0b7e75fd/`.

## 25. Catalog

All 62 research calculators remain quarantined (none imported/published):

`bmi`, `body-surface-area`, `waist-circumference-risk`, `waist-to-hip-ratio`,
`waist-to-height-ratio`, `body-fat-us-navy`, `ideal-body-weight-devine`,
`lean-body-mass-boer`, `calorie-bmr-tdee`, `daily-calorie-needs-dga`,
`blood-pressure-category`, `mean-arterial-pressure`, `pulse-pressure`,
`resting-heart-rate`, `max-heart-rate`, `target-heart-rate-zones`,
`non-hdl-cholesterol`, `tc-hdl-ratio`, `ascvd-10-year-pce`, `homa-ir`,
`findrisc`, `ada-type2-risk-test`, `metabolic-syndrome-checker`,
`ogtt-2h-interpreter`, `tyg-index`, `ckd-epi-2021-egfr`,
`cockcroft-gault-crcl`, `bun-creatinine-ratio`, `daily-water-intake`,
`fib-4-index`, `apri`, `ast-alt-ratio`, `alcohol-standard-drinks`, `audit-c`,
`smoking-pack-years`, `predicted-peak-expiratory-flow`,
`fev1-fvc-interpretation`, `respiratory-rate-checker`, `spo2-checker`,
`six-minute-walk-distance`, `mmrc-dyspnea-scale`, `pregnancy-due-date`,
`gestational-age`, `ovulation-fertile-window`, `pregnancy-weight-gain`,
`menstrual-cycle-checker`, `pediatric-growth-percentiles`, `phq-9`, `gad-7`,
`pss-10`, `epworth-sleepiness-scale`, `sleep-duration-checker`,
`caffeine-intake-tracker`, `physical-activity-target`,
`child-screen-time-checker`, `transferrin-saturation`, `corrected-calcium`,
`friedewald-ldl`, `nlr`, `ag-ratio`, `anion-gap`, `indirect-bilirubin`.

Capability annotations were corrected, but unresolved source/licensing,
applicability, clinical, conversion, range, coefficient, and import-integrity
gates remain. Historical source evidence was retained; no bulk import occurred.

## 26. Test/build/typecheck/lint/format results

- `npm run check`: PASS, 471 tests across 76 files: contracts 27/7, engine
  30/4, server 154/18, client 138/25, scripts 122/22.
- Focused P10 static gate: 41/41 across 7 files.
- Focused production/deployment/restore/CI gate: 33/33 across 6 files.
- Build: all workspaces and optimized Next 16.3.2 production routes PASS.
- Native Node artifact verification: PASS, Node 24.11.0/npm 11.6.1, five
  processes, no Docker.
- Generated contracts, fixture diagnostic baseline, 40-record measurement
  integrity, P8 divergence/readiness, Render/Vercel contracts: PASS.
- `npm audit` and `npm audit --omit=dev`: zero vulnerabilities.

## 27. External approvals still required

Required approvals are: 56 Niro source-owner clinical decisions; complete
worked examples/boundaries; 40 measurement reviews; independent qualified
medical review of current hashes; applicability/licensing/content/citation/
authorship/review cadence; assessment/event/visitor/lead retention and consent;
privacy/legal/disclaimer/publication copy; launch scope; canonical domains and
assets; hosting capacity/budget; monitoring/on-call; backup/RPO/RTO; and the
final accountable launch decision.

## 28. Manual actions still required

The missing actions are not routine repository work: restore the authoritative
Git remote, create/configure production Atlas, authenticate/configure Render,
create/configure/deploy Vercel, approve and configure domains/DNS, configure
real monitoring/alerts, execute jobs remotely, perform backup/restore/rollback
drills, supply policy/legal approvals, resolve clinical evidence, then rerun the
entire acceptance suite against the exact deployed release.

## 29. Exact manual execution sequence

1. Repository owner supplies the authoritative private repository and confirms
   whether the source PDF/XLSX/catalog may be uploaded. Restore `.git`, commit
   this exact tree, push it, protect the release branch, configure the
   `p10-test` environment/`P10_MONGODB_URI` and `P11_PUBLIC_SITE_URL`, and retain
   a fully green hosted CI artifact.
2. Atlas administrator signs in, creates a separate production project and
   transaction-capable cluster, chooses the approved region/tier/capacity,
   creates the production database and least-privilege application and separate
   restore-verifier users, applies exact network/private access, verifies every
   normal/unique/TTL index, enables continuous backup/PITR and alerts, and
   records resource IDs without copying development credentials.
3. Privacy/product/legal owners approve every required retention/consent/copy
   and canonical site/API hostname. Generate independent high-entropy secrets
   in the provider secret managers and run `npm run deploy:validate` inside each
   intended runtime until it passes without printing secrets.
4. Render owner runs `render login`, selects the production workspace, creates
   the Blueprint from the exact authoritative revision, chooses/records service
   and cron plans, supplies all `sync:false` values, deploys API and three jobs,
   and records service/deploy/rollback IDs. Verify `/healthz`, `/readyz`,
   protected `/metrics`, Atlas connectivity, logs, cron success/failure/retry,
   and signed cache invalidation.
5. Vercel owner creates and links `athnect` with Root Directory `apps/client`,
   supplies API/site/release and all explicit analytics/visitor/lead policy
   build values plus only the server-side revalidation secret, deploys the same
   exact revision deliberately, and records deployment/rollback IDs and the
   production URL.
6. DNS owner attaches the approved frontend and API domains, configures apex/
   `www` and canonical redirects, waits for managed certificates, then verifies
   HTTPS/TLS/HSTS, exact CORS, sitemap, robots, external links, and secure link
   behavior from the public internet.
7. Operations owner connects fleet metrics, redacted logs, error tracking, API/
   site/readiness/database/latency/job/cache/deploy monitors and named alert
   destinations. Trigger one safe test alert and one failed non-production job;
   retain delivery, acknowledgement, and escalation evidence.
8. Atlas/recovery owners restore a production backup/PITR point into an isolated
   target, run `npm run recovery:verify -- --allow-read-only-restore-verification`
   with exact restore assertions, verify application recovery, rehearse
   server/client rollback, record achieved RPO/RTO, and remove only the verified
   isolated restore target.
9. Source owners and qualified reviewers resolve the 56 decisions and 40
   measurements with authoritative locators, complete examples/tests/content,
   then use normal immutable Studio drafts/review/publication. Never edit a
   value merely to pass a gate.
10. Run remote Playwright/axe/security/responsive tests and cold/warm k6 against
    staging, promote the exact release, rerun production smoke/link/monitoring,
    attach every evidence ID to `launch-readiness.md`, and obtain the signed
    launch decision.

## 30. Documentation status

`Implementation-Plan.md`, `Claude-Context.md`, `launch-readiness.md`,
`handover.md`, the QA record, deployment/client READMEs, provider-access audit,
and this report are reconciled to the current counts and evidence. The open
items remain unchecked; templates and local tests are not marked as production
evidence.

## Final conclusion

PRODUCTION READY: NO

DEPLOYMENT READY: NO

100% COMPLETE: NO

Exact reason: no real production Atlas, Render backend, Vercel frontend,
production URLs/DNS/TLS, monitoring/alert delivery, remote scheduler execution,
backup/restore/rollback/RPO/RTO evidence, approved policy/legal content, or
clinical publication approval exists; the authoritative source revision is
also absent. Precise remaining action: execute steps 1–10 above with the named
owners and attach real provider/reviewer evidence, then rerun final acceptance
against the deployed exact release.
