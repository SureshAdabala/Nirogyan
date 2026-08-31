# Production deployment and operations runbook

## Release topology

The selected backend flow is local → Render staging on the native Node runtime
after a green protected branch → manual deployment of the same exact commit to
protected Render API/cron services. The frontend has a Vercel deployment
contract in `apps/client/vercel.json`; the Render native Next service in
`render.yaml` remains the validated fallback when a single-provider topology is
preferred. Docker and Kubernetes are not selected. MongoDB is Atlas. Scheduled
work is a separate Render cron job, never an in-process timer in each API
replica.

Production is not approved merely because the repository builds. Render/Vercel
are selected at the repository-contract level, but the owner must still create
the provider projects, review plans/spend, supply secrets and approved policy
values, configure production Atlas/network policy and DNS/TLS, choose
metrics/log/error backends and alert destinations, and name incident owners.

The Blueprint does not select or validate production capacity. The platform owner must choose and evidence web/cron plans, scaling, load headroom, and budget; repository topology tests are not sizing proof.

## Runtime configuration

Create separate server and client configuration scopes:

- `niro-server-secrets`: `MONGODB_URI`, independent auth/analytics/metrics/revalidation secrets, and no `NEXT_PUBLIC_*` values.
- `niro-server-config`: runtime environment/release/database/policy/origin/pool/proxy/job values.
- `niro-client-secrets`: only `CACHE_INVALIDATION_SIGNING_SECRET` for the server-only Next revalidation route.
- `niro-client-config`: non-secret site/API/runtime values. `NEXT_PUBLIC_*` values must already have been supplied during the client build.

The production validator requires an immutable `RELEASE_ID`, explicit `DEPLOYMENT_ENVIRONMENT`, non-loopback binding, deliberate proxy-hop count, exact HTTPS origins, a non-system database, distinct strong secrets, signed cache invalidation, and aligned browser/server privacy policy. It rejects production-like use of dev/test/restore/staging database names.

For the Vercel frontend, set Root Directory to `apps/client` and use the
checked-in `vercel.json`. Its build runs from the workspace root so the npm
lockfile and `@niro/*` workspaces remain authoritative. Configure `API_BASE_URL`
and `NEXT_PUBLIC_API_BASE_URL` with the Render API origin, and set
`SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `RELEASE_ID`, and `NEXT_PUBLIC_RELEASE_ID`
for the exact release. Set the complete browser policy contract on the same
identified build: `NEXT_PUBLIC_ANALYTICS_ENABLED`,
`NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE`,
`NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED`,
`NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS`,
`NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION`,
`NEXT_PUBLIC_LEAD_CAPTURE_ENABLED`, `NEXT_PUBLIC_LEAD_CONSENT_VERSION`, and
`NEXT_PUBLIC_LEAD_CONSENT_TEXT`. Use explicit `false` enable flags when a
feature is not approved; never invent retention, consent, or copy values. Keep `MONGODB_URI`, auth, analytics, metrics, and
revalidation secrets out of every `NEXT_PUBLIC_*` value; if Vercel hosts the
revalidation route, `CACHE_INVALIDATION_SIGNING_SECRET` is server-only.
Configure that same secret on the Render cache worker and set its
`CACHE_INVALIDATION_ENDPOINT` to
`https://<vercel-production-origin>/api/v1/internal/revalidate`. Verify one
signed invalidation and one rejected invalid signature after deployment.
Automatic Vercel Git deployments are disabled by the checked-in contract so
that an unrecorded branch update cannot bypass exact-revision promotion.

Render resolves a `fromService` value only when the Blueprint is synced; changing its source on `niro-api` does not continuously update `niro-web` or the cron services. Resync after every such source change and inspect each consumer. Because `NEXT_PUBLIC_*` values are embedded during the Next build, also rebuild/redeploy `niro-web` from the exact intended revision and rerun release verification; restarting an old web artifact cannot update browser-exposed origins or policy. On later Blueprint updates, add any newly introduced `sync: false` variable manually to existing services before deploy—Render does not re-run the first-creation prompt for it.

Run inside the environment that will launch each native process:

```text
npm run deploy:validate
```

The command reports only validated identifiers and public origins. It never prints credentials.

## Deployment sequence

