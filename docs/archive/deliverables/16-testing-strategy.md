# Testing Strategy & Reusability Validation

> Deliverables 26–27. What gets tested, how, and the evidence that answers the 10 success-criteria questions.

## 1. Test pyramid

| Layer | Scope | Tooling | Key cases |
|---|---|---|---|
| Unit — engine | conditions, expressions, normalize, derive, score, aggregate, weight, adjust, categorize, contributors, trace | Jest | every operator; band-edge matrix; unit conversions round-trip; topo sort + cycle rejection; whitelist enforcement (no `eval` escape); missing-policy variants; deterministic repeat |
| Unit — configValidator | static config correctness | Jest | weights ≠ 1.0; overlapping/gapped bands; unparseable formula; unknown identifier; cyclic dependsOn; empty options; unknown parameterKey in domain; published-immutability |
| Unit — services | config cache, version lifecycle, audit | Jest | publish→cache invalidate; rollback creates new version; draft isolation |
| API integration | all public + admin endpoints | Supertest | 422 field mapping; unknown params rejected; unit not in table; 404 unpublished; 401/403 roles; 409 editing published; rate-limit 429; ETag 304 |
| Component — renderer | field registry, steps, visibility, client validation, result blocks | React Testing Library | renders BOTH sample configs; conditional `menopausalStatus` shows only for female; skip-optional flow; error mapping onto fields; a11y roles/labels |
| E2E | full journeys | Playwright | User: directory → Niro CWS → partial labs → result hierarchy (Result→Category→Why→Domains→Biomarkers→Recommendations) → shareable link. Admin: login → edit threshold → preview trace shows change → publish → public updated. Builder: create small calculator from scratch → publish → run |
| Data | biomarker dataset integrity | script | every biomarker has domain/unit/source[]; every NC flagged; JSON schema valid; conversions invertible |
| Security | authz, input abuse | Jest/Supertest | scoring internals absent from public config payload; injection attempts sanitized; brute-force limiter |
| Performance | assess latency, config cache | k6/basic | p95 < 300 ms local; cold vs warm config load |

## 2. Correctness-critical matrices

**Threshold boundary matrix** — for every band set, auto-generate tests at `min−ε`, `min`, `max−ε`, `max` per declared `bandEdges`. The Niro category edges (10/21/31/51 interim) each get explicit cases; when the Niro sheet resolves C4, regenerate.

**Demographic rule matrix** — for each context-split parameter (HDL, ESR, GGT, creatinine, uric acid, hemoglobin, testosterone, estradiol, ferritin, zinc): {male, female} × {age bands where relevant} × {menopausal status for estradiol} → expected band selection. Guards against context-fallthrough bugs.

**Missing-data matrix** — 0, 1, several, all-but-required, all parameters omitted: domain max recalculated; omission disclosed in result; `block`-policy param halts with 422.

**Golden files** — config+inputs→expected full result JSON (incl. trace) committed; any engine change that alters output fails CI loudly. When Niro sheet worked examples arrive (P9), they become golden files — brief §12: "Known source examples can be reproduced exactly."

## 3. THE REUSABILITY GATE (master §16 — the most important test)

**Claim to prove:** a second calculator ships through configuration alone.

Procedure (CI-scripted + recorded):
1. Snapshot git tree hashes of `server/engine/`, `client/src/renderer/`, `client/src/result/`.
2. Through the **Admin Builder UI only**, create the COVID-19 Risk Check: parameters, option-points, age bands, categories, UI steps.
3. Validate → preview → publish.
4. Run it via public API + UI; assert correct scoring per its config.
5. Re-hash the three core directories → **must be byte-identical**.
6. Evidence artifacts: screen recording, CI hash-comparison log, published config JSON diff (only data changed).

Pass = architecture claim verified. Fail = core had to change → design defect, fix the platform, not the process.

## 4. Success-criteria evidence map (master §20)

| # | Question | Evidence |
|---|---|---|
| 1 | New calculator without core rewrite? | Reusability gate (§3) hash-identical proof |
| 2 | Modify via configuration? | E2E: threshold edit → publish → live change, no deploy |
| 3 | Parameters dynamic? | Builder add/remove parameter test; renderer renders from config fixtures |
| 4 | Rules/formulas configurable? | Validator + engine unit suites over config permutations |
| 5 | Same UI renders multiple calculators? | Component suite renders both configs through one renderer |
| 6 | Same engine executes different logic? | Golden files for both calculators through one engine build |
| 7 | Niro representable generically? | niro-cws.config.json passes validator; engine executes it; no "niro" strings in engine (grep test in CI) |
| 8 | Second calculator via configuration? | Reusability gate |
| 9 | Medical values traceable? | Dataset integrity script: 100% of values carry niro/external/NC source tags |
| 10 | Calculation auditable? | Result trace test: every number reconstructable from versioned config + trace |

## 5. Medical-data verification tests (ongoing)

- Source-link liveness check (quarterly): each external URL still resolves; content drift flagged for review.
- Conflict-register completeness: every biomarker with disagreeing authorities renders both values labeled by organization.
- Niro-vs-external divergence report: when the Niro sheet lands, auto-diff its thresholds against external anchors; differences listed for Niro review (per source rules — preserve Niro, flag difference).

## 6. QA exit criteria (P11 gate)

All suites green · reusability gate passed with evidence · boundary + demographic + missing-data matrices pass · golden files locked · security checks pass · a11y automated scan clean + keyboard E2E pass · performance targets met · every clarification either closed or consciously carried with an owner and a UI label.
