# Render native Node deployment

Render is the selected managed host for the API and finite scheduled jobs in the
target topology. Its native Node runtime can build this monorepo directly, run
the Express service, execute the three finite scheduled jobs, perform HTTP health
checks, and keep every service in the Singapore region. The checked-in
`render.yaml` also retains the native Next.js web service as a validated fallback
when Vercel is not selected for a given environment. It is JSON-formatted YAML
and contains only `runtime: node`; it never selects an image or container
runtime.

The Blueprint deliberately sets `autoDeployTrigger: off`. Connect and prove a
staging environment first, then manually deploy an exact commit. Do not sync the
production Blueprint until the external launch-readiness owners have supplied
the Atlas, privacy/retention, domain, monitoring, recovery, and approval evidence.

## Before the first Blueprint sync

1. Put the repository in an accessible GitHub, GitLab, or Bitbucket project and
   protect its release branch with the complete CI workflow.
2. Create the Render workspace/project and choose whether the first environment
   is `staging` or `production`. The Blueprint does not invent that decision.
3. Add every value prompted by `sync: false`: the deployment environment, exact
   trusted-proxy hop count, Atlas URI/database, approved assessment/analytics/lead
   policies, exact HTTPS API/site origins, CORS origin, and signed invalidation
   endpoint. Never paste these values into the repository.
4. Allow the documented Render outbound ranges in the matching Atlas project,
   using the narrowest supported rule, and retain least-privilege database users.
5. Confirm that the five generated secrets are distinct. Render generates them
   once on initial sync; other services copy the required values from `niro-api`.
6. Review the provider plan, budgets, region, log retention, and alert destinations
   before accepting the resource plan. Repository defaults do not approve spend.

The Blueprint selects topology and region but does not prove or approve production
sizing. Web/cron plan choice, capacity, scaling, and cost remain external until the
platform owner records a load-supported production decision in the launch register.

## Blueprint updates and build-time values

Render resolves `fromService` environment values during a Blueprint sync; it does
not continuously mirror later source-service changes. After changing a value on
`niro-api` that feeds `niro-web` or a cron service, resync the Blueprint and verify
the resolved value on every consumer. A runtime restart alone is insufficient.

This is especially important for `NEXT_PUBLIC_*`: Next embeds those values in the
client artifact during `niro-web`'s build. Every source-value change therefore
requires a Blueprint resync followed by a rebuild/redeploy of `niro-web` from the
exact intended revision, then `deploy:verify` against matching API/web release IDs.
Do not reuse an older web artifact whose browser-exposed policy or origin differs.

On later Blueprint updates, Render does not prompt for a newly added `sync: false`
value as though the service were being created for the first time. Add each new
value manually to the affected existing service before deploying, then rerun the
production validator without printing the value. Never assume a successful
Blueprint parse means an existing Render environment has the new variable.

The web build embeds `RENDER_GIT_COMMIT` as `NEXT_PUBLIC_RELEASE_ID`; the API
starts with the same commit as `RELEASE_ID`. This lets the existing release
verifier reject mixed client/server revisions. Both web processes use the native
Node 24.x runtime and npm 11.6.1. `niro-web` remains one instance until shared
Next cache coherence or complete invalidation fan-out is proven.

## Jobs and time zones

Render cron expressions use UTC. The Blueprint therefore maps the application
schedules as follows:

- current-day partial analytics: `*/5 * * * *` (every five minutes);
- final analytics: `45 18 * * *` UTC, which is 00:15 in Asia/Kolkata;
- cache invalidation dispatch: `* * * * *` (every minute).

Render provides a single-run guarantee for each cron service. Mongo leases and
`job_runs` remain authoritative for retries and cross-service safety.

Each cron entry receives `DEPLOYMENT_ENVIRONMENT` from `niro-api`; both analytics
entries also receive `ANALYTICS_IDENTITY_KEY_VERSION`. The compiled job CLIs use
job-specific least-privilege production validation: analytics jobs fail closed on
their write-affecting identity, retention, timezone, cohort, visitor, assessment,
and lead policy, while the cache job requires only its Atlas, lease/batch, signed
HTTPS invalidation, immutable release, and deployment-environment contract. They
do not need unrelated API/browser secrets merely to satisfy the full web validator.

## Promotion evidence

After the first staging deploy, run `npm run deploy:verify` against the real API
and site origins, execute the remote Playwright/k6 security gate, trigger each job,
verify signed invalidation, configure metrics/log/error/uptime alerts, and complete
the Atlas restore and application rollback drills. Record immutable Render service
and deploy IDs in the launch register. A parsed Blueprint or local process smoke
does not count as a deployment.

Official references: [native runtimes](https://render.com/docs/native-runtimes),
[Blueprint specification](https://render.com/docs/blueprint-spec),
[cron jobs](https://render.com/docs/cronjobs), and
[Node version selection](https://render.com/docs/node-version).
