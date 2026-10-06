# Risks and improvement roadmap

This document separates current risks from future capability. Priority reflects operational impact, tenant isolation, money correctness, recovery, and practical SaaS operation.

## Current strengths

- Server-calculated Decimal prices and item snapshots protect historical money.
- Serializable creation, destination locks, request hashes, and idempotency keys reduce duplicates and races.
- Staff authorization derives tenant/branch scope from membership.
- Composite foreign keys prevent many cross-branch relationships.
- Payment and fulfillment are separate.
- PostgreSQL persists state; SSE loss does not lose orders.
- Customer PromptPay claims never become payment without staff review.
- Refunds are explicit and over-refund is blocked.

## High-priority operational risks

### Manual PromptPay matching

**Risk:** Staff can match the wrong transfer, reuse a bank reference, or confirm a forged claim. Payment references are not unique across a merchant account.

**Improve:** Add a structured review screen, immutable audit events, duplicate-reference detection scoped to the receiving account, and optional private slip upload as review evidence. A slip remains untrusted until matched to the bank. Add a provider or direct-bank adapter only for merchants needing automatic settlement confirmation. See [Payments](PAYMENTS.md).

### Single-process real-time and rate limiting

**Risk:** SSE events and rate-limit counters are in memory. Multiple API replicas would have inconsistent events and limits.

**Improve:** Keep one replica while traffic permits. Before horizontal scaling, add shared event transport and rate limiting, define trusted-proxy/IP behavior, and monitor reconnects. PostgreSQL remains authoritative.

### Backup and disaster recovery

**Risk:** A persistent volume is not a backup. Host loss, operator error, corrupt data, or failed migration can stop operations.

**Improve:** Automate encrypted off-host backups, retention, restore drills, recovery objectives, and migration rehearsal against restored data.

### Limited observability and auditability

**Risk:** Confirmations, status changes, membership changes, settings changes, and operator actions lack a comprehensive append-only audit trail.

**Improve:** Add request IDs, structured safe logs, metrics, error tracking, health/readiness checks, and AuditEvent records for sensitive mutations. Do not log secrets, tokens, or unnecessary customer/payment data.

### Subscription expiry is not automatic

**Risk:** Trial dates exist but no scheduler changes status, sends reminders, collects payment, or applies grace policy.

**Improve:** Decide entitlement rules, implement idempotent scheduled evaluation and a notification outbox, then integrate billing. Keep provider state separate from access policy. See [Subscriptions](SUBSCRIPTIONS.md).

## Security and privacy

### QR capability abuse

Anyone with a copied active QR can order at that destination. Random tokens prevent guessing but not sharing. Improve with easy rotation, session closure, bounded public-order limits, anomaly monitoring, and optionally short-lived sessions where abuse is demonstrated.

### Application-enforced tenancy

There is no PostgreSQL row-level security. Protection relies on guards, scoped queries, composite constraints, and tests. Improve with carefully scoped data-access helpers, automated review/static checks, wider isolation tests, and optionally RLS once operational complexity is justified.

### Account protection

Password login has no MFA, user-facing session management, breach-password screening, or advanced lockout. Add owner MFA, session revocation, security notifications, and credential rotation before higher-risk adoption.

### Future payment slips

Slips contain personal and financial data. Store them privately, keep opaque keys and metadata in PostgreSQL, validate actual signatures and size, scan content, use short-lived staff URLs, encrypt at rest, define retention/deletion, and enforce tenant boundaries. A slip assists review but does not prove settlement.

## Product and correctness gaps

### Tax documents and accounting

Current reports are operational. Before tax invoices, obtain Thai legal/accounting requirements and define immutable numbering, seller/buyer fields, VAT, cancellations/credit notes, PDF retention, and audit rules. Do not infer tax treatment from order totals.

### Stock accounting

Product.available is a sold-out flag, not inventory. Stock needs units, receipts, adjustments, recipes, wastage, returns, negative-stock policy, concurrent deduction, costing, and audit. Build it as a separate bounded domain only after operational rules are explicit.

### Reporting semantics

Reports count orders and confirmed payments. Refund treatment, cancellation timing, business-day cutoffs, and tax semantics need definitions before financial use. Add reconciliation and exports after those definitions.

### Accessibility and localization

The UI needs systematic keyboard, screen-reader, contrast, Thai-language, currency formatting, and long-text testing. Establish localization before hard-coded copy expands.

## Recommended sequence

### Phase 1: operational hardening

1. Automated backups and tested restore.
2. Structured logging, error tracking, health endpoints, and metrics.
3. Audit events for payment, refund, order, membership, and settings changes.
4. More permission, concurrency, failure-path, and browser tests in CI.
5. PromptPay review, duplicate-reference detection, and optional private slip evidence.

### Phase 2: SaaS operations

1. Subscription entitlement policy and idempotent scheduler.
2. Notification outbox and delivery retries.
3. Owner subscription UI and operator support tools.
4. Tenant export/deletion and retention policy.
5. Owner MFA and session management.

### Phase 3: measured scale

1. Load-test menu, submission, staff board, and reports.
2. Add shared event/rate infrastructure before multiple API replicas.
3. Add object storage for images and payment evidence with lifecycle rules.
4. Improve pagination, archival, and indexes from real query plans.

### Phase 4: optional expansion

Add automatic payments, tax documents, inventory, printers, integrations, or analytics only when customer needs justify their operational cost. Preserve the focused ordering loop.

## Production-readiness checklist

- Isolation tests cover every protected resource.
- Order creation remains idempotent and race-safe.
- Payment and refund actions retain human or provider evidence.
- Backups restore successfully in a timed drill.
- Monitoring detects API, database, email, and stream failure.
- HTTPS, secret management, and environment validation are configured.
- Migration rollout and recovery are rehearsed.
- Staff recover from SSE loss by reloading database state.
- Payment, tax, retention, and privacy procedures match deployed features.
- Planned features are not advertised as implemented.
