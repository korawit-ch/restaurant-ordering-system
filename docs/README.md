# Project documentation

This directory is the maintained technical and product reference for Orderly. It describes the system currently present on develop; future designs are labelled as proposals or roadmap items.

## Start here

1. [Product and principles](PRODUCT_AND_PRINCIPLES.md) explains the problem, users, workflows, scope, and product reasoning.
2. [System flows](SYSTEM_FLOWS.md) traces onboarding, QR resolution, order creation, fulfillment, payments, refunds, reporting, and subscriptions from browser to database.
3. [Architecture](ARCHITECTURE.md) maps the monorepo, runtime boundaries, internal services, external dependencies, real-time path, and deployment topology.
4. [Data model](DATA_MODEL.md) documents every persisted model, relationship, constraint, index, state machine, and ownership rule.
5. [API, authentication, and tenancy](API_AUTH_AND_TENANCY.md) describes public and protected APIs, sessions, roles, authorization, isolation, and request defenses.
6. [Development and verification](DEVELOPMENT.md) covers setup, conventions, migrations, tests, CI, and Git workflow.
7. [Operations](OPERATIONS_SETUP.md) explains email, manual PromptPay, refunds, and decisions required before tax receipts or stock accounting.
8. [Risks and roadmap](RISKS_AND_ROADMAP.md) separates known limitations from practical improvements and suggested delivery order.

## Specialist references

- [Payments](PAYMENTS.md): current cash and PromptPay behavior, manual verification, refunds, slip-assisted review, direct-bank integration, gateways, and automatic confirmation.
- [Subscriptions](SUBSCRIPTIONS.md): current trial representation and branch enforcement, plus proposed billing schedules, notifications, and provider integration.

## Authority and update rules

- packages/prisma/prisma/schema.prisma and committed migrations are authoritative for persistent data.
- NestJS controllers, guards, services, and validation schemas are authoritative for API behavior and authorization.
- packages/api-client describes frontend-facing contracts but does not override server validation.
- Environment examples and deployment manifests define supported runtime configuration.
- Roadmap sections describe intended work and must not be read as shipped behavior.

When a change alters a major flow, model, security boundary, deployment requirement, or external integration, update the affected document in the same branch.
