# Public client

This Next.js workspace is the server-rendered public application. It contains the published-calculator directory, generic config-driven calculator, reviewed structured content renderer, temporary share-safe result page, and the biomarker-library entry point. It deliberately contains no calculator-specific scoring code: the Express API and deterministic engine remain authoritative.

## Local configuration

The monorepo development command resolves the project-root `.env` deterministically and starts the client on `CLIENT_PORT` (default `3000`). Relevant variables are documented in the root `.env.example`:

- `API_BASE_URL` is used by Next.js server rendering.
- `NEXT_PUBLIC_API_BASE_URL` is used by browser requests. It contains no secret.
- `SITE_URL` and `NEXT_PUBLIC_SITE_URL` define the canonical public origin.
- `NEXT_PUBLIC_LEAD_CAPTURE_ENABLED` stays `false` unless retention and approved consent copy/version are also configured on the server and client.
- `NEXT_PUBLIC_ANALYTICS_ENABLED` enables first-party, allowlisted event delivery. Persistent visitor identity additionally requires `NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED=true`, a positive `NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS` matching the approved server retention, and the same approved `NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION`; otherwise it is disabled and any stale visitor identity is removed.
- `NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE` must match the server reporting timezone so the initial dashboard window has the correct local calendar day. The timezone returned by each analytics response remains authoritative.

Never expose `MONGODB_URI`, admin secrets, analytics hashing secrets, or any other server credential through a `NEXT_PUBLIC_` variable.

## Vercel frontend deployment

`vercel.json` is the checked-in frontend contract. Create the Vercel project
with Root Directory `apps/client`; it installs from the repository lockfile and
builds `deploy:build:client-native` from the workspace root. Configure
`API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL` to the Render API origin, and set
`SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `RELEASE_ID`, and `NEXT_PUBLIC_RELEASE_ID`
to the exact release/site values for that deployment. Also set the complete
browser policy contract explicitly for every production build:
`NEXT_PUBLIC_ANALYTICS_ENABLED`,
`NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE`,
`NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED`,
`NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS`,
`NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION`,
`NEXT_PUBLIC_LEAD_CAPTURE_ENABLED`, `NEXT_PUBLIC_LEAD_CONSENT_VERSION`, and
`NEXT_PUBLIC_LEAD_CONSENT_TEXT`. Disabled features still use explicit `false`
enable flags; never invent retention values, consent versions, or consent copy.
Keep
`CACHE_INVALIDATION_SIGNING_SECRET` server-only if the Render cache job calls
the Next revalidation route, and set the Render cache worker's
`CACHE_INVALIDATION_ENDPOINT` to the deployed Vercel
`/api/v1/internal/revalidate` route with the same secret. Automatic Git
deployments are disabled in `vercel.json`; releases must be deliberate CLI or
dashboard deployments of the recorded exact revision. Vercel account, domain, environment-variable,
preview, and production smoke evidence remain external deployment steps.

## Rendering and privacy boundaries

- Published directory/content is rendered with SSR/ISR and calculator pages emit reviewed metadata and allowlisted JSON-LD.
- Results are dynamic, `no-store`, `noindex`, and `no-referrer`; the share URL is a bearer capability and must be treated as private.
- Form progress is version-scoped and stored only in the current tab's `sessionStorage`.
- Public projections contain display snapshots but never formulas, scoring weights, internal traces, hashes, or persistence metadata.
- Lead capture is optional, separately consented, and cannot include or link assessment, result, visitor, or health data.
- Telemetry never includes health values, result/share identifiers, email addresses, raw user agents, or IP addresses. Capability routes are normalized before enqueue; only privacy-filtered UTM source, medium, and campaign attribution is allowlisted once per inactivity session; and lead submission deliberately emits no client event.
- `/admin/analytics` is authenticated aggregate reporting. Clinical distributions and low-count page/search/referrer/UTM/unit cells are permanently suppressed below the server privacy threshold and rendered as unavailable, never as false zeroes. Detailed audit trails and both CSV exports are admin-only; editors retain access only to the allowed aggregate panels.

## Checks

Run the root `npm run check` and `npm run build`. Component coverage includes the generic renderer, unit switching, conditional visibility, missing-data UX, API field mapping, six result blocks, safe content/Markdown, JSON-LD, accessibility, and SSR hydration restoration. The live synthetic browser fixture is created and removed only through the guarded root `p5:fixture` command; it is not clinical or catalog data.
