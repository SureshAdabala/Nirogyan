# Admin API Contract v1 (P4)

**Normative status:** locked for P4 implementation  
**Base path:** `/api/v1/admin`  
**Applies to:** administrative authentication, authorization, calculator/version
workflows, saved tests, measurement revisions, audit, and publication side effects

This contract specializes the P0A architecture decisions for the administrative
API. It does not change `calculator-version.v1`, `measurement-definition.v1`,
engine semantics, clinical values, or any publish gate. The words **MUST**,
**MUST NOT**, **SHOULD**, and **MAY** are normative.

## 1. Boundary conventions

- JSON successes use `{ "data": ... }` and failures use
  `{ "error": { "code", "message", "fields?" } }`.
- Unknown request properties, MongoDB operators, malformed identifiers, and
  values outside configured body/string/array/depth limits MUST be rejected at
  the boundary. Administrative data never becomes executable JavaScript.
- Every administrative response, including errors and preview results, MUST use
  `Cache-Control: no-store`. Authentication responses SHOULD also send
  `Pragma: no-cache`.
- Errors MUST NOT expose stack traces, password hashes, tokens, cookie values,
  connection strings, raw query objects, or unrequested engine internals.
- Request logs MUST redact authorization, cookies, passwords, refresh/access
  tokens, CSRF secrets, and any other credential-bearing fields.
- Every write in this contract MUST produce an append-only audit record. Audit
  summaries identify changed paths/hashes and lifecycle effects; they MUST NOT
  copy credentials or unnecessary full health/clinical payloads.

## 2. Roles and authorization

Administrative roles are `admin`, `editor`, and `medical-reviewer`. Public users
have no account or login.

| Capability | `admin` | `editor` | `medical-reviewer` |
|---|---:|---:|---:|
| Read admin calculator/version state | yes | yes | yes |
| Create/edit draft, validate, preview, manage/run saved tests | yes | yes | read/preview |
| Submit a draft for review | yes | yes | no |
| Record medical approval of protected hashes | no, unless separately granted the medical-reviewer permission | no | yes |
| Publish an already approved, publish-eligible version | yes | no | yes |
| Retire a published version | yes | no | no |
| Manage admin users and roles | yes | no | no |
| Create/edit/retire measurement revisions | yes | no | review only |
| Record medical verification of a measurement revision | no, unless separately granted the medical-reviewer permission | no | yes |

An `admin` role is not evidence of medical approval. A deployment that represents
permissions as one role per account MUST use a distinct `medical-reviewer`
account for protected review. If multiple permissions per account are added
later, the medical-reviewer grant and reviewer identity remain explicit and
auditable. The independent-review rule in `content-governance.v1.md` still
applies.

Authentication and authorization failures are deliberately distinct:

- missing, expired, revoked, or invalid authentication returns 401
  `UNAUTHENTICATED`;
- an authenticated principal without the required permission returns 403
  `FORBIDDEN`;
- disabled users and revoked sessions MUST fail even if a previously issued
  credential has not reached its nominal expiry.

## 3. Authentication and session contract

The active endpoints are:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Passwords MUST use the configured strong parameterized password hash. Login is
rate-limited and uses a persisted failed-attempt counter and timed lockout.
Responses do not reveal whether an email exists. A locked account returns 423
`ACCOUNT_LOCKED`; ordinary credential failure returns 401
`INVALID_CREDENTIALS`.

Successful login issues a short-lived access credential and a longer-lived
refresh credential belonging to a refresh-session family. Browser credentials
are sent only in `HttpOnly` cookies with an explicit path and `SameSite`
attribute; production cookies MUST also be `Secure`. Tokens MUST NOT be returned
in URLs or logs.

Refresh credentials are stored only as one-way hashes. Every successful refresh
rotates the credential in the same family. Reuse of an old or mismatched refresh
credential MUST revoke the family and fail closed. Logout revokes the presented
session and expires both cookies. Disabling a user or changing that user's
password MUST revoke all active session families for that user.

Because browser authentication uses cookies, every state-changing authenticated
admin request MUST pass CSRF validation. The server MUST bind a non-secret CSRF
request value to the authenticated session and require it in a custom header;
same-origin/CORS and `SameSite` settings are defense in depth, not a substitute.
Pure bearer-token automation that never authenticates by cookie MAY use a
separately documented CSRF exemption after the bearer token is validated.

## 4. User management

The active endpoints are:

- `GET /users`
- `POST /users`
- `PATCH /users/:id`

Only `admin` may use them. Create accepts a normalized unique email, a password
that passes the configured policy, and one allowed role. Update may change role,
status (`active | disabled`), or rotate a password. Responses use an allowlist
of safe account metadata and MUST never return `passwordHash`, session hashes,
tokens, or security evidence intended only for internal logs.

