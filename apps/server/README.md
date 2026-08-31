# Niro API server

This workspace is the Express + TypeScript application API. It owns environment validation, Atlas/Mongoose persistence, public assessment/result/biomarker/event/lead routes, admin-only authentication and Calculator Studio lifecycle routes, analytics materialization/reporting, and operational/security boundaries. Calculator execution is delegated to the pure `@niro/engine` package; shared request/response and configuration contracts come from `@niro/contracts`.

## Local environment

Development and CLI entry points deterministically resolve the monorepo's ignored project-root `.env`; do not create a credential-bearing workspace-local environment file. Start from the placeholders and policy notes in the root `.env.example`.

Required groups include:

- Atlas: `MONGODB_URI`, `MONGODB_DB_NAME`, and optional connection tuning variables.
- Admin authentication: independent `AUTH_ACCESS_SECRET` and `AUTH_REFRESH_SECRET` values.
- Public persistence policy: `ASSESSMENT_RETENTION_DAYS`; optional lead capture additionally requires `LEAD_RETENTION_DAYS` and `LEAD_CONSENT_VERSION`.
- Analytics: `ANALYTICS_HASH_SECRET`, `ANALYTICS_IDENTITY_KEY_VERSION`, `ANALYTICS_EVENTS_RETENTION_DAYS`, `ANALYTICS_REPORTING_TIMEZONE`, `ANALYTICS_JOB_LEASE_SECONDS`, and `ANALYTICS_MIN_COHORT_SIZE`. Persistent visitors additionally require the approved enable/retention/consent trio.
- Network/origins: `PORT`, `CORS_ORIGINS`, `TRUST_PROXY_HOPS`, and the public site/API origins documented in `.env.example`.

Server secrets must never use a `NEXT_PUBLIC_` name and must never be committed, logged, placed in fixtures, or copied into reports. Production injects the same names through its deployment secret manager. Configuration fails closed when a required policy is absent or inconsistent.

## MongoDB and lifecycle

Development and live integration use transaction-capable MongoDB Atlas; no local MongoDB installation is required. The 18 implemented collections are documented in `Implementation-Plan.md` §6.4. Published calculator versions are immutable, v1 results are exactly one per assessment, capability tokens are stored only as hashes, and publish/rollback/retire writes use transactions plus the durable cache-invalidation outbox. Analytics source rows use logical expiry plus TTL indexes; permanent rollups require source-retention completeness and cohort gates.

The four P8 Niro records in `niro_dev` are source-preserving application drafts, not published calculators. The 40 core measurements remain draft/unreviewed, and the quarantined catalog is not imported.

## Main commands

Run these from the repository root unless a workspace flag is shown:

```text
npm run dev
npm run db:ping --workspace @niro/server
npm run db:integration -- --allow-temporary-database-write
npm run public:integration -- --allow-temporary-database-write
npm run admin:integration -- --allow-temporary-database-write
npm run analytics:integration -- --allow-temporary-database-write
npm run analytics:rollup -- --allow-analytics-write --expected-db-name=<exact-db> --expected-node-env=<exact-env>
```

Guarded integration and rollup commands require explicit write intent and exact database/environment ownership. Never point a cleanup-capable temporary-fixture command at an unverified database.

## API boundaries

- Public: health/readiness, published calculator projections and assessment, expiring/revocable share-result reads, reviewed biomarkers, optional unlinked leads, and privacy-safe `POST /api/v1/events`.
- Admin/editor: authenticated Calculator Studio, measurement review, lifecycle/version/test/preview/audit APIs, and aggregate analytics routes under `/api/v1/admin/analytics`.
- Admin only: detailed audit/user management, analytics lead/assessment CSV exports, and other routes explicitly restricted by the RBAC contract.

Admin and analytics responses are non-cacheable/noindex. Public calculator projections never expose formulas, point bands, weights, traces, internal hashes, or persistence metadata.
