# Public biomarker library contract v1

**Normative dependencies:** `measurement-definition.v1.schema.json`,
`biomarker-measurement-units.v1.md`, `public-api.v1.md`  
**Implementation phase:** P6

This contract defines how the reviewed measurement library is migrated, stored,
queried, and presented. It does not change any P0A measurement, unit,
conversion, evidence, or medical-review semantics.

## 1. Core migration boundary

1. The only P6 migration input is the 40-record core fixture at
   `data/fixtures/config-samples/biomarker-dataset.json`. The 79-record
   measurement extension and 62-calculator research catalog remain quarantined.
2. Migration is deterministic and source preserving. It retains every legacy
   key, numeric value, conversion factor, formula, engineering bound, source
   URL/reference, conflict note, needs-clarification marker, and legacy scoring
   note in an auditable migration envelope.
3. The stale claim that Niro scoring was unavailable is retained only as
   historical input. The migration records
   `data/fixtures/config-samples/niro-cws.config.json` version 2 and
   `docs/research/niro-risk-logic-extraction.md` as the current scoring
   provenance. Calculator scoring is never copied into measurement reference
   ranges and the mutable library is never a runtime scoring dependency.
4. Missing per-value source attribution, boundary inclusivity, organization
   mapping, or hard-versus-soft classification is not inferred. It remains an
   explicit publication blocker alongside the original evidence.
5. Real migrated records are inserted as `draft`/`unreviewed` only. A seed job
   cannot assign a reviewer, approve/verify a record, retire a record, overwrite
   an existing revision, or mutate a same-identity record whose content hash
   differs.
6. The checked migration is canonical draft revision 3. The rejected revision-1
   and revision-2 generator outputs already persisted in the configured
   development database remain immutable audit history, not publishable medical
   data. Their exact per-key seed-owned content fingerprints and whole-revision
   hashes are checked in at
   `data/seeds/core-measurements.audit-history.v1.json`. A clean database need
   not recreate rejected history.

## 2. Seed safety and integrity

The checked-in seed and database command must satisfy all of these gates before
any write:

- exactly 40 unique core keys and 117 preserved legacy source objects;
- every one of the 45 `biomarkerKey` references in the five draft calculator
  fixtures resolves to a core key;
- every preserved numeric/formula/conversion/bound value has an evidence tag;
- source IDs, claim IDs, range IDs, and dependencies are unique and resolvable;
- unit codes are Unicode NFC, conversions are directional, finite, positive,
  canonical-targeted, unique by `fromUnit`, and numerically invertible within a
  declared tolerance;
- derived dependencies form an acyclic graph;
- conflict and needs-clarification evidence is retained and cannot be
  publication eligible;
- no key or record from the quarantined extension/catalog appears in the seed;
- every canonical measurement payload passes the P0A JSON Schema.
- all schema `date`, `date-time`, and URI formats pass the registered Draft
  2020-12 format validators; public source URLs additionally use safe HTTP(S);
- a non-derived publish candidate passes the shared semantic eligibility gate:
  controlled unit/dimension pairs, a route for every noncanonical scalar unit,
  exact typed composite adapters, nonempty finite intervals, soft-within-hard
  bounds, coherent declared range conflicts, and resolvable claim attribution;
- derived measurements are never seed-verified and remain public-ineligible in
  v1 (ADR-038).

The seed command is dry-run by default. Before `--apply`, it establishes the
exact guarded unique/public/text indexes and preflights chronology. Existing
v1/v2 rows must be either wholly absent or exactly match the checked audit
manifest; partial or drifted history fails closed. A missing revision 3 is not
backfilled behind a later revision. `--apply` uses one MongoDB transaction for
the missing set and records a durable job-run summary. Exact equality covers
the complete seed-owned envelope (`key`, `revision`, `status`, `displayName`,
`kind`, `canonicalUnit`, definition/hash, sources, and provenance). An exact
match is an idempotent no-op; any difference is a hard conflict. No delete,
replacement, or automatic verification is permitted.