The API MUST prevent an administrator from disabling their current account and
MUST prevent any operation that would leave no active `admin`. Email uniqueness
and the last-admin invariant must remain safe under concurrent requests. Every
create, role/status change, password rotation, session revocation, and rejected
last-admin attempt is auditable.

## 5. Calculator and version endpoints

The active route family is:

- `GET /calculators`
- `POST /calculators`
- `GET /calculators/:slug/versions`
- `GET /calculators/:slug/versions/:version`
- `POST /calculators/:slug/versions` (new draft or edit-by-copy)
- `PATCH /calculators/:slug/versions/:version` (replace the stored payload)
- `POST /calculators/:slug/versions/:version/validate`
- `POST /calculators/:slug/versions/:version/submit-review`
- `POST /calculators/:slug/versions/:version/approve`
- `POST /calculators/:slug/versions/:version/publish`
- `POST /calculators/:slug/versions/:version/retire`

The lifecycle is `draft -> in-review -> approved -> published -> retired`;
`in-review -> rejected` is also allowed. A returned draft may move back to
`draft` only through an explicit reviewed transition. Published and retired
versions are immutable. Any protected edit creates or returns to a new draft and
invalidates approvals whose bound hashes changed.

New version numbers are positive and unique within one calculator. Edit-by-copy
copies the selected immutable snapshot, measurement revision references, and
embedded measurement/content/test snapshots into a new draft; it never edits
the source version. Creating a draft does not imply structural, semantic,
clinical, or publish eligibility.

### 5.1 Optimistic concurrency

Every version read returns a strong `ETag` derived from the stored version
revision/hash. A client that writes an existing version or advances its
lifecycle MUST send that exact value in `If-Match`.

- absent precondition returns 428 `IF_MATCH_REQUIRED`;
- a stale/nonmatching precondition returns 409 `VERSION_CONFLICT`;
- an edit to an immutable version returns 409 `VERSION_IMMUTABLE`;
- a successful write returns the new `ETag`.

The compare-and-write MUST be atomic at persistence level. Reading an ETag and
then unconditionally saving is insufficient under concurrent requests. `*` is
not accepted for clinical/version writes.

### 5.2 Validation, review, and approval

`validate` returns the four distinct P0A outcomes: structural, semantic,
clinical, and computed publish eligibility. It MUST NOT collapse a schema pass
into medical approval. Submitting for review requires structural pass and the
semantic subset needed to inspect/execute the draft.

Medical approval is recorded only by a medical reviewer and binds to the
current `logicHash`, medical-content hash, citation-manifest hash, measurement
snapshot hash, and required-test evidence hash. Any protected hash change
invalidates that approval. Approval cannot be inferred from a lifecycle string
or `admin` role.

## 6. Preview and saved test cases

The active endpoints are:

- `POST /calculators/:slug/versions/:version/preview`
- `GET /calculators/:slug/versions/:version/test-cases`
- `PUT /calculators/:slug/versions/:version/test-cases`
- `POST /calculators/:slug/versions/:version/test-cases/run`

Preview uses the exact same `packages/engine` build and calculator snapshot used
by production assessment, with sample `inputs` and no assessment/result write.
The draft must pass structural validation and the executable semantic subset.
The response includes the full ordered trace for authorized administrative
inspection. That trace is never part of a public config, public assessment, or
share response.

Saved cases conform to the unchanged `calculator-version.v1` `testCase` shape.
Updating them is an `If-Match`-guarded protected write, updates the test-evidence
hash, invalidates affected approval, and creates an audit record. The runner
evaluates every declared expectation with the production engine and returns a
per-case/per-assertion diff. It does not alter an expected clinical value to
make a test pass.

Required, source-worked-example, and golden test failures block approval and
publication under `SEM-044`, `PUB-006`, `PUB-007`, and `PUB-013`. Required test
evidence is embedded in the immutable published version. Optional tests, if a
later contract explicitly distinguishes them, cannot be mislabeled required or
used to bypass a failed required test.

## 7. Measurement/biomarker revision management

The administrative alias `biomarkers` manages versioned measurement revisions:

- `GET /biomarkers[?status=...]`
- `GET /biomarkers/:key`
- `POST /biomarkers`
- `PATCH /biomarkers/:key/:revision`
- `POST /biomarkers/:key/:revision/verify`
- `POST /biomarkers/:key/:revision/retire`

Revision keys and positive revision numbers are immutable identities. Draft
revision content may be edited; verified and retired revision content is
immutable and changes require a new revision. A transition from `draft` to
`verified` requires at least one resolved source entry, but source presence is
only a necessary gate: it does not replace structural, semantic, clinical,
license, or medical-review checks.

