# Public API Contract v1 (P3)

This is the active P3 boundary contract for the public Express API. The archived
API design documents remain historical context; this contract records the
security, reproducibility, and privacy decisions implemented in the current
server.

## Endpoints

- `GET /api/v1/calculators` returns published directory cards only.
- `GET /api/v1/calculators/:slug` returns the renderable public projection of
  the latest published version. A known calculator with only retired versions
  returns `410 CALCULATOR_RETIRED`; an unknown or never-published slug returns
  `404 NOT_FOUND`.
- `POST /api/v1/calculators/:slug/assess` validates the request, executes the
  server-authoritative engine, and persists an assessment/result pair.
- `GET /api/v1/results/:shareToken` reads a random capability-token result only
  while it is unexpired and not revoked.
- `GET /api/v1/biomarkers` and `GET /api/v1/biomarkers/:key` expose only the
  latest verified measurement revision for each key, with persistence metadata
  removed. The list accepts only bounded `search` and `domain` filters.
- `POST /api/v1/leads` optionally captures a separately consented email when
  lead retention and consent-version configuration are both enabled.

Successful responses use `{ "data": ... }`; failures use
`{ "error": { "code", "message", "fields?" } }`.

## Public projection boundary

The public calculator projection may contain renderer configuration, parameter
labels/validation/unit choices, educational content, disclaimers, SEO fields,
and display-only category labels/colors/messages. It never contains scoring
rules, formulas, lookup tables, floor/adjustment rules, domain weights, point
values, review/governance hashes, measurement snapshots, or persistence IDs.

Share results are an explicit allowlist of score/category, safe parameter state,
safe domain score/coverage summaries, coverage percentages, contributor keys,
warnings, and an immutable safe presentation snapshot copied from the exact
published calculator version at assessment time. The presentation snapshot is
limited to calculator slug/version/name/summary/disclaimers, result-block
layout, display scale min/max/direction, parameter labels/biomarker keys/units,
and domain keys/labels. It contains no bands or thresholds. Legacy results may
omit the snapshot. Share responses never contain formulas, scoring weights, points,
possible/earned-point internals, raw engine traces, share-token hashes,
idempotency hashes, database identifiers, or timestamps. Full internal result
snapshots and traces remain persisted for future authorized audit use.

## Assessment request and idempotency

The body is an object containing only:

```json
{
  "inputs": { "parameterKey": "scalar or {value, unit}" },
  "omitted": ["optionalParameterKey"],
  "visitorId": "optional bounded pseudonymous id",
  "sessionId": "optional bounded session id",
  "idempotencyKey": "optional 8-128 character key"
}
```

`Idempotency-Key` may be supplied as a header; body and header values must match.
Unknown top-level fields, unknown omitted keys, invalid identifiers, and invalid
units/values are rejected with 422. The exact published version document ID is
required for an assessment; a record without one returns 503 rather than
creating a non-reproducible result.

The server stores only a calculator-scoped SHA-256 idempotency-key hash under a
unique sparse index. A matching request in the same process replays its original
response. A changed request using the same key returns 409, and the durable
store rejects duplicate keys transactionally. The raw key is not stored or
logged.

User-correctable engine/input failures return 422 with field findings.
Configuration, source-gap, domain, formula, lookup, and scale-contract
failures return a generic 503 and never masquerade as a user result.

## Caching and privacy

Directory and calculator-config reads return a deterministic strong ETag,
`Cache-Control: public, max-age=30, must-revalidate`, and support
`If-None-Match` with 304. Negative calculator detail responses explicitly use
the same bounded 30-second cache policy so reversible 404/410 states are never
cached heuristically. Share-result responses—including 404, expired, and
revoked responses—return `Cache-Control: no-store`, `Pragma: no-cache`, and
`X-Robots-Tag: noindex, nofollow`.

Biomarker list and detail reads use the same deterministic ETag/304 and bounded
public cache policy. Their exact allowlists contain reviewed identity,
descriptions, units/conversions, structured interpretation-only ranges and
context, public source metadata, safe same-domain summaries, and published
calculator summaries. They never expose drafts, retired revisions, internal
source refs/notes, governance/reviewer fields, hashes, derivation expressions,
or scoring implementation. Public relation and migration semantics are defined
in `biomarker-library.v1.md`.

The public measurement predicate is only a database prefilter. Every candidate
must also pass the same complete non-derived semantic/envelope/review/hash gate
used for verification before projection. Malformed Mixed arrays are ineligible
rather than aggregation errors. Derived measurements fail closed in v1.
`usedInCalculators` joins only the owning calculator's current published-version
pointer; stale or orphan published-version documents are excluded.

Share tokens are generated with cryptographic randomness, are stored only as
SHA-256 hashes, and are filtered by both `revokedAt` and `expiresAt`. TTL
indexes provide eventual cleanup; read-time predicates provide immediate
expiry/revocation enforcement.

The assess endpoint uses a bounded in-memory per-IP limiter. A 429 response is
`RATE_LIMITED`, includes `Retry-After`, and is never cacheable. Request logging
redacts authorization, cookies, idempotency keys, lead email, and the
`:shareToken` segment of every result URL; capability tokens must never appear
in application logs. Production ingress/CDN/hosting access logs MUST also
redact or suppress public and API result capability paths and `Referer` values.

Assessment and optional lead-capture responses return `Cache-Control: no-store`.
Lead capture has its own bounded per-IP rate limit.

## Persistence and reproducibility

Assessment and result inserts are committed together in a MongoDB transaction.
Both documents carry the exact `calculatorVersionId`, calculator version, and
engine semantic version; entered/canonical inputs, omission snapshots,
conversion hash, complete internal projection, and trace are retained subject
to the configured TTL. Public result reads do not expose those protected
implementation details.

Assessment/result persistence is enabled only with an explicit positive
`ASSESSMENT_RETENTION_DAYS`. Production configuration fails closed when MongoDB
is configured without it; there is no inferred production retention period.

## Optional lead capture

Lead capture is disabled unless both `LEAD_RETENTION_DAYS` and
`LEAD_CONSENT_VERSION` are configured. The request body contains only `email`,
`consent:true`, and the exact configured `consentVersion`. Unknown fields,
including visitor, calculator, assessment, result, or share-token linkage, are
rejected. Email is normalized to lowercase and stored with the consent version
and a TTL expiry derived from the approved retention period. Responses never
echo the email and are never cacheable. This endpoint does not resolve or
permit lead-to-health-result linkage: v1 expressly forbids linkage to visitor,
calculator, assessment, result, share-capability, or health data (ADR-032).
