# Final real calculator and biomarker completion report

Date: 2026-08-30  
Workspace: C:\athnect  
Authority: current repository, Implementation-Plan.md, Claude-Context.md, locked contracts, source registers, generated reconciliation/readiness reports, current Atlas development data, and retained test evidence.

## Outcome

The application now treats the real clinical inventory correctly and fail-closed:

- Every one of the 62 catalog calculator rows and 79 catalog measurement rows has an individual deterministic disposition and exact blocker list.
- The four existing Niro calculator drafts remain non-public because none passes the required evidence, measurement, content, and independent-review gates.
- The 40 existing canonical real measurement identities remain draft because no revision has the required qualified-review evidence and complete value-level claim/conversion structure.
- No unsupported formula, threshold, range, conversion, source-owner decision, reviewer identity, legal approval, or clinical conclusion was invented.
- Public list/detail APIs now require a valid published parent/current-version relationship and suppress stale or corrupt records.
- Public conditional DTOs no longer expose formula identifiers, operators, or comparison values.
- The synthetic P5 local fixture remains the only public calculator and biomarker. It is an explicitly nonclinical browser fixture and is guarded from production use.
- A fresh production-standalone P10 Studio-to-public run passed with Atlas, Playwright, axe, mobile/tablet/desktop coverage, the real signed cache dispatcher, k6, immutable-source hashing, and verified database cleanup.

This is the correct implementation result for the evidence currently available. Making the blocked real items visible would require fabricating or bypassing medical governance and is therefore prohibited.

## 1. Initial repository and database state

The current sources expose three distinct inventories:

| Inventory                                      |                   Count | Initial state                      | Final state                                 |
| ---------------------------------------------- | ----------------------: | ---------------------------------- | ------------------------------------------- |
| Existing Niro real calculator drafts           |                       4 | Draft, publication-blocked         | Draft, publication-blocked                  |
| Research catalog calculator rows               |                      62 | Legacy research pre-configurations | Individually quarantined with exact reasons |
| Existing canonical real biomarker keys         |                      40 | Three draft revisions each         | Draft; no lifecycle advance                 |
| Research catalog measurement rows              |                      79 | Legacy reference-extension rows    | Individually quarantined with exact reasons |
| Genuinely new catalog biomarker concepts       |                      65 | Research rows                      | Quarantined                                 |
| Catalog enrichments of existing canonical keys |                      14 | Research rows                      | Quarantined; duplicate insertion prohibited |
| Synthetic public browser fixtures              | 1 calculator + 1 marker | Published/verified local fixture   | Published/verified local fixture            |

Total real calculator candidates found: 66.

Total distinct real biomarker concepts intended by the combined inventories: 105, comprising 40 existing canonical identities plus 65 genuinely new catalog candidates. The 79 catalog rows must not be added to 40 without deduplication because 14 are enrichments of existing identities.

The final read-only development database inventory was:

- calculators: 5 documents — 4 real drafts and 1 published synthetic fixture;
- calculator versions: 5 documents — 4 real drafts and 1 published synthetic fixture;
- measurements: 121 documents — 120 real draft revisions and 1 verified synthetic fixture.

No catalog row was imported and no real clinical lifecycle state was advanced.

## 2. Real calculator status

### Existing Niro candidates

| Calculator       | External blocker IDs | Evidence requests | Publication result                         |
| ---------------- | -------------------: | ----------------: | ------------------------------------------ |
| diabetes-risk    |                   12 |                 5 | Draft; blocked                             |
| heart-risk       |                   18 |                 5 | Draft; blocked                             |
| hypothyroid-risk |                    7 |                 5 | Draft; blocked                             |
| niro-cws         |                   19 |                 5 | Draft; source-rejected publication-blocked |
| Total            |                   56 |                20 | 0 eligible; 0 published                    |

Each calculator still requires, at minimum:

1. source-owner resolution of its exact discrepancy IDs with versioned evidence and precise source locators;
2. a complete authoritative worked example with all inputs and expected final score/category;
3. reviewed boundary, missing-data, applicability, and population cases;
4. bindings to independently approved immutable measurement revisions;
5. approved structured content, claims/citations, authorship, licensing, disclaimer, applicability, and SEO;
6. independent qualified medical-review approval bound to the current protected logic, content, citation, measurement, and test hashes.

The exact per-calculator discrepancy and evidence-request text is retained in:

