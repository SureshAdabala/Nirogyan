# Content, SEO, citation, authorship, and medical-review contract v1

**Schema:** `../schemas/content-page.v1.schema.json`  
**Normative status:** locked by P0A

This contract implements the client requirement that a nontechnical author create the calculator **and its associated content as one publishable whole**. The five current calculator configs contain no conforming content object and therefore cannot be publish-eligible even when their logic is otherwise valid.

## 1. Version and ownership model

1. In v1, the complete content page is embedded in the immutable calculator-version snapshot.
2. A content-only edit creates a new calculator version with unchanged `logicHash` and a changed `medicalContentHash` or `seoHash` as appropriate.
3. Independent content revision storage is deferred until actual publishing cadence proves it necessary.
4. Published and retired versions remain reproducible, including their page text, citations, byline, review evidence, SEO fields, and redirect/canonical settings.
5. v1 locale is `en-IN`; the locale field is mandatory so later localization does not require reinterpreting stored text.

## 2. Structured, safe content

Allowed block types are defined by schema:

- Markdown prose
- typed callout
- FAQ
- steps
- table
- media reference
- related calculators/measurements/content
- disclaimer
- calculator embed
- crisis resources

Arbitrary HTML, JavaScript, iframe, inline style, event handlers, arbitrary JSON-LD, and remote embeds are forbidden.

Markdown is stored as source, parsed with raw HTML disabled, sanitized on write and render, and rendered using an allowlist. Links allow only approved protocols. Media uses managed asset IDs and mandatory alt text.

The page title is the only H1. Authored structure begins at H2. The rendering layer generates navigation and breadcrumbs from structured data rather than pasted markup.

## 3. Medical claims and citations

A **claim** is a versioned statement whose accuracy matters independently of surrounding prose. Thresholds, formulas, risk statements, recommendations, medical facts, and diagnostic-style interpretations are claims.

Rules:

1. Every medical claim has a stable claim ID and at least one resolved citation ID.
2. Every content block containing a claim lists its claim IDs.
3. A citation attached only to the page bibliography does not prove unrelated text.
4. External medical citations need organization/title, URL or stable identifier, accessed date, verification status, and license status.
5. Niro scoring citations need the local artifact and precise locator.
6. `demoPoints:true` is a nonclinical annotation, not evidence.
7. Conflicting sources remain separate and labeled. They are not blended into one synthetic recommendation.
8. Superseded, expired, search-only, blocked, or license-unclear evidence is retained for audit but blocks affected claims from publication.
9. Quotes are not required; when stored, they must be short and rights-compliant. The core evidence object is the source plus locator and reviewer decision.

Calculator rules, measurement values, and content claims SHOULD converge on one citation registry representation in P1. The calculator schema accepts current inline legacy sources only so the five draft fixtures remain structurally testable.

## 4. Authorship

Authorship snapshots contributor ID, display name, role, optional credentials/profile, owner, and timestamps. Roles are:

- author
- editor
- medical reviewer
- source reviewer

Public byline visibility is a product decision, but audit authorship is mandatory. Removing a user account never removes historical authorship snapshots.

## 5. Medical review

Medical review is a distinct permission, not inferred from `admin` or `editor`.

Protected scopes include:

- scoring rules, formulas, ranges, units, conversions, floors, overrides, imputation, and missing-data semantics
- result messages, recommendations, disclaimers, and medical claims
- evidence links and source status

The reviewer must not be the last author/editor of the protected change unless a formally documented small-team exception is approved and audited.

Approval binds to hashes:

- `logicHash`
- `medicalContentHash`
- `citationManifestHash`
- `measurementSnapshotHash`
- required-test evidence hash

Any protected change invalidates approval. A pure SEO edit may preserve medical approval only when all protected hashes remain unchanged. Review states are unreviewed, in review, approved, changes requested, rejected, and expired. Review expiry cadence and named reviewers remain business decisions; absence of a current required approval blocks publication.

## 6. SEO contract

### Canonical and indexing

- Calculator page canonical path is normally `/c/{calculatorSlug}`.
- Canonical paths are same-origin normalized paths, not arbitrary URLs.
- Old aliases receive a 301 redirect to the canonical page and are not separately indexable.
- Draft, in-review, rejected, retired, result, and share pages default to `noindex`.
- The sitemap includes only published, publish-eligible pages with `robots.index:true`.
- A publish event triggers Next.js revalidation for the page, directory, related measurement pages, sitemap, and affected aliases.

### Metadata and structured data

- Meta title/description length limits in schema are authoring bounds; uniqueness and quality are semantic checks.
- Open Graph values inherit title/description when omitted.
- Social images are managed assets with alt text.
- Server code generates JSON-LD only from reviewed structured fields.
- FAQPage is emitted only for visible FAQ content; BreadcrumbList derives from route hierarchy.
- Admins cannot paste arbitrary JSON-LD.

### Interlinking

Related calculators, measurements, and content use validated stable keys. Broken and circular links are warnings unless they affect required navigation; aliases resolve before canonical link generation.

## 7. Disclaimers and crisis content

Every medical calculator requires at least one typed educational disclaimer and cannot claim diagnosis or replacement of professional care unless explicitly approved for a regulated use case outside this contract.

Mental-health calculators with crisis-trigger behavior require a typed `crisis-resources` block, reviewed regional resources, a tested trigger reference, and an emergency presentation path before publication. This is a product/publication gate, not a mathematical formula.

## 8. Publish eligibility

Content contributes the following hard gates:

- conforming structured page exists
- safe content passes sanitization and link validation
- title, summary, canonical path, robots, and allowed schema types exist
- IDs are unique; every block claim resolves; every claim citation resolves
- all medical claims are verified and current
- all affected licenses are clear or held
- authorship is complete
- current medical approval covers the protected hashes
- required educational disclaimer is present
- no unresolved publish-blocking source or clinical discrepancy remains

Publish eligibility is computed. It is never an editable Boolean field.

## 9. Deferred decisions that do not block P0B

- production domain and brand/social assets
- public byline/credential display policy
- named medical reviewers
- review expiry cadence
- final legal disclaimer wording
- localization/hreflang beyond `en-IN`
- independent content service/collection
- full digital-asset-management workflow

These decisions block the affected publication or later feature, not repository scaffolding.
