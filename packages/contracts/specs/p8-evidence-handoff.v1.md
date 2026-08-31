# P8 external evidence handoff v1

Status: normative operational companion to `calculator-version.v1`, the P0A
validation layers, and the P8 reconciliation package. It does not extend or
change calculator-version v1 semantics.

## 1. Purpose and safety boundary

P8 can identify missing evidence and maintain deterministic publication gates,
but software cannot decide unresolved medicine. The checked
`data/reconciliation/niro-evidence-requests.v1.json` register therefore records
only:

- which external decision or evidence class is missing;
- which qualified role must supply it;
- which discrepancy IDs remain affected; and
- what a complete handoff must contain.

It MUST NOT contain executable calculator fields, clinical thresholds, points,
formulas, bands, complete test inputs/expected results, reviewer identities,
review timestamps, protected hashes, or an approval decision. It cannot be
imported into MongoDB or applied to a calculator automatically.

COVID is excluded because it is an internal nonclinical fixture. The
quarantined 62-calculator/79-measurement research catalog is not an input.

## 2. Evidence request states

The checked P8 source uses only these fail-closed states:

- `awaiting-external-evidence` — the named owner role has not supplied a
  complete, verified packet;
- `blocked-by-prerequisite` — review must not begin until upstream source,
  measurement, test, or content evidence is complete.

`accepted`, `approved`, `resolved`, and equivalent states are intentionally not
valid in this register. Acceptance belongs to the authenticated Studio review
workflow and its server-owned audit/review hashes, not a hand-edited JSON file.

## 3. Required packet classes

Each calculator has five request classes:

1. `source-owner-disposition`: a decision for every affected discrepancy, with
   a precise locator in a versioned original/replacement source artifact and an
   explicit statement for any intentionally unscorable or out-of-scope case.
2. `measurement-review`: approved immutable measurement revisions, including
   unit, conversion, range/bound, context, derivation, claim, and source review
   required by the calculator. The catalog quarantine remains in force.
3. `complete-source-worked-example`: complete inputs covering every final
   dependency, the expected final score and category, a precise current source
   locator, and reviewer-approved boundary evidence. A partial stage result or
   a generated regression is insufficient for `PUB-007`.
4. `content-governance`: structured content, educational disclaimer,
   applicability, SEO, authorship, claim-level citations, source/license
   status, and the calculator's approved legal/privacy/retention policy.
5. `independent-medical-review`: a named, qualified reviewer under the approved
   credentials/jurisdiction/cadence policy, independent from the last protected
   editor, approving the final logic/content/citation/measurement/test hash
   envelope.

## 4. Intake workflow

External evidence is handled as follows:

1. Preserve the received artifact byte-for-byte and calculate its digest.
2. Confirm the submitter's authority and the source/reviewer role required by
   the request. A URL, email, or unsigned comment alone is not approval.
3. Map every decision to a stable discrepancy ID and precise artifact locator.
   Conflicting authorities remain separate; no synthetic compromise is
   inferred.
4. Have an editor apply the accepted decision to a **new draft** using existing
   Studio primitives. The handoff register never writes executable config.
5. Bind exact approved measurement revisions and add source-worked/boundary test
   cases. Run them with the production engine.
6. Run structural, semantic, clinical, publication, dependency, source/license,
   content/SEO, and saved-test validation. Open findings stay open.
7. Submit the complete protected snapshot to a distinct qualified medical
   reviewer. The server derives reviewer identity, timestamps, protected hashes,
   audit records, and lifecycle changes.
8. Publication remains an authenticated transaction and revalidates the current
   measurement snapshots, approval hash, and saved tests. No evidence packet can
   bypass this transaction.

## 5. Current locked non-clinical dispositions

The readiness register separates engineering behavior already fixed by the P0A
contract from residual medical approval:

- Diabetes `DIA-05` and `DIA-08` have locked aggregation/imputation semantics.
- Heart `HRT-15` and `HRT-19` have locked floor/alias semantics.
- Heart `HRT-20` has locked maximum-floor execution but still requires clinical
  approval.
- CWS `CWS-02` is only a public-copy distinction: 38 measured labs, 40 scored
  parameters, and 49 total parameters, or omit the count.
- CWS `CWS-17` is closed by revision-3 measurement provenance, which records
  exact source/version linkage and all 45 current calculator references while
  preserving stale legacy fields only as provenance.

These dispositions are not authority to change clinical values or mark a
calculator reviewed. All calculator-specific blockers enumerated by the
generated readiness report remain externally blocked.

## 6. Deterministic report

`npm run p8:readiness:check` revalidates the immutable sources and fixtures,
reconciles only the four allowlisted metadata-only draft candidates, executes
the four validation layers at the register's explicit contract-evaluation time,
verifies the Heart partial golden remains `satisfiesPUB007:false`, and compares
the generated JSON/Markdown artifacts byte-for-byte.

The report generator performs no database, configuration, review, or lifecycle
write. Regeneration is explicit through `npm run p8:readiness:write`; the changed
register and reports then require ordinary independent review.