- packages/contracts/reports/niro-publication-readiness.v1.md
- packages/contracts/reports/niro-publication-readiness.v1.json
- packages/contracts/reports/niro-external-divergence.v1.md
- packages/contracts/reports/niro-external-divergence.v1.json

COVID remains intentionally excluded from reconciliation and launch and is not counted among the four intended candidates.

### The 62-row calculator catalog

All 62 rows are research pre-configurations, not executable immutable Calculator Studio versions. All 62 have these exact universal blocker classes:

| Blocker ID                   | Affected | Meaning                                                                                                         |
| ---------------------------- | -------: | --------------------------------------------------------------------------------------------------------------- |
| CAT-CALC-LEGACY-SHAPE        |       62 | Not a calculator-version.v1 Studio-authored immutable record                                                    |
| CAT-CALC-MEASUREMENT-MAPPING |       62 | No approved explicit canonical measurement bindings/snapshots                                                   |
| CAT-CALC-COMPLETE-GOLDEN     |       62 | No reviewer-approved complete source example and boundary/missing/context suite                                 |
| CAT-CALC-CONTENT-GOVERNANCE  |       62 | Publishable content, claim citations, authorship, applicability, disclaimer, SEO, and licensing are incomplete  |
| CAT-CALC-INDEPENDENT-REVIEW  |       62 | No independent qualified reviewer approval bound to protected hashes                                            |
| CAT-CALC-SOURCE-REVERIFY     |       42 | One or more source objects require exact reverification                                                         |
| CAT-CALC-LICENSING           |       15 | Licensing/authorized-use disposition is incomplete                                                              |
| CAT-CALC-ENGINE-CAPABILITY   |        7 | Required date, chart, percentile, pulmonary, or compound adapter capability is not present in the locked engine |

The 7 engine-capability records are alcohol-standard-drinks, fev1-fvc-interpretation, gestational-age, ovulation-fertile-window, pediatric-growth-percentiles, predicted-peak-expiratory-flow, and pregnancy-due-date.

The 15 licensing records are apri, audit-c, body-fat-us-navy, ckd-epi-2021-egfr, epworth-sleepiness-scale, fib-4-index, homa-ir, metabolic-syndrome-checker, ovulation-fertile-window, pediatric-growth-percentiles, phq-9, pregnancy-due-date, pregnancy-weight-gain, pss-10, and smoking-pack-years.

The catalog contains 219 calculator source objects. Tier distribution is 36 tier-1, 21 tier-2, and 5 tier-3 rows. Category distribution is 10 anthropometric, 9 cardiovascular, 6 metabolic, 4 kidney, 5 liver, 7 respiratory, 6 reproductive, 8 mental/sleep, and 7 laboratory rows.

The exact key, name, tier, category, source-verification summary, blocker IDs, blocker explanations, and next allowed action for every one of the 62 rows is the calculator appendix in data/catalog/Catalog-Publication-Readiness.v1.md. Its machine-readable equivalent is data/catalog/Catalog-Publication-Readiness.v1.json. Those two generated artifacts are part of this report by reference and are the per-record source of truth.

Calculator results:

- real calculators made functional and approved: 0 of 66;
- real calculators publicly visible: 0 of 66;
- research catalog calculators imported: 0 of 62;
- research catalog calculators quarantined: 62 of 62;
- unsafe or guessed publications: 0.

## 3. Real biomarker and measurement status

### Existing canonical library

The 40 canonical keys are:

albumin, alt, anti-tpo, apob-apoa-ratio, ast, bun, cortisol, creatinine, crp, eag, egfr, esr, estradiol, fasting-glucose, fasting-insulin, ferritin, folate, free-t3, free-t4, ggt, hba1c, hdl-cholesterol, hemoglobin, hscrp, il6, ldl-cholesterol, magnesium, mcv, platelets, systolic-bp, testosterone, total-bilirubin, total-cholesterol, triglycerides, tsh, uric-acid, vitamin-b12, vitamin-d, wbc, and zinc.

All 40 have three immutable draft revisions. The current revision-3 stored hashes match the seed definitions for all 40. Across the current canonical source material there are:

- 117 source records;
- 45 configuration references;
- 565 value-level governance tags;
- 29 raw conversion candidates;
- 0 accepted canonical conversions;
- 0 accepted canonical value-to-claim links.

