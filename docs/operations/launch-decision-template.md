# Launch decision memo template

Decision date: `<YYYY-MM-DD>`  
Release ID / native build and deployment identifiers: `<immutable identifiers>`  
Staging evidence bundle: `<durable location>`  
Production change ticket: `<identifier>`

## Decision

Status: `<GO | NO-GO>`  
Approved public calculator slugs: `<only currently publish-eligible slugs; use "none" when empty>`  
Explicitly held drafts and reasons: `<slug → unresolved readiness IDs>`

The approvers confirm that no draft was included to meet a target count and that zero calculators is the required result when none is eligible.

## Required evidence references

- Repository/CI acceptance and P10 Reusability evidence: `<location>`
- Per-calculator source decisions and complete worked examples: `<location>`
- Measurement and independent medical-review evidence bound to current hashes: `<location>`
- Content, citation, licensing, disclaimer, privacy, retention, consent, and legal approvals: `<location>`
- Staging smoke, accessibility, security, k6, and link-check evidence: `<location>`
- Production Atlas backup/PITR and isolated restore-drill evidence with achieved RPO/RTO: `<location>`
- Metrics/log/error/uptime/alert test incident and on-call evidence: `<location>`
- DNS/TLS/HSTS/CORS/proxy/secret-manager verification: `<location>`

## Rollback and monitoring window

Application rollback release: `<immutable prior release>`  
Calculator rollback procedure verified: `<evidence>`  
Database recovery escalation owner: `<name/role>`  
Launch monitoring window and success/abort thresholds: `<approved values; do not infer>`  
Incident channel/on-call destination: `<approved destination>`

## Sign-off

- Product owner: `<name, decision, timestamp>`
- Clinical/source owner: `<name, decision, timestamp>`
- Independent medical reviewer: `<name, credentials/jurisdiction, decision, timestamp>`
- Privacy/legal owner: `<name, decision, timestamp>`
- Security/platform owner: `<name, decision, timestamp>`
- Release/operations owner: `<name, decision, timestamp>`

Unsigned or placeholder fields make this memo a NO-GO. This template records decisions; it does not grant approval.
