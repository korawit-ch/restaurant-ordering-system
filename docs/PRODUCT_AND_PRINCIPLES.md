# Product and engineering principles

## Product purpose

Orderly is a lightweight, self-setup ordering SaaS for small restaurants, bars, cafés, quick-service shops, and food stalls. A business uses the phones, tablets, laptops, printers, and bank account it already has. Customers scan a QR code, browse a branch menu, submit an order, and follow its status without installing an app or creating an account.

The product intentionally stops short of a full point-of-sale suite. Its core loop is:

```text
QR → menu → cart → order → cash or PromptPay → staff fulfillment → complete
```

## Users and responsibilities

### Customer

A customer possesses an opaque QR token. It resolves to an active permanent service point or temporary order session. The customer can read the public menu, submit orders, view an order created through that QR, display PromptPay instructions, and submit a payment claim. The customer receives no restaurant account or staff privilege.

### Restaurant staff

Staff authenticate in a browser and operate within one selected branch membership. They view active orders, receive real-time hints, update fulfillment, confirm actual payments, manage sessions, and perform availability changes permitted by their role.

### Owner and manager

Owners and managers configure menus, service points, branch workflow, PromptPay recipient details, staff invitations, branches, reports, and setup. Branch creation remains subject to the tenant plan limit.

### Platform operator

The separate OPERATOR platform role can inspect basic tenant and subscription status. It is not a shortcut into restaurant operations, and the v1 operator surface is deliberately small.

## Generic fulfillment model

The domain uses ServicePoint rather than Table because an order may be delivered to or collected from a table, bar seat, standing zone, counter, pickup point, or another named location.

A permanent QR identifies a service point. A temporary QR identifies an OrderSession. A session can move to another service point without changing its public token, supporting crowded bars and flexible seating.

## Workflow dimensions

Each branch combines four independent settings:

- QR mode: PERMANENT or SESSION.
- Session mode: SINGLE_ORDER or OPEN_SESSION.
- Payment mode: PER_ORDER, AT_CHECKOUT, or STAFF_MANAGED.
- Fulfillment mode: SERVE_TO_LOCATION or PICKUP.

| Preset                 | QR        | Session      | Payment     | Fulfillment       |
| ---------------------- | --------- | ------------ | ----------- | ----------------- |
| Table Service          | Permanent | Open session | At checkout | Serve to location |
| Bar / Flexible Seating | Temporary | Open session | Per order   | Serve to location |
| Quick Service          | Permanent | Single order | Per order   | Pickup            |
| Pickup / Food Stall    | Permanent | Single order | Per order   | Pickup            |

Owners can override individual settings later. Presets are defaults, not separate domain models.

## Core design principles

### Operational speed

Customer controls use large tap targets and a short path to ordering. Staff cards emphasize location, quantity, payment state, and the next valid action. Browser printing is sufficient for v1 QR distribution.

### PostgreSQL is authoritative

Every order, item snapshot, payment state, session, and refund record persists in PostgreSQL. Real-time events improve latency but never replace a database read. A refreshed dashboard reconstructs active state from the API.

### Money is authoritative on the server

The browser sends product IDs, quantities, expected prices, and a request key. The API reloads products, verifies menu/category/product state, compares current and expected price, and calculates lines and total with decimal values. It never accepts a client total.

### History survives catalog changes

OrderItem stores product name, unit price, quantity, note, and line-total snapshots. Product references aid reporting, but an old order does not change when a product is renamed, repriced, hidden, or removed from the active menu.

### Payment and preparation are independent

Order.status represents fulfillment. Order.paymentStatus represents money. An order may be PREPARING and PAID, or COMPLETED while an allowed manual payment remains pending. Code and UI must not infer one state from the other.

### Tenant isolation belongs in every query

Business records carry tenant and branch scope. Protected requests derive scope from active membership. Composite database relationships reject records attached across branch or tenant boundaries.

### Reliability before infrastructure novelty

The initial topology uses Next.js, one NestJS process, and PostgreSQL. It avoids a message broker, Redis, microservices, Kubernetes, automatic printer control, and offline synchronization until a measured requirement justifies them.

## Current scope

Implemented behavior includes self-service signup, tenant and branch creation, presets, invitations and password reset email, menu management, service points, permanent and session QR codes, browser printing and PNG download, customer carts, idempotent order creation, staff order handling, SSE updates, cash and manual PromptPay confirmation, manual refund records, basic reports, trial/plan representation, branch limits, and a minimal operator view.

Not implemented are automatic subscription collection, automatic PromptPay verification, payment-slip upload, automatic refund transfers, tax invoices, stock accounting, delivery integrations, loyalty, promotions, native apps, offline-first sync, multiple active API replicas, or advanced accounting and analytics. See [Risks and roadmap](RISKS_AND_ROADMAP.md).