Twenty keys have an explicit nonempty reference-range conflict record:

albumin, alt, ast, bun, cortisol, creatinine, ferritin, folate, free-t3, free-t4, ggt, hdl-cholesterol, magnesium, mcv, platelets, testosterone, total-bilirubin, tsh, uric-acid, and vitamin-b12.

Five keys have unresolved clarification records:

anti-tpo, apob-apoa-ratio, estradiol, fasting-insulin, and il6.

All 40 carry governance issue identifiers from the migration/audit process, but that must not be misreported as 40 range conflicts; the exact range-conflict count is 20.

No canonical revision may become verified until a qualified measurement reviewer resolves the value/range/conversion/source/license issues and records approval evidence bound to the immutable revision hash.

### The 79-row measurement catalog

Every catalog row has these four universal blockers:

| Blocker ID                   | Affected | Meaning                                                                           |
| ---------------------------- | -------: | --------------------------------------------------------------------------------- |
| CAT-MEAS-LEGACY-SHAPE        |       79 | Not a measurement-definition.v1 immutable revision                                |
| CAT-MEAS-RANGE-STRUCTURE     |       79 | Ranges lack stable IDs and exact boundary/unit/context semantics                  |
| CAT-MEAS-CLAIM-LINKS         |       79 | Numeric values/conversions are not linked to stable source claims                 |
| CAT-MEAS-REVIEW-EVIDENCE     |       79 | No qualified reviewer identity/hash/timestamp/expiry/license disposition          |
| CAT-MEAS-CONVERSION-SHAPE    |       64 | One or more conversions are not encoded in the locked directional shape           |
| CAT-MEAS-CONVERSION-REVERSED |       20 | Legacy factor is reciprocal/reversed for the declared direction                   |
| CAT-MEAS-LIBRARY-MERGE       |       14 | Row is an enrichment and must become a reviewed new revision, not a duplicate key |
| CAT-MEAS-SOURCE-REVERIFY     |       11 | One or more source objects require exact reverification                           |
| CAT-MEAS-CONVERSION-SPECIAL  |        6 | Conversion needs a typed multi-component/nonlinear adapter                        |

The 20 known reversed-conversion rows are:

alp, amylase, basophils-absolute, bilirubin-direct, bilirubin-indirect, calcium-total, eosinophils-absolute, globulin, hematocrit, ldh, lipase, lymphocytes-absolute, mchc, monocytes-absolute, neutrophils-absolute, phosphate, serum-iron, tibc, total-protein, and vldl-cholesterol.

The 6 special-conversion rows are body-temperature, caffeine-daily-limit, fasting-insulin, height, pre-pregnancy-bmi, and weight.

The 11 source-reverification rows are caffeine-daily-limit, child-screen-time-limits, gestational-age-classification, height, menstrual-bleeding-duration, menstrual-cycle-length, pre-pregnancy-bmi, sleep-duration-by-age, spo2, waist-circumference, and weight.

The catalog has 143 measurement source objects and 87 legacy conversion objects on 64 rows. It resolves to 65 genuinely new candidates and 14 enrichments of existing canonical identities.

The exact key, name, panel, catalog role, source summary, every blocker ID/explanation, and next allowed action for all 79 rows is the measurement appendix in data/catalog/Catalog-Publication-Readiness.v1.md and its machine-readable JSON counterpart.

Biomarker results:

- distinct real concepts found after deduplication: 105;
- existing canonical real keys verified: 0 of 40;
- genuinely new catalog candidates verified/imported: 0 of 65;
- catalog enrichments merged: 0 of 14;
- real biomarkers publicly visible: 0 of 105;
- catalog measurement rows imported: 0 of 79;
- catalog measurement rows quarantined: 79 of 79;
- duplicate canonical identities created: 0.

## 4. Implementation completed

### Deterministic per-record catalog gate

scripts/generate-catalog-readiness-report.ts now reads the two historical catalog sources, hashes the inputs, detects duplicate/enrichment identities, classifies every row, and generates both human and machine evidence without writing to MongoDB or changing lifecycle state.

scripts/generate-catalog-readiness-report.test.ts locks the counts, deterministic output, universal blockers, conversion reversals, special adapters, source-verification cases, merge cases, and fail-closed semantics.

The root package commands now expose catalog readiness generation, drift checking, and tests.

### Public API and privacy boundary

The public calculator query now requires:

