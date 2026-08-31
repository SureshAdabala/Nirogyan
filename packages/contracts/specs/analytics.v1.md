# Analytics and Dashboard Contract v1

**Status:** P9 normative contract  
**Scope:** first-party public telemetry, aggregate reporting, administrator
analytics, durable rollups, and operational reporting. This contract does not
change any calculator, measurement, engine, clinical, or publication contract.

The platform has no public user accounts. A public "visitor" is an approved,
retention-bound pseudonymous browser identifier; a "session" is a separate
inactivity-scoped identifier. Neither term means a patient, member, or verified
person.

## 1. Privacy and identity invariants

1. The server HMAC-hashes visitor and session identifiers before persistence.
   The HMAC domains are different (`visitor:` and `session:`), so equal raw
   values cannot create a join key. Raw identifiers, raw IP addresses, raw user
   agents, result IDs, assessment IDs, share capabilities, email addresses, and
   health values are forbidden in `analytics_events`.
2. Session identity is the default. Persistent visitor identity is fail-closed
   unless the server and browser are both explicitly configured with an
   approved positive retention period and a matching, versioned consent/policy
   identifier. Disabling or changing that approval removes or rotates the
   browser identifier.
3. Browser visitor expiry and the server-side `anonymous_visitors.expiresAt`
   are sliding retention windows. TTL indexes perform physical deletion;
   queries and rollups also enforce `expiresAt > now` because MongoDB TTL
   deletion is asynchronous.
4. `ANALYTICS_IDENTITY_KEY_VERSION` labels HMAC generations. Sketches from
   different key versions or identity bases are never merged. A report spanning
   a rotation sums partition estimates as a conservative upper bound and says
   so. Rotate at a reporting-day boundary after the prior day has rolled up;
   changing a key without changing its version is prohibited.
5. Lead capture remains unlinked under ADR-032. There is no `lead_submit`
   telemetry event, calculator attribution for leads is reported as
   `unavailable-unlinked-v1`, and no dashboard implementation may infer a
   timestamp-based lead-to-visitor, calculator, result, assessment, share, or
   health relationship.
6. Analytics is optional and must never block calculator rendering, assessment,
   results, sharing, or lead capture. Browser storage or transport failure makes
   telemetry a bounded no-op/retry, not an application failure.

## 2. Public event-ingest contract

`POST /api/v1/events` accepts only:

```json
{
  "events": [
    {
      "eventId": "opaque idempotency identifier",
      "type": "page_view",
      "occurredAt": "ISO-8601 instant within 24 hours of receipt",
      "visitorId": "optional opaque identifier",
      "sessionId": "required opaque identifier",
      "props": { "path": "/c/example" }
    }
  ]
}
```

- Batch size is 1–50. Unknown envelope, event, and property fields are rejected.
- IDs are bounded opaque values; calculator slugs and dimension strings use
  restricted grammars and lengths. Event IDs are idempotent. Equal duplicates
  in one batch or a replay are counted as duplicates; conflicting reuse inside
  a batch is rejected.
- The endpoint returns `202` with accepted, duplicate, and filtered-bot counts.
  Invalid input returns `422`, conflicting in-batch idempotency data `409`, an
  unavailable privacy configuration `503`, and excess batches `429` with
  `Retry-After`.
- A bounded, in-memory, IP-based limiter is used transiently. Its IP key is not
  persisted. The map has time-based pruning and a hard size cap.
- Coarse browser family and major version, OS family, device class, and primary
  locale are derived server-side. Raw `User-Agent` and `Accept-Language` values
  are discarded. The deliberately small in-repository parser replaces the
  implementation plan's package suggestion to minimize fingerprinting fields
  and avoid an unnecessary parser/license dependency.
- Known bots are accepted as filtered and are not persisted.
- Capability paths are normalized to `/results/[capability]` (and the analogous
  API form) before storage. Query strings and fragments are forbidden.
- Referrer host plus UTM source, medium, and campaign may appear only once per
  inactivity session. The server acquires that right with an atomic,
  cross-instance HMAC-session claim after the complete batch validates; a
  losing concurrent request strips the attribution fields. IP-literal
  referrers, contact-like values, and long numeric values are rejected. UTM
  term/content are not accepted or stored.
- The server supplies device/browser/OS/locale. Client attempts to supply those
  fields are rejected as unknown.

### 2.1 Event/property matrix

