# P11 deployment package

The selected backend and scheduler deployment mode is Render's managed native
Node runtime, without Docker or Kubernetes. Root `render.yaml` is the provider
Blueprint, `native/processes.json` is the machine-readable process contract,
and `native/render.md` is the provider guide. The Next.js frontend is also
prepared for a Vercel project at `apps/client/vercel.json`; the existing Render
native web service remains a validated fallback for the same standalone
artifact. This package deliberately does not create or impersonate a hosting
account, secret manager, DNS zone, Atlas production project, monitoring
service, or incident channel.

## Selected assets

- `native/processes.json` pins the Node/npm runtime contract and exact API, web,
  analytics, and cache-worker commands and schedules.
- `scripts/prepare-next-standalone.mjs` completes the Next standalone artifact
  with static assets and runtime schemas.
- `scripts/verify-native-deployment.ts` fails closed when compiled entry points,
  runtime assets, health paths, or process commands drift.
- `apps/client/vercel.json` pins the Vercel Next.js project to the monorepo root
  install/build commands and `.next` output. Set the Vercel project Root
  Directory to `apps/client`; the commands intentionally move to the repository
  root so workspace dependencies are installed from the lockfile.
- `monitoring/` contains a bearer-authenticated Prometheus scrape example and
  baseline alert rules; the selected native host still needs an actual fleet
  scraper, log backend, alert destinations, and responders.

The files under `docker/` and `kubernetes/` are retained historical reference
assets. They are explicitly non-selected and must not be built, pushed, or
applied for this deployment.

## Native build contract

From the repository root with Node 24.x LTS and npm 11.6.1:

```text
npm ci
npm run deploy:build:server-native
npm run deploy:build:client-native
npm run deploy:native:verify
```

Set the approved non-secret client origins, policy switches, and
`NEXT_PUBLIC_RELEASE_ID` before the client build. Never expose MongoDB,
authentication, analytics-HMAC, metrics, revalidation, or restore credentials
as client build values. Inject server secrets only at runtime through the
selected provider's secret manager.

Before promotion, run `npm run deploy:validate` in each deployment environment
and then the read-only remote smoke command documented in the production
runbook. Both commands fail closed and print no secret values. Local validation
is repository evidence only; it is not proof of a staging or production
deployment.

Provider references: Render's [native runtimes](https://render.com/docs/native-runtimes),
[Blueprint specification](https://render.com/docs/blueprint-spec), and
[cron jobs](https://render.com/docs/cronjobs); Vercel's
[project configuration](https://vercel.com/docs/project-configuration/vercel-json)
and [monorepo guidance](https://vercel.com/docs/monorepos); MongoDB Atlas'
[IP access list and database-user connection guidance](https://www.mongodb.com/docs/atlas/driver-connection/).
