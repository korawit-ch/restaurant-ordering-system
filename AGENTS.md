# Repository guidance

## Architecture

This is an npm-workspaces/Turborepo TypeScript monorepo.

- apps/web is the Next.js App Router frontend. It owns customer, staff, restaurant-admin, and platform-operator pages. Client server state uses TanStack Query and calls the API through /api.
- apps/api is the NestJS API. Controllers define transport boundaries; Zod parsing, authorization, business rules, transactions, and external integrations remain server-side.
- packages/prisma owns the PostgreSQL schema, migrations, generated client, and seed logic. The Prisma schema and migrations are the database source of truth.
- packages/api-client contains runtime-agnostic endpoint contracts and API types. Keep it free of browser-, Next.js-, and NestJS-specific code.
- packages/ui, packages/design-system, and packages/icons are shared presentation packages.

The web app may depend on shared packages. The API may depend on Prisma and shared packages. Shared packages must not depend on either application.

## Domain invariants

- Scope all restaurant-owned reads and writes by tenantId and branchId. Staff scope comes from the authenticated BranchUser; never trust tenant or branch authority supplied by the client.
- Public QR tokens authorize only customer routes associated with their active service point or order session.
- Server code validates product state and calculates money with Prisma Decimal. Browser totals are advisory only.
- Order items retain product-name and unit-price snapshots. Historical orders must not change with menu edits.
- Fulfillment and payment use separate state machines.
- A customer-uploaded PromptPay slip is review evidence only. QR readability and duplicate checks never mark an order paid; staff must verify the receiving account. Keep slip objects private and scope staff access by tenant and branch.
- Order creation remains transactional and idempotent. Preserve row locking, serializable isolation, and the tenant-scoped request-key constraint.
- PostgreSQL is authoritative. SSE is a notification hint; the dashboard must reload state from the API.

Read docs/README.md before changing a major flow. Payment and subscription behavior is documented in docs/PAYMENTS.md and docs/SUBSCRIPTIONS.md.

## Validation

Use repository scripts:

```sh
npm run build
npm run lint
npm run check-types
npm test
```

Integration tests are destructive and require a disposable database whose name ends in \_test:

```sh
DATABASE_URL=postgresql://postgres:postgres@localhost:5444/ordering_test npm run db:deploy
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5444/ordering_test npm run test:integration
```

## Git workflow

develop is the integration branch. Create feature/_, fix/_, docs/_, refactor/_, or chore/\* branches from develop and merge them into develop. Normal work does not go directly to main. Use Conventional Commits. Production fixes must also remain present in future development.