| Event | Required properties | Optional properties | Meaning |
| --- | --- | --- | --- |
| `page_view` | `path` | `calculatorSlug`, first-session referrer/UTM fields | Non-admin page rendered |
| `calc_start` | `calculatorSlug` | `path`, first-session referrer/UTM fields | Calculator interaction began |
| `step_view` | `calculatorSlug`, `step`, `stepIndex` | none | Ordered form step viewed |
| `assess_submit` | `calculatorSlug` | none | Assessment API succeeded |
| `assess_error` | `calculatorSlug` | `step` | Client observed an assessment validation error |
| `result_view` | `calculatorSlug` | redacted `path` | Newly calculated result viewed |
| `share_open` | `calculatorSlug`, redacted `path`, `action: open` | none | Shared capability opened |
| `share` | `calculatorSlug`, `action: copy` | none | Share link copied |
| `retake` | `calculatorSlug`, `action: retake` | none | Retake selected |
| `search` | `query`, `zeroResults` | `path` | Directory/biomarker search |
| `unit_switch` | `calculatorSlug`, `parameterKey`, `unit` | none | Display/input unit changed |

Event-specific allowlists are enforced independently in the browser and server.
The server is authoritative. Calculator scope, authored step key/index, and
parameter/unit pairs are verified against the current published configuration;
calculator page paths must agree with their supplied slug.

Search telemetry is not free text. The server resolves a normalized value only
against the current published-calculator and verified-measurement identifier
vocabulary. Every unknown value becomes the fixed `[other]` bucket before the
event fingerprint or persistence boundary. Calculator-scoped events likewise
require a current published calculator identity. This intentionally narrows
content-roadmap reporting to canonical identifiers; arbitrary phrases are never
stored, even when repeated by multiple clients.

Request logs keep only the HTTP method and a query-free, capability-redacted
path. Headers (including User-Agent, Accept-Language, and Referer), query
objects, raw network addresses, and request bodies are excluded from the
serialized request log. Coarse UA/locale derivation occurs only at analytics
ingestion before the raw values are discarded.

## 3. Persistence and retention

### `analytics_events`

Stores idempotent minimized events, HMAC identifiers, identity key version,
server-derived coarse client properties, and `expiresAt`. Required indexes are
unique `eventId`, time/type, calculator/time, session/time, visitor/time, and an
absolute TTL index on `expiresAt`.

The database `eventId` is domain-separated HMAC evidence marked `hmac-v1`, not
the client value. The raw client identifier is used transiently for same-batch
conflict detection and is discarded before persistence/logging. Startup
one-way-migrates any legacy unmarked event IDs to the same evidence format.

### `analytics_attribution_claims`

Stores only `_id = HMAC(sessionId)`, `claimedAt`, and `expiresAt`. MongoDB's
intrinsically unique `_id` makes first-writer-wins atomic across application
instances. It never stores a raw session identifier, visitor identifier,
referrer, UTM value, network value, or health value. `expiresAt` has an
absolute TTL index and is also checked logically because TTL deletion is
asynchronous. During a rolling upgrade, retained attribution-bearing events
seed claims by HMAC evidence before a new claim is attempted, preventing an
already-attributed session from being counted twice. A claim may safely
outlive a failed telemetry write (privacy-safe undercount); analytics remains
non-blocking and is never made part of a clinical/application transaction.

### `anonymous_visitors`

Exists only when persistent visitor analytics is approved. It stores the HMAC
identifier, first/last seen timestamps, consent version, and sliding expiry. It
contains no event, health, result, calculator, or lead fields.

### `analytics_daily`

Stores idempotent per-day global and per-calculator aggregates in the configured
IANA reporting timezone. Its unique key includes day, timezone, scope,
scopeKey, and identity basis/key version. Server startup explicitly creates that partition
index and removes only exact known legacy unique keys, after filling safe
legacy metadata defaults; it never relies on production auto-indexing. It
stores only counts, bounded encoded dimensions,
non-reversible 64-register HLL sketches, and rollup provenance. It is retained
without TTL because source rows expire.

Before data crosses from a TTL-bound source into the permanent daily table:

- page-path, canonical search, zero-result search, referrer, and UTM source,
  medium, and campaign cells below `ANALYTICS_MIN_COHORT_SIZE` are discarded;
- score buckets, categories, omitted-parameter cells, unit cells, and version
  cells are retained only for eligible assessment/result cohorts and only when
  the individual cell also meets the minimum cohort;
- suppressed cells are not recoverable from the dashboard API after the source
  TTL expires, by design;
