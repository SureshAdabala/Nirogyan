# Niro Health Calculator Platform

Niro is a TypeScript npm workspace for config-driven health calculators, reviewed biomarker content, Calculator Studio authoring, and privacy-safe first-party analytics. The immutable P0A contracts in `packages/contracts/` are the normative source of truth. The pure engine in `packages/engine/` is shared by public assessments and authorized Studio preview/testing.

Repository engineering and the canonical Atlas-backed P10 Reusability Gate are complete. Render's native Node runtime is selected and repository-configured for P11, while actual account deployment and P12 launch remain blocked until the clinical, privacy/legal, production Atlas, restore-drill, monitoring, and on-call evidence in `docs/operations/launch-readiness.md` exists. No Niro clinical calculator is currently publish-eligible.

## Workspace

- `packages/contracts` — versioned schemas, generated TypeScript types, validation rules, governance specifications, and deterministic reports.
- `packages/engine` — calculator-agnostic deterministic engine; no calculator-specific code.
- `apps/server` — Express API, Atlas/Mongoose persistence, admin lifecycle, analytics, health/readiness, metrics, and cache-outbox workers.
- `apps/client` — Next.js public site, generic calculator/result rendering, biomarker library, Calculator Studio, and analytics dashboard.
- `data` — immutable source-derived fixtures, reconciliation inputs, draft measurement seed, and quarantined research catalog.
- `scripts` — guarded integration, reconciliation, acceptance, deployment, recovery, and integrity commands.
- `docs/operations` — development, deployment, recovery, handover, and launch-readiness runbooks.

## Clone, install, and configure

Requirements: Node.js 24 LTS, npm 11.6.1, and access to a transaction-capable MongoDB Atlas deployment. The repository does not require a local MongoDB server or Docker.

```text
git clone <repository-url> athnect
cd athnect
npm ci
```

The supplied workspace has no `.git` metadata, so a reviewer must replace `<repository-url>` with the actual repository URL supplied by the owner.

Copy `.env.example` to the ignored project-root `.env`, then replace its placeholders. For local development, at minimum configure the exact Atlas SRV URI/database, separate high-entropy authentication and analytics secrets, localhost origins/URLs, and the policy values required by the feature being exercised. Add only the current development host's exact public IP as an Atlas `/32` access-list entry; never use an unrestricted production access rule. Do not commit `.env`, print secrets, or expose server secrets through `NEXT_PUBLIC_*` variables.

Privacy, retention, consent, canonical-host, legal-copy, and production-provider values have no application defaults. Obtain approval from the named owner before setting them; production validation fails closed when required values are absent.

## Validate, seed, and run

Run the deterministic repository checks before making a database change:

```text
npm run contracts:check-generated
npm run fixtures:validate
npm run measurements:integrity
npm run p8:divergence:check
npm run p8:readiness:check
npm run check
npm run build
```

The core measurement command is dry-run by default. It inserts only missing, seed-owned draft records after explicit opt-in and refuses to overwrite divergent history:

```text
npm run measurements:seed
npm run measurements:seed -- --apply
```

Create the first administrative account only in the intended non-production database. Put `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, and optionally `ADMIN_BOOTSTRAP_ROLE` (`admin`, `editor`, or `medical-reviewer`) in the ignored `.env`, verify `MONGODB_DB_NAME`, then run:

```text
npm run admin:bootstrap
npm run dev
```

Open `http://localhost:3000` for the public site and `http://localhost:3000/admin/login` for Calculator Studio. The API health endpoints are `http://localhost:4000/healthz` and `http://localhost:4000/readyz`.

The four Niro drafts are a separate guarded operation, not a general seed. Follow `data/reconciliation/README.md`; the command refuses production, non-loopback APIs, source/hash drift, database mismatches, and partial state. It never approves or publishes a calculator.

## Build a calculator without application code

Use a nonclinical synthetic definition for training unless approved clinical evidence already exists.

1. Sign in to Calculator Studio and create a calculator identity and draft.
2. Complete Basic details and add parameters. Bind a medical parameter only to the exact independently reviewed measurement revision; never invent a range, unit conversion, or applicability rule.
3. Define scoring rules, applicability/context conditions, domains/formulas, result categories, layout, reviewed content, citations, governance, and saved tests in their respective Studio tabs.
4. Preview with the production engine and inspect its trace. Run all saved tests and resolve every structural, semantic, clinical, and publication finding.
5. Submit the protected snapshot for review. A distinct authorized medical reviewer must approve its current hashes; editing afterward invalidates the approval.
6. Publish only when the lifecycle API reports the draft eligible. Publication creates an immutable version and cache-invalidation event; rollback republishes an earlier version as a new version.
7. Verify the public API and UI. A new calculator must not require an engine, renderer, or result-component change—the P10 Reusability Gate enforces that invariant.

See `docs/operations/handover.md` for the full reviewer walkthrough and safe test paths.

The P12 walkthrough that completes two real calculators remains external and pending: it requires two independently evidence-complete, measurement-approved, clinically reviewed candidates. The synthetic workflow above demonstrates the repository capability but is not clinical completion and must not be used to clear that launch gate.

## Quality and operations commands

```text
npm run check
npm run build
npm audit
npm audit --omit=dev

npm run db:integration -- --allow-temporary-database-write
npm run public:integration -- --allow-temporary-database-write
npm run admin:integration -- --allow-temporary-database-write
npm run p6:integration -- --allow-temporary-database-write
npm run analytics:integration -- --allow-temporary-database-write

npm run p10:browsers:install
npm run p10:e2e
npm run p10:k6
npm run p11:links

npm run deploy:validate
npm run deploy:build:server-native
npm run deploy:build:client-native
npm run deploy:native:verify
npm run deploy:verify
npm run recovery:verify
```

Database/browser integration commands require the configured Atlas environment. Guarded P6/P7/P9/P10 acceptance uses a unique owned temporary database, explicit write intent, a fixture manifest/cardinality check, and ownership-verified cleanup. Never point a temporary-fixture command at a shared database or delete a database whose ownership cannot be proven.

The selected non-Docker backend/scheduler host is Render native Node; the
frontend is prepared for Vercel with `apps/client/vercel.json` (Render's native
Next service remains a fallback). `render.yaml` and `deploy/native/render.md`
define the API, fallback web service, and three scheduled jobs. `deploy:validate`,
remote deployment verification, staging evidence, and restore verification still
require the external environment described in the operations runbooks. A local
Blueprint or passing unit test is not deployment or restore evidence.

The latest command-by-command local/external split is recorded in `docs/operations/qa-verification-2026-08-29.md` (reconciled 2026-08-30, including the fresh P10 archive).

## Current clinical and catalog status

- `diabetes-risk`, `heart-risk`, `hypothyroid-risk`, and `niro-cws` are application drafts and publication-blocked. The readiness report records 56 calculator-specific external blocker IDs, 20 open evidence requests, zero accepted evidence, and zero eligible calculators; CWS-17 is a completed revision-3 engineering disposition, not clinical approval.
- The Heart 13-points-to-10% artifact verifies only a source-provided intermediate stage; it is not a complete publish golden.
- All 40 real core measurement revisions remain draft and unreviewed.
- COVID is an internal nonclinical fixture and is excluded from Niro reconciliation.
- The 62-calculator/79-measurement research catalog remains quarantined. Bulk import is explicitly outside P0B–P12; approved candidates must be re-verified and authored through Studio one at a time.

The canonical machine-checked state is `packages/contracts/reports/niro-publication-readiness.v1.json`; its Markdown companion explains every owner and evidence requirement. Do not replace those blockers with inferred values or approvals.