- a published calculator parent;
- a published version;
- the parent currentVersionId to point at that exact version;
- consistent published identity.

Stale, orphaned, duplicate, or corrupt publication combinations fail closed instead of leaking into list/detail responses.

Public conditional response objects no longer contain formula identifiers, operators, or comparison values. The client renderer accepts only the public-safe condition shape and fails closed if it cannot evaluate a protected condition.

### Local fixture and persistence safety

The P5 browser fixture has a stronger production guard and remains clearly synthetic. The public assessment flow uses configured persistence and no longer produces the earlier Assessment persistence is not configured failure when the fixture is started through its supported harness.

### P10 Studio/public cache coherence

The production-style P10 harness now configures a run-scoped cache signing secret and endpoint and executes the real leased HMAC-signed cache-invalidation dispatcher after publication. This fixed the genuine regression where a newly published Studio calculator could be returned by the API while the statically generated public directory remained stale.

The final test proves a blank Studio draft can be edited, validated, previewed, tested, independently reviewed, published, discovered, assessed, rendered, shared, and cleaned up without calculator-specific engine, renderer, or API changes.

## 5. Files changed or created

The supplied workspace has no .git directory, so an authoritative baseline diff cannot be reconstructed. The following task-scoped files were directly changed or generated and verified:

- package.json
- scripts/generate-catalog-readiness-report.ts
- scripts/generate-catalog-readiness-report.test.ts
- data/catalog/Catalog-Publication-Readiness.v1.json
- data/catalog/Catalog-Publication-Readiness.v1.md
- scripts/p5-browser-fixture.ts
- scripts/p5-browser-fixture.test.ts
- apps/server/src/modules/public.ts
- apps/server/src/modules/public.test.ts
- packages/contracts/src/public-api.ts
- packages/contracts/src/public-api.test.ts
- apps/client/src/calculator/conditions.ts
- apps/client/src/calculator/conditions.test.ts
- scripts/p10-e2e.ts
- tests/e2e/p10-reusability.spec.ts
- docs/operations/launch-readiness.md
- docs/operations/handover.md
- docs/operations/final-real-calculator-biomarker-report-2026-08-30.md
- docs/operations/evidence/p10/p10-1498c9b1042bee8c7d43a4af0443e9-374bf8c3/ — 44 retained evidence artifacts

The official k6 2.2.0 standalone binary is retained under tmp/tools for local verification only; it is not an application source file, dependency, Docker image, or deployment artifact.

## 6. MongoDB and lifecycle changes

- No development credentials were repurposed as production credentials.
- No production database was accessed.
- No real calculator was approved or published.
- No real biomarker was verified.
- No catalog record was imported.
- Historical catalog sources were not edited or deleted.
- Guarded integration/P10 databases used exact owned random names and cleanup manifests.
- The final P10 database niro_p7_1498c9b1042bee8c7d43a4af0443e9 was ownership-verified, dropped, and independently confirmed absent.
- Current real draft hashes remained stable.

## 7. Test, build, integration, and security results

### Repository quality gate

The full npm run check gate passes:

- contracts tests: 28;
- engine tests: 30;
- server tests: 161;
- client tests: 138;
- root/script tests: 138;
- total tests: 495;
- all workspace and tools TypeScript checks: pass;
- ESLint: pass;
- Prettier check: pass.

The production npm run build passes for contracts, engine, server, and the Next.js client. Next.js 16.3.2 completed the production build and generated all 10 static routes.

Security audits:

- npm audit: 0 vulnerabilities;
- npm audit --omit=dev: 0 vulnerabilities.

### Deterministic clinical/data gates

- measurements:integrity: pass — 40 records, deterministic seed/store hashes, no structural errors;
- fixtures:validate: pass as a rejection gate — 5 structurally valid samples, all correctly semantic/clinical/publication-blocked;
- p8:reconcile: pass dry run — 4 drafts, 0 eligible, no writes;
- Niro external divergence check: pass, no report drift;
- Niro publication readiness check: pass, no report drift;
- catalog readiness generator tests/check: pass, 62 + 79 rows and no drift.

### Live Atlas integration suites