- zero-result search counts are `null` when their cell is absent or suppressed;
  the API never presents an unavailable small cell as an exact zero;
- score buckets are self-describing `[lowerInclusive, upperExclusive)` bounds
  derived from the immutable calculator version's declared score scale. The
  fallback is magnitude-adaptive; a universal 0–100 assumption is forbidden.

Assessment/result/lead counts are repeated across identity partitions for a
day, so dashboard queries select one deterministic canonical copy before
summing product counts. Telemetry counts remain partitioned and may be summed.

### Other sources

Assessment intelligence reads only non-expired `assessments` and `results` and
persists aggregates, never entered/canonical values or traces. Lead counts come
from non-expired, unlinked `leads`. Security metrics use retained
`login_attempts` and `audit_logs` according to their separate policies. New
login-attempt rows contain only domain-separated keyed account/network evidence;
startup one-way-scrubs any pre-P9 raw email field while retaining an opaque
grouping hash.

Historical overview, engagement, funnel, assessment-intelligence, and lead
trend reads use materialized `analytics_daily` rows: an HTTP request never
rebuilds the current reporting day from raw events, results, or assessments.
Current-day freshness is supplied by guarded rollup jobs. The overview's
explicitly labelled active-session value is the sole direct live event read and
is bounded to a five-minute, expiry-filtered window. Security, operations,
detailed audit, and capped CSV routes may perform bounded reads of their own
retained or operational collections; this exception does not permit a product
metric rebuild or unbounded scan on dashboard refresh.

## 4. Rollup and job contract

- The normal CLI invocation processes the previous reporting day and reconciles
  the day before it. Explicit backfills require both bounds and may not start
  before the shortest relevant source-retention window.
- `--current-day-partial` creates a leased, deterministic replacement of the
  current reporting day using a five-minute scheduled-time bucket. Repeated
  invocations in one bucket coalesce; a later bucket reruns the full durable
  materialization so newly arrived events are adopted without incrementing or
  double-counting prior rows. P11 may schedule this guarded producer for
  eventual current-day freshness.
- Writes require `--allow-analytics-write`, an exact
  `--expected-db-name=<MONGODB_DB_NAME>`, and an exact
  `--expected-node-env=<NODE_ENV>`. Production and database identity are never
  inferred.
- `job_runs` provides one unique job/scheduled-time record, an atomic MongoDB
  lease, heartbeats, bounded attempts, exponential retry timing, safe public
  error codes/messages, and durable completion metadata. Only the lease owner
  may heartbeat, finish, or fail the run.
- A separate `analytics_materialization_locks` lease keyed by reporting timezone
  and day serializes the actual full-day replacement across adjacent partial
  buckets, backfills, and reconciliations. Per-bucket `job_runs` history and
  retries remain durable, while an older in-flight snapshot cannot finish after
  and overwrite a newer bucket.
- Rollup replacement/upsert is deterministic. Re-running the same retained
  source window replaces the same logical daily rows rather than incrementing
  them.
- Calculator-scoped rollups accept stored events/results for both published and
  retired calculator identities. Ingest still requires publication at event
  time, but a later retirement cannot erase already accepted historical
  metrics during reconciliation.
- Every permanent replacement proves before writing that the reporting day
  remains inside the shortest explicitly configured event, assessment/result,
  lead, and any applicable visitor source-retention window. Base source policy
  is checked before scanning. If a disabled-policy reconciliation discovers
  retained visitor-basis events without a retained visitor policy, it fails
  closed after the read but before any write, preserving the existing permanent
  row. New rows record the checked source-retention provenance.
- A deployment scheduler is required in P11. P9 provides the guarded command
  and distributed lease; it does not pretend a workstation process is a durable
  production scheduler.

## 5. Administrator API and RBAC

All routes below require an authenticated `admin` or `editor`, set
`Cache-Control: no-store`, `Pragma: no-cache`, and
`X-Robots-Tag: noindex, nofollow`, and reject unknown query fields:

- `GET /api/v1/admin/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/v1/admin/analytics/engagement?...`
- `GET /api/v1/admin/analytics/funnel/:slug?...`
- `GET /api/v1/admin/analytics/scores/:slug?...`
- `GET /api/v1/admin/analytics/leads?...`
- `GET /api/v1/admin/analytics/security?...`
- `GET /api/v1/admin/analytics/ops`
- `GET /api/v1/admin/analytics/metrics`

