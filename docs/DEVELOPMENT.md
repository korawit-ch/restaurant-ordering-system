# Development and verification

## Repository layout

```text
apps/web                 Next.js App Router frontend
apps/api                 NestJS API and domain services
apps/db                  Local PostgreSQL Compose definition
packages/prisma          Schema, migrations, client, seed
packages/api-client      Endpoint contracts and API types
packages/ui              Shared React primitives
packages/design-system   Shared styles
packages/icons           Shared icon exports
packages/*-config        TypeScript, ESLint, and Jest configuration
scripts                  Environment, database, and integration helpers
docs                     Product, architecture, operations, and risk references
```

Turborepo coordinates workspace build, lint, typecheck, test, and development tasks. Applications deploy together but retain runtime boundaries.

## Local setup

Requires Node.js 22.12+, npm, and PostgreSQL or Docker Compose.

```sh
npm ci
cp .env.example .env
npm run env:distribute
npm run db:start
npm run db:deploy
npm run dev
```

Environment scripts distribute workspace environment links. Defaults are web 3010, API 3011, and PostgreSQL 5444. APP_ORIGIN must exactly match the browser origin for writes.

## Application conventions

### Next.js

- App Router pages select screens and pass route parameters into feature components.
- Interactive screens use client components and TanStack Query for remote state.
- Endpoint descriptors come from @repo/api-client; clientFetch sends same-origin requests.
- Keep authoritative prices, authorization, and secrets out of the browser.
- Invalidate relevant query keys after mutations. Staff state remains recoverable by refetch.

### NestJS

- Controllers define routes and delegate to services.
- Strict Zod schemas parse external input through the existing parse helper.
- Guards establish identity, membership, and tenant/branch context.
- Services own transitions, scoped data access, transactions, and side effects.
- Errors use clear Nest exceptions and do not expose credentials or internals.

### Prisma and PostgreSQL

- Change schema.prisma, generate a migration, inspect its SQL, and commit both.
- Preserve composite tenant/branch relations on business-owned models.
- Use Decimal/numeric for money.
- Use constraints, locks, atomic updates, and transactions for concurrent invariants.
- Keep unreliable network calls outside transactions unless failure behavior is designed explicitly.

### Shared contracts

packages/api-client remains runtime-agnostic. Update its types and endpoint descriptors with API contract changes used by the web app. Server runtime validation remains authoritative.

## Database changes

1. Inspect models, constraints, indexes, queries, API types, and deployed data.
2. Prefer additive and backward-compatible changes.
3. Generate and review SQL rather than assuming generated output is safe.
4. Consider nullability, enum rollout, backfills, lock duration, and deployment order.
5. Test high-risk migrations against a restored production-like backup.
6. Use npm run db:deploy in production. db:push is not deployment history.

## Verification

```sh
npm run build
npm run lint
npm run check-types
npm test
```

Integration scripts clear domain tables. Use only a disposable database ending in \_test:

```sh
DATABASE_URL=postgresql://postgres:postgres@localhost:5444/ordering_test npm run db:deploy
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5444/ordering_test npm run test:integration
```

Browser flows:

```sh
npx playwright install chromium
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5444/ordering_test npm run test:e2e
```

Tests prioritize isolation, permissions, concurrent duplicate submission, stale prices, availability, snapshots, state transitions, QR/session behavior, checkout totals, account recovery, invitations, and representative browser ordering.

## CI and deployment

GitHub Actions starts PostgreSQL 16, installs from the lockfile, and runs build, lint and Prettier, typecheck, unit tests, migrations, and integration tests. Browser E2E tests are not in current CI.

Production Compose builds one image, runs a one-shot migration service, one API process, one Next.js process, PostgreSQL, and Caddy. Caddy manages HTTPS and routing. API startup waits for migration completion.

## Git workflow

develop is the integration branch and remote default:

```text
develop → feature|fix|docs|refactor|chore branch → verification → develop
```

Use Conventional Commits. Do not merge normal work into main. There is no active automated version/tag publishing workflow, so inspect history and automation before introducing releases or hotfixes.

## Documentation maintenance

Update documentation when behavior changes a public route, state machine, database model, authorization rule, deployment dependency, external service, or operational procedure. Describe current behavior in present tense and label proposals. Avoid copying source when a durable invariant explains the design better.