1. Complete the repository quality/security gates; validate `render.yaml`; build the native server and client artifacts; and run `npm run deploy:native:verify`.
2. Record the source revision, Node/npm versions, `RELEASE_ID`, engine semantic version, provider build/deployment identifiers, selected service plans/capacity, client build-time values, environment diff, approver, and rollback identifiers.
3. Deploy the API and jobs through `deploy/native/render.md`. For a Vercel
   frontend, create a Next.js project with Root Directory `apps/client`, use the
   checked-in `apps/client/vercel.json`, and set the API/site/release values
   below before building the exact green commit. Any changed `NEXT_PUBLIC_*`
   source requires a newly identified web build from that exact revision.
4. Confirm startup, `/healthz`, `/readyz`, `/metrics` through the scraper, log drain, job execution, and one signed invalidation event.
5. Run staging smoke/E2E/performance/security gates. Do not publish a clinical calculator merely to test deployment.
6. Promote the exact tested native artifacts when the host supports artifact promotion. Otherwise deploy the exact tested revision with a separately recorded deterministic build; never deploy a moving branch. Runtime secrets/config may differ, but browser-exposed build values require a separate consciously identified client artifact.
7. Wait for all readiness probes and zero unavailable replicas, then run:

```text
npm run deploy:verify -- \
  --api-origin=https://<api-host> \
  --site-origin=https://<site-host> \
  --expected-release-id=<RELEASE_ID>
```

8. Confirm the public page, admin login boundary, a nonclinical/published-fixture read if one is approved, scheduler status, outbox backlog, and alert delivery. Record evidence.

## Health and shutdown

- API `/healthz` is process liveness and includes the non-secret release ID.
- `/readyz` requires an active database connection and turns unavailable as shutdown begins.
- Client `/api/healthz` is dependency-free process liveness and contains the release ID embedded in the client artifact. The release verifier requires both API and client IDs, so a stale web digest cannot pass promotion smoke checks.
- `/metrics` is disabled without `METRICS_SCRAPE_TOKEN` and otherwise requires exact bearer authentication. Also restrict it at the platform network layer.
- SIGTERM/SIGINT stops readiness, closes idle HTTP connections, allows 25 seconds to drain, closes remaining connections at the deadline, and disconnects Mongoose.

## Scheduler and workers

Run the current-day rollup every five minutes and the final/reconciliation command after midnight in `ANALYTICS_REPORTING_TIMEZONE`. Run cache invalidation every minute. Render cron schedules are UTC; `render.yaml` maps 00:15 Asia/Kolkata to 18:45 UTC and Render's single-run guarantee prevents overlap. Mongo `job_runs`, day-level materialization locks, and cache-event leases remain authoritative across retries and multiple scheduler invocations.

All three cron services receive `DEPLOYMENT_ENVIRONMENT`; the analytics services also receive `ANALYTICS_IDENTITY_KEY_VERSION`. Their compiled CLIs apply job-specific least-privilege production validation rather than demanding unrelated API/browser configuration: analytics validates every write-affecting identity/retention/reporting/cohort/visitor/assessment/lead value, and cache dispatch validates its Atlas identity, lease/batch settings, immutable release, deployment classification, and signed HTTPS callback. Missing or unsafe values fail the job before work begins.

Rollups remain blocked until assessment/event/lead and optional visitor retention policies are explicit. If lead capture stays disabled, product/privacy must approve a versioned disabled-source policy before changing the current fail-closed completeness rule; operators must not invent a consent version.

## Monitoring and logs

- Scrape `/metrics` from every API replica or through a backend that preserves fleet aggregation. Install the supplied availability, 5xx, p95, and process-memory rules and route warning/critical notifications to named responders.
- Configure external HTTPS uptime checks for `/healthz` and the public home page. Treat `/readyz` failures as deployment/DB alerts.
- Configure Atlas-native connection, replication, storage, latency, backup, and security alerts in the Atlas project.
- Alert on non-zero scheduler exits, missed five-minute/nightly executions, failed `job_runs`, cache invalidations that exhaust retries, and growing pending age shown by the operations dashboard.
- Drain JSON stdout/stderr logs to the selected backend with approved access and retention. Logs contain release/environment labels but must never add headers, bodies, URLs with queries, emails, IPs, health inputs, tokens, secrets, or capability values.

Provider dashboards, destinations, retention values, and on-call ownership are external release evidence and cannot be created from this repository alone.