- transaction integration: pass and cleaned;
- public API integration: pass, including ETags/304, assessment/result, private shares, revocation/expiry, leads, and TTL behavior;
- admin integration: pass, including lockout, RBAC, CSRF, session security, Studio validation/preview/tests/review/publish/rollback, biomarker verification gates, audit, cache, and cleanup;
- biomarker integration: pass, including verified-only projection, search/filter/ETag/relations, dependency snapshots, and protected-field exclusion;
- analytics integration: pass, including concurrent idempotency, privacy-safe ingest, leased rollup, dashboard/RBAC/CSV/metrics, and cleanup.

## 8. Browser, accessibility, reusability, and performance evidence

Final retained execution:

- execution ID: p10-1498c9b1042bee8c7d43a4af0443e9-374bf8c3;
- evidence directory: docs/operations/evidence/p10/p10-1498c9b1042bee8c7d43a4af0443e9-374bf8c3/;
- status: ok;
- Playwright result: 1 full Studio-to-public journey passed in approximately 2.5 minutes;
- cache dispatcher: 1 completed, 0 failed;
- protected implementation SHA-256 before/after: c6316303cc13dc4f67ac137bc5e0c8db4af81f2cad7f5941660611c74f83b9df;
- protected implementation differences: none;
- owned Atlas cleanup: completed and namespace absent;
- archive: 44 files, 81,027,102 bytes, all 44 durable-copy SHA-256 values independently matched.

The browser run covered admin login, admin home, Studio release workspace, calculator directory, biomarker directory, biomarker detail, public calculator, partial result, shared result, saved tests, review, publish, public discovery, assessment, sharing, cache revalidation, and cleanup.

Viewport coverage:

- mobile: 375 × 812;
- tablet: 768 × 1024;
- desktop.

Accessibility and UI assertions:

- axe checks passed on all named public/admin/result pages;
- keyboard/focus and responsive navigation paths passed;
- no horizontal overflow at tested sizes;
- unexpected console errors, page errors, broken links, or hydration failures fail the harness; none failed the retained run.

Final post-closeout local smoke after restarting the current tree:

- API health and readiness returned HTTP 200;
- calculator list returned exactly p5-ui-local-demo;
- biomarker list returned exactly p5-ui-local-demo-marker;
- homepage, biomarker directory, synthetic calculator detail, and synthetic biomarker detail returned HTTP 200 and contained the expected records;
- the unpublished diabetes-risk API detail returned HTTP 404, while the streamed Next.js route rendered the noindex unavailable page and no draft configuration;
- the development CSP includes unsafe-eval, which React/Next development debugging requires, while the production CSP exclusion remains test-locked;
- rendered HTML contained neither the prior CSP eval error nor the prior assessment-persistence error;
- server output contained successful request logs and no application error.

The in-app browser security policy blocked an additional automated localhost-tab attachment. No bypass or alternate browser-control mechanism was used. The retained P10 Playwright/axe/console/responsive run above is therefore the authoritative interactive-browser evidence, while this final restart was verified through direct rendered-page and API responses.

Canonical k6 2.2.0 result:

- 20 of 20 checks passed;
- failed request rate: 0%;
- 18 assessment iterations / 20 total requests;
- assessment p95: 106.37 ms;
- required budget: less than 300 ms.

Independent sampler:

- cold calculator configuration: 36.66 ms;
- warm calculator configuration: 4.49 ms with HTTP 304;
- assessment p50: 91.29 ms;
- assessment p95/max: 164.83 ms;
- required budget: 300 ms;
- result: pass.

## 9. Public routes and current visibility

Local routes:

- application and calculator directory: http://localhost:3000/
- biomarker directory: http://localhost:3000/biomarkers
- synthetic calculator: http://localhost:3000/c/p5-ui-local-demo
- synthetic biomarker: http://localhost:3000/biomarkers/p5-ui-local-demo-marker
- admin login: http://localhost:3000/admin/login
- API health: http://localhost:4000/healthz
- API readiness: http://localhost:4000/readyz

Expected current public content:

- 1 synthetic local calculator;
- 1 synthetic local biomarker;
- 0 real calculators;
- 0 real biomarkers.

A real draft route such as /c/diabetes-risk must remain unavailable until the normal evidence and immutable publication workflow succeeds.

There is no production public URL. Render, Vercel, DNS, TLS, production Atlas, monitoring, backup/PITR, and recovery control planes are not provisioned in the available accounts. Local URLs are not production URLs.

## 10. Manual actions still required

### For each of the four Niro calculator drafts