## 3. Persistence vocabulary

The MongoDB measurement-revision document is a persistence envelope around the
canonical contract. Persistence status `verified` is the storage/public alias
for canonical status `approved`; the mapping is explicit and does not rename or
change the P0A lifecycle. Persistence kinds likewise map explicitly to the
canonical measurement kinds.

Only the highest `verified` revision for a key is public. Draft and retired
revisions never appear in public list, search, relation, sitemap, or detail
responses.

Verified and retired revisions are immutable at the Mongoose persistence
boundary across document and query updates. The sole v1 exception is a
metadata-only `verified` to `retired` transition; identity, canonical content,
sources, migration provenance, reviewer evidence, and hashes remain unchanged.

Medical verification and public reads execute the same non-derived semantic
eligibility gate in addition to schema, envelope, source, expiry, reviewer, and
hash checks. `derived-measurement` verification returns the stable
`DERIVED_VERIFICATION_UNSUPPORTED_V1` error and derived records are excluded
from public reads until a versioned SEM-055 contract exists.

## 4. Public query contract

- `GET /api/v1/biomarkers` accepts only bounded `search` and `domain` query
  values, returns one latest verified revision per key, and sorts stably by
  display name then key.
- Search uses the reviewed text index over display name, key, and aliases.
- Domain filtering targets `definition.domainKeys`.
- `GET /api/v1/biomarkers/:key` returns the latest verified revision or 404.
- Successful list and detail responses have deterministic ETags, the bounded
  public cache policy, and 304 revalidation.

Public projections are exact allowlists. They may expose reviewed identity,
aliases/domains, display units and conversions, descriptions, structured
interpretation-only ranges and context, public evidence metadata, related
same-domain summaries, and used-in published-calculator summaries. They never
expose persistence IDs, review/governance data, hashes, internal source refs or
notes, derivation expressions, calculator formulas, points, weights, bands,
traces, drafts, or retired records.

## 5. Relations

`usedInCalculators` is computed from the current immutable published calculator
versions whose parameters explicitly carry the measurement key. Legacy
`usedIn` metadata is migration provenance only.

V1 has no authored clinical relationship contract. `relatedBiomarkers` means
only “other reviewed measurements in the same domain,” is stable and bounded,
and must be labelled that way. It must not be presented as a medical or causal
association.

## 6. Public presentation

The directory provides search, domain browsing, and an A–Z view with linked
cards and distinct loading, outage, empty-library, and no-match states. Detail
pages are server rendered and include reviewed descriptions, units, structured
ranges, complete context, evidence disclosure, same-domain links, and
published-calculator links.

Conflicting ranges remain separate and organization/source labelled; the UI
never merges or averages them. Every range provides a keyboard-operable
provenance disclosure resolved through `sourceClaimIds`. Source links are
limited to safe HTTP(S) URLs.

Every detail page places this meaning next to its ranges: reference intervals
vary by laboratory, assay, method, population, and individual context; the
user's laboratory interval and clinician guidance take precedence; library
ranges are informational and are not calculator scoring bands. A missing
universal reviewed range is stated explicitly rather than represented as a
normal or safe result.

Detail metadata and sitemap entries include only latest verified records.
Structured data is limited to non-diagnostic page/breadcrumb metadata unless a
separately reviewed content contract authorizes a medical claim.

## 7. Live acceptance isolation

Synthetic acceptance fixtures are not migration or clinical data. They require
an explicit write opt-in and a uniquely named non-production temporary database
matching `niro_p6_<30 lowercase hex characters>`. The 30-hex (120-bit) nonce
keeps the complete database name within MongoDB's 38-byte limit. Shared development and
production database names are refused. The fixture uses canonical schema-valid
nonclinical snapshots, real revision identifiers/hashes, ownership markers,
transactions, collision checks, and cleanup verification. Original failures
and cleanup failures are aggregated so a leaked test identity cannot be hidden.
