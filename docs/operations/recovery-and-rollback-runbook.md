# Backup, restore, rollback, and cache recovery

## Atlas backup prerequisites

Before production writes, the Atlas owner must select a production tier and region that support the approved backup and point-in-time recovery objectives, enable the policy, set retention, restrict network access, enable audit/alerts, and create least-privilege runtime and restore-verification users. Record RPO, RTO, backup frequency/retention, encryption ownership, and named responders. Repository code cannot enable or prove these browser/account controls.

## Non-destructive restore drill

1. Record the production cluster, chosen restore timestamp, backup identifier, application release, database name, and expected RPO/RTO. Avoid a timestamp during a known multi-document operation where possible.
2. In Atlas, restore to a new isolated cluster. Never restore over the active cluster for a drill.
3. Permit network access only from the verifier and create a read-only restore user. Do not reuse the production runtime password.
4. Set these values only in the verifier environment/secret store:

```text
RESTORE_MONGODB_URI=<read-only URI for the isolated restored cluster>
RESTORE_MONGODB_DB_NAME=<restored application database>
RESTORE_TARGET_LABEL=restore-drill-<ticket-or-date>
```

5. Run the read-only verifier with an exact database assertion:

```text
npm run recovery:verify -- \
  --allow-read-only-restore-verification \
  --expected-db-name=<exact RESTORE_MONGODB_DB_NAME>
```

The verifier performs ping, required-collection and absolute-TTL-index checks, published-calculator pointer/immutability checks, result/assessment referential checks, and count inventory. It performs no insert, update, delete, index synchronization, or cleanup.

6. Compare the returned counts to Atlas metrics/evidence for the chosen restore point; run application smoke tests against an isolated deployment with outbound email/analytics/invalidation disabled; record achieved RPO/RTO and all discrepancies.
7. Delete the isolated cluster only through Atlas after evidence review and explicit owner approval. Repository scripts intentionally do not delete it.

The first completed drill remains an external P11/P12 gate until its evidence is attached; the script alone is not proof that backups are enabled.

## Application rollback

1. Freeze further promotions and identify the last known-good native server/client deployment or artifact identifiers, their exact source revision, and matching release IDs.
2. Determine whether the incident is application code, public cache, calculator configuration, or data. Never use database deletion as a rollback technique.
3. For application code, restore the previous immutable native deployments/artifacts with the compatible environment. If the host cannot promote stored artifacts, rebuild only the recorded exact revision with the recorded Node/npm and client build-time values. Wait for readiness and run the release verifier with the previous `RELEASE_ID`.
4. For a calculator, use Calculator Studio rollback-as-new-version. It preserves the source version, revalidates all publish gates, writes audit/outbox evidence, and does not mutate immutable history.
5. For cache-only incidents, run the cache dispatcher and inspect `cache_invalidation_events`; a failed downstream delivery remains retryable. Do not mark an event completed manually without proof that the selected shared web cache revalidated the allowlisted paths/tags.
6. Database point-in-time restore is a last-resort incident procedure requiring an approved change plan, write quiescence, preserved failed cluster, validated isolated restore, and explicit data-owner authorization.

## Multi-instance cache contract

Publishing/retiring commits a durable outbox row in the same transaction. The scheduler leases a row, signs `timestamp + "." + raw JSON` using `CACHE_INVALIDATION_SIGNING_SECRET`, and POSTs it to `CACHE_INVALIDATION_ENDPOINT`. Next accepts only fresh HMAC-authenticated v1 payloads and allowlisted calculator/biomarker/sitemap paths, then revalidates the corresponding Next paths/tags. Delivery is idempotent; failures use bounded exponential retry and remain visible.

The selected Next host must provide cache coherence for the revalidation endpoint across all serving instances. If it does not, the production architecture must provide an equivalent fan-out/shared-cache adapter before release; routing to an arbitrary single replica is not sufficient.