Ranges are inclusive reporting days, validated calendar dates, and limited to
367 days. Clinical distributions are suppressed unless both assessment and
result cohorts meet the configured minimum. Low-count cells already removed at
rollup remain omitted and are disclosed as such. Per-day category mixes retain
the same suppression state; suppressed zero-result search cells are reported as
unavailable, never coerced to an exact zero.

The exact export routes are
`GET /api/v1/admin/analytics/exports/leads.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`
and
`GET /api/v1/admin/analytics/exports/assessments.csv?from=YYYY-MM-DD&to=YYYY-MM-DD&calculator=<slug>`.
They are additionally restricted to `admin`, capped at 100,000 rows, protected
against spreadsheet-formula injection, non-cacheable, and recorded in
`audit_logs` without exported PII. The assessment export omits input values,
canonical values, result data, and traces. The existing detailed audit endpoint
remains `admin`-only; editors see aggregate admin activity only.

Dashboard/API responses must never expose event HMACs, raw identities, IPs,
emails (outside the explicit admin lead CSV), health input values, result/share
capabilities, formulas, scoring bands or weights, engine traces, or protected
calculator configuration.

## 6. Metric semantics

- Visitor/session window uniques are HLL estimates, not exact user counts.
  Session fallback and mixed/key-rotation upper-bound states are labeled.
- New/returning applies only to approved persistent visitor rows; it is not
  inferred from sessions.
- "Live now" means distinct retained session hashes with an event in the last
  five minutes.
- Session duration is last minus first event within each session/day; pages per
  session uses the same session/day sample basis.
- Product completions, assessment counts, result counts, lead counts, scores,
  versions, and compute time originate from persistence, not client claims.
- Successful assessment counts are persistence-authoritative. Assessment-error
  counts and rates are explicitly `client-telemetry-observed-v1`: missing or
  blocked telemetry can undercount failures, so they are not total attempts or
  an authoritative server error rate.
- Lead conversion uses unlinked lead count divided by result-view telemetry and
  cannot be broken down by calculator in v1.
- Error, public-endpoint rate-limit, event-ingest, and config-cache counters are
  current-process-since-start values. Request p50/p95 latency uses the current
  instance's rolling last 5,000 requests. Neither scope is presented as a
  historical date-range metric. Prometheus output is authenticated.
- Operational health also reports database readiness, durable job state,
  pending/failed cache invalidations, recent publishes, logical event lag, and
  collection counts. Collection storage size is nullable when the Atlas role
  does not permit `collStats`.
- The dashboard's `health` value is dependency-aware and currently follows
  database readiness; it is not a direct sample of the separate `/healthz`
  process-liveness endpoint. The UI must not label it as `/healthz`.

## 7. Environment contract

Server-only variables:

```text
ANALYTICS_HASH_SECRET=<at least 32 secret characters>
ANALYTICS_IDENTITY_KEY_VERSION=v1
ANALYTICS_EVENTS_RETENTION_DAYS=<approved positive integer>
ANALYTICS_REPORTING_TIMEZONE=Asia/Kolkata
ANALYTICS_JOB_LEASE_SECONDS=900
ANALYTICS_MIN_COHORT_SIZE=5
ANALYTICS_VISITOR_PERSISTENCE_ENABLED=false
ANALYTICS_VISITOR_RETENTION_DAYS=<required when enabled; retain while disabled for historical reconciliation>
ANALYTICS_VISITOR_CONSENT_VERSION=<required when enabled; may remain configured while disabled>
```

Permanent materialization also depends on the source collections' approved
policy variables:

```text
ASSESSMENT_RETENTION_DAYS=<approved positive integer; applies to assessments/results>
LEAD_RETENTION_DAYS=<approved positive integer when the lead source participates>
LEAD_CONSENT_VERSION=<approved version matching retained lead records>
```

The rollup source-completeness gate validates these policies before reading or
replacing a permanent day. The current v1 implementation fails closed when a
required assessment/result or lead source policy is absent; it does not infer a
retention period or silently treat an unconfigured lead source as complete.

`ANALYTICS_MIN_COHORT_SIZE` must be an integer from 2 through 100; singleton
permanent cells are never permitted.

Browser-exposed policy switches (never secrets):

```text
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE=Asia/Kolkata
NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED=false
NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS=
NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION=
```

The server visitor-retention period must be at least the event-retention period
when persistent visitors are enabled. The public retention and consent values
must match the approved server policy operationally. Secrets belong only in the
ignored project-root `.env` or the deployment secret manager and must never be
committed, logged, embedded into browser bundles, fixtures, or reports.
