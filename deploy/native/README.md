# Selected native Node deployment contract

P11 selects Render's native Node runtime for the non-container deployment. The
API, Next.js web process, and scheduled workers run from one pinned source
revision according to `render.yaml` and `render.md`. `deploy/docker/` and
`deploy/kubernetes/` remain historical reference assets only. Docker/Kubernetes are
not the selected launch path and must not be applied.

## Runtime and build

Use Node 24.x LTS and npm 11.6.1 from the repository root. Configure the platform to
install with `npm ci`, never with an unlocked install. The machine-readable
commands and schedules are in `processes.json`.

- API build: `npm run deploy:build:server-native`
- API start: `npm run deploy:start:server-native`
- Web build: `npm run deploy:build:client-native`
- Web start: `npm run deploy:start:client-native`
- Artifact verification after both builds: `npm run deploy:native:verify`

Independent platform services may run the verifier with `--scope=server` or
`--scope=client` after their corresponding build, as recorded in
`processes.json`. The unscoped release gate requires both artifacts.

The client build copies Next static assets and contract schemas into the
standalone output. The production start command runs that standalone server;
`next start` is intentionally not used with `output: 'standalone'`.

The Next response contract emits `X-Content-Type-Options`, `Permissions-Policy`,
and preload-ready `Strict-Transport-Security`; the selected host must still
terminate HTTPS, configure DNS/canonical hosts, and retain the HSTS header in
its edge policy.

Set `NEXT_PUBLIC_RELEASE_ID`, `API_BASE_URL`, `SITE_URL`,
`NEXT_PUBLIC_API_BASE_URL`, and `NEXT_PUBLIC_SITE_URL` before the web build.
Only approved non-secret `NEXT_PUBLIC_*` policy values may also be supplied.
Server secrets remain runtime-only in the selected host's secret manager. Run
`npm run deploy:validate` in every service/job runtime configuration before
promotion; it fails closed without printing secret values.

## Processes and scheduling

The API health check is `/readyz`; process liveness is `/healthz`. The web health
check is `/api/healthz`. Keep the web at one serving instance until the selected
host proves shared Next cache coherence or complete signed invalidation fan-out.
API instances may scale independently once fleet metrics and database limits are
configured.

Bind the API with `HOST=0.0.0.0` and the web process with
`HOSTNAME=0.0.0.0`; both consume the provider-assigned `PORT`. Production
validation rejects an API process that binds only to loopback.

Schedule these native commands with failed-run alerts:

- every five minutes: `npm run deploy:job:analytics-partial`
- daily at 00:15 in `Asia/Kolkata`: `npm run deploy:job:analytics-final`
- every minute: `npm run deploy:job:cache`

The analytics wrapper supplies the CLI's exact database/environment assertions
from `MONGODB_DB_NAME` and `NODE_ENV`; durable MongoDB leases remain the
authoritative retry/concurrency boundary. Render cron uses UTC, so `render.yaml`
records the reviewed 00:15 Asia/Kolkata finalization as 18:45 UTC while the
application retains `ANALYTICS_REPORTING_TIMEZONE=Asia/Kolkata`.

## Promotion and rollback

Pin the source revision, Node/npm versions, `RELEASE_ID`, client build-time
values, and provider build/deployment identifiers in release evidence. Promote
the tested native artifact when the host supports artifact promotion. Otherwise
deploy the exact tested revision with an independently recorded deterministic
build; never deploy a moving branch as the rollback identity.

Rollback selects the last known-good native deployment/artifact identifier and
its matching server/client release IDs. Database or calculator rollback rules do
not change. No provider account, DNS record, secret, Atlas backup, scheduler, or
alert destination is created by these repository assets.