Units and conversions remain governed by
`biomarker-measurement-units.v1.md`. Verification MUST reject zero/nonfinite or
directionally invalid conversion factors, unlinked numeric claims, unresolved
source statuses, and missing protected medical review. A published calculator
continues to use its embedded measurement snapshot and immutable revision
reference; changing the library never changes an existing published result.

Verification and public eligibility MUST use the same shared non-derived
semantic gate. In addition to structural validation, it enforces controlled
unit/dimension pairs, conversion coverage for every noncanonical scalar unit,
exact typed composite adapter components, finite nonempty intervals,
soft-within-hard containment, declared conflict-group coherence, resolvable
claim attribution, strict evidence dates/URLs, and current review/hash evidence.

V1 cannot safely approve a `derived-measurement`: the schema does not snapshot
immutable dependency revisions/hashes or define a typed dimension-aware
measurement-expression evaluator. Verification therefore returns 422
`DERIVED_VERIFICATION_UNSUPPORTED_V1`; a later schema/semantic version must add
that contract before derived records can become public.

Verified and retired measurement content is immutable in persistence, not only
at the route. Document saves and query/replacement updates MUST reject changes
to identity, definition, units, sources, provenance, reviewer evidence, or
hashes. Only an authorized metadata-only `verified -> retired` transition is
permitted.

## 8. Rollback-as-new-version

`POST /calculators/:slug/rollback` selects an explicit prior source version and
creates a new, unique version containing a copy of that immutable snapshot. It
MUST NOT change the source or overwrite any published/retired document.

A caller may request draft-only rollback or immediate republish. Immediate
republish runs the complete current validation, required-test, evidence,
review-expiry, authorization, and publish gates; historical publication is not
an exemption. Approval evidence may carry forward only when every protected
hash is unchanged, the review is still current, and policy explicitly permits
it. Otherwise the clone remains a draft for new review.

For immediate republish, creation of the new snapshot, status/current-pointer
change, audit records, and durable revalidation event occur in one transaction.
A conflict allocating the next version returns 409 and may be safely retried;
it never falls back to mutating history.

## 9. Atomic publication, audit, and invalidation

Publishing is one transaction containing:

1. a conditional check that the version is still `approved`, matches its
   precondition, and is publish-eligible under current immutable evidence;
2. the transition to `published` and immutability timestamp;
3. the calculator's current-version pointer/status update;
4. the complete embedded content, review, test, and measurement snapshots;
5. an append-only actor/action/diff audit event; and
6. a durable cache/revalidation outbox event.

No public reader may observe a current pointer to an uncommitted version or two
current versions. A failed transaction has no partial publication side effects.

After commit, the server invokes an idempotent invalidation hook for the public
calculator projection and directory. The fan-out target also covers the public
page, related measurement/content pages, sitemap, and affected aliases as those
consumers are implemented. Multi-instance delivery consumes the durable outbox
event; process-local invalidation alone is insufficient in production. Exact
provider selection remains deferred by `DEF-007`, but the hook/outbox boundary
is required now. Hook failure retains a retryable durable event and MUST NOT
silently present stale publication as fully revalidated.

Retirement follows the same audit/outbox ordering and removes the retired
version from public-current projections without deleting its immutable history.

## 10. Status and error mapping

| Status | Meaning and stable examples |
|---:|---|
| 200/201/204 | successful read/write/create/logout |
| 400 | malformed JSON or syntactically invalid request framing |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, invalid/expired/revoked token |
| 403 | `FORBIDDEN`, failed CSRF validation |
| 404 | requested calculator/version/user/measurement is not visible to this admin operation |
| 409 | `VERSION_CONFLICT`, `VERSION_IMMUTABLE`, illegal lifecycle, duplicate identity, last-admin/self-disable conflict |
| 413 | configured request-body limit exceeded |
| 422 | request/schema/semantic/clinical/test/publish-gate findings with safe field details |
| 423 | `ACCOUNT_LOCKED` |
| 428 | `IF_MATCH_REQUIRED` |
| 429 | login or administrative abuse limit exceeded, with `Retry-After` |
| 503 | authentication, persistence, transaction, engine/schema version, or durable invalidation dependency unavailable |

Expected validation and concurrency failures never become generic 500s. A true
internal error uses a generic 500 response and is correlated to protected
server logs by request ID.

## 11. Contract invariants

- Admin preview and public assessment share one deterministic engine; only the
  authorized response projection differs.
- A public endpoint never exposes an admin trace, draft, formula, weight,
  internal review record, or audit record.
- Passing JSON Schema is not clinical approval, and having a source is not
  measurement verification.
- Published history, audit history, and prior clinical values are never deleted
  or rewritten to resolve an edit, test, rollback, or cache failure.
- The quarantined calculator/measurement catalog is outside this API's import
  scope until its separate integrity and review gates pass.