1. The Niro source owner opens the calculator section in packages/contracts/reports/niro-publication-readiness.v1.md.
2. They answer every listed external blocker ID using a versioned authoritative source and exact page/table/section locator.
3. They provide one complete worked example with all inputs and the final expected score/category plus boundary, applicability, population, and missing-data cases.
4. A qualified measurement reviewer resolves and approves every referenced measurement revision, including exact units, specimen/method/population contexts, ranges, directional conversions, stable claim IDs, expiry, and licensing.
5. The content/governance owner approves structured result content, applicability, disclaimer, claims/citations, authorship, SEO, cadence, and licensing.
6. An independent qualified medical reviewer reviews the final protected hashes and records an accepted approval through the normal review endpoint. The editor must not self-approve.
7. Re-run fixture validation, measurement integrity, divergence, readiness, all tests, build, Atlas integration, and P10.
8. Publish only through Calculator Studio’s immutable transactional workflow and verify directory/detail/assessment/share behavior.

### For a catalog calculator or measurement

1. Select one row in data/catalog/Catalog-Publication-Readiness.v1.md.
2. Resolve every blocker listed for that exact row; do not copy a legacy record directly into MongoDB.
3. Reverify every source and record exact claim locators and licensing/authorized-use disposition.
4. For measurements, author or merge one canonical immutable revision, encode exact contexts/range boundaries, correct the locked conversion direction, and obtain independent measurement review.
5. For calculators, author a blank Studio draft, bind approved measurement revisions, add complete source/boundary/missing/context tests and governed content, then obtain independent protected-hash medical approval.
6. Run the entire validation and browser gate.
7. Import/publish only the single record that passes all gates; leave all others quarantined.

### For production deployment

1. Restore the authoritative .git history/remote and push this exact reconciled tree.
2. A clinical/product launch owner signs the eligible launch scope; currently it must be empty.
3. Legal/privacy owners approve retention, consent, analytics, leads, disclaimer, privacy, canonical hosts, and indexing decisions.
4. The Atlas administrator creates a separate production cluster/database/application user, exact network policy, indexes/TTL, continuous backup/PITR, alerting, and capacity plan.
5. The release owner creates the native Node Render services/jobs from render.yaml and the Vercel Next project from apps/client/vercel.json, supplies unique production secrets, and deploys immutable revisions. Docker is not selected.
6. The domain owner configures DNS, managed TLS, canonical host policy, HSTS, exact CORS, and trusted-proxy settings.
7. Operations configures protected metrics/logs/error tracking/uptime alerts and verifies a real alert path.
8. Run deployed smoke, accessibility, security, k6, scheduler/retry, rollback, and isolated backup-restore/recovery drills; record real URLs, release IDs, RPO, and RTO.

The precise owner-by-owner launch list is docs/operations/launch-readiness.md. Provider access findings are in docs/operations/provider-access-audit-2026-08-30.md.

## 11. Acceptance conclusion

The user’s safety-preserving objective is satisfied: every eligible item is public, because the current eligible set is empty; every ineligible item is blocked with an exact recorded reason; and the common engine, Studio workflow, public application, privacy boundary, browser workflow, and performance gate have fresh passing evidence.

This does not mean the real clinical catalog is complete. Evidence and review work cannot be replaced by code.

REAL CALCULATORS FUNCTIONAL AND APPROVED: NO — 0 of 66; authoritative evidence, complete examples/tests, measurement approvals, content/licensing, and independent clinical review are missing.

REAL CALCULATORS PUBLICLY VISIBLE: NO — 0 of 66; correct fail-closed result.

REAL BIOMARKERS VERIFIED: NO — 0 of 105 distinct concepts; 40 canonical identities remain draft and 65 genuinely new catalog concepts remain quarantined.

REAL BIOMARKERS PUBLICLY VISIBLE: NO — 0 of 105; correct fail-closed result.

CATALOG SAFE DISPOSITION COMPLETE: YES — all 62 calculator and 79 measurement rows are individually documented; 0 imported and 141 quarantined.

PRODUCTION READY: NO — clinical/legal approvals, production Atlas, real provider deployment, DNS/TLS, monitoring, backup/PITR restore, and recovery evidence remain external open gates.

DEPLOYMENT READY: NO — repository deployment contracts exist, but no real Render/Vercel production services, production secrets, domain, or validated remote release exists.

100% COMPLETE: NO — real clinical approval/publication and the external go-live gates above remain incomplete.
