# MyFuel Transaction Processor

This service handles fuel transactions from petrol station webhooks.

System design document:
- `docs/system-design.md`

## Objective

Build a reliable webhook processor for fuel transactions that:
- enforces organization balance and card limits
- guarantees transaction consistency under concurrent load
- provides auditable transaction history

## Scope

- In scope: transaction processing webhook and related persistence.
- Out of scope: top-up/funding API, card management API, reconciliation pipeline.

Project structure uses a clean layered style:
- `controllers`
- `core` (entities, dtos, abstracts)
- `frameworks` (technical implementations, data services)
- `services` (module wiring)
- `use-cases` (business flow)

## Tech Stack

- Node.js 22
- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Jest
- Swagger
- GitHub Actions

## Current Features

- Webhook transaction endpoint with validation and persistence.
- Validation checks:
  - duplicate `requestId`
  - card exists and is active
  - organization exists
  - organization has enough balance
  - card daily limit
  - card monthly limit
- On approved transaction:
  - save transaction (`APPROVED`)
  - update organization balance
  - update daily and monthly card usage
  - save `balance_ledger` (`DEBIT`)
- On rejected transaction (when card and organization are known):
  - save transaction (`REJECTED`) with `rejectionReason`
  - save rejection audit log (`WebhookRejectionLog`)
- Rejection reasons:
  - `CARD_NOT_FOUND`
  - `ORGANIZATION_NOT_FOUND`
  - `INSUFFICIENT_BALANCE`
  - `DAILY_LIMIT_EXCEEDED`
  - `MONTHLY_LIMIT_EXCEEDED`
  - `DUPLICATE_REQUEST`
- Global validation pipe and global exception filter.
- Request correlation with `x-request-id` on every request.
- Basic request logging (method, path, status, duration, request id).
- Webhook API key guard for transaction endpoint (`x-api-key`).
- Transaction events (`approved`/`rejected`) with handler logging.
- Optional cache layer for card and organization lookup:
  - uses Redis when available
  - falls back to in-memory cache when Redis is unavailable

## Key Engineering Decisions

- Business reject returns HTTP `200` with `code=REJECTED` (not HTTP error).
- Idempotency uses unique `requestId` in database.
- Final validation and writes run in one DB transaction with row locks.
- Money comparisons use minor-unit (`bigint`) conversion to avoid floating point issues.
- Rejection audit and event publishing are best-effort; they do not break API response.

## Code Architecture Flow (for Junior Developers)

This project follows clean architecture style with inward dependencies.

```mermaid
flowchart TB
    subgraph L1["Core Layer (No Framework Dependency)"]
      C_ENT[Entities<br/>src/core/entities]
      C_ABS[Abstractions/Ports<br/>IDataServices, ICacheService,<br/>ITransactionEventPublisher]
      C_DTO[DTO Contracts<br/>src/core/dtos]
    end

    subgraph L2["Use Case Layer"]
      U_TX[TransactionUseCases<br/>src/use-cases/transaction/transaction.use-case.ts]
      U_FAC[TransactionFactoryService]
    end

    subgraph L3["Interface Layer"]
      I_CTRL[WebhookController<br/>src/controllers/webhook.controller.ts]
      I_CFG[Guards/Filters/Middleware<br/>src/configuration]
    end

    subgraph L4["Infrastructure Layer"]
      F_DS[PrismaDataServicesService]
      F_REPO[Prisma Repositories<br/>Card/Organization/Transaction/Ledger/RejectionLog]
      F_CACHE[CacheService]
      F_EVT[TransactionEventPublisher/Handler]
    end

    EXT[External Caller] --> I_CTRL
    I_CFG --> I_CTRL
    I_CTRL --> U_TX
    U_TX --> U_FAC
    U_TX --> C_ABS
    U_TX --> C_ENT
    U_TX --> C_DTO

    F_DS --> F_REPO
    F_REPO --> DB[(PostgreSQL)]
    F_CACHE --> REDIS[(Redis Optional)]

    U_TX -. depends on interface .-> C_ABS
    F_DS -. implements .-> C_ABS
    F_CACHE -. implements .-> C_ABS
    F_EVT -. implements .-> C_ABS
```

```mermaid
sequenceDiagram
    autonumber
    participant X as External Caller
    participant M as RequestIdMiddleware / Guard
    participant C as WebhookController
    participant U as TransactionUseCases
    participant K as CacheService
    participant D as PrismaDataServices
    participant P as PostgreSQL
    participant E as EventPublisher

    X->>M: HTTP request
    M->>C: validated request + requestId
    C->>U: process(dto)
    U->>D: findByRequestId()
    alt duplicate
      U->>E: publishRejected()
      U-->>C: REJECTED
    else not duplicate
      U->>K: get(card)
      U->>D: find card/org (if cache miss)
      U->>D: runInTransaction()
      D->>P: lock rows + validate + write
      U->>E: publish approved/rejected
      U-->>C: SUCCESS/REJECTED
    end
    C-->>X: base response JSON
```

### Layer Responsibility

1. `controllers`
- Handle HTTP concern only (request, response, status code, guards).
- Call use-case and map output to API response.
- Example: `src/controllers/webhook.controller.ts`.

2. `use-cases`
- Main business flow/orchestration.
- Validate business rules and decide approved/rejected.
- Call abstractions only (`IDataServices`, `ICacheService`, `ITransactionEventPublisher`).
- Example: `src/use-cases/transaction/transaction.use-case.ts`.

3. `core`
- Framework-agnostic contracts and entities.
- Contains business language and data contracts.
- Examples: `src/core/entities`, `src/core/abstracts`, `src/core/dtos`.

4. `frameworks`
- Concrete implementations for external systems.
- Prisma repositories, cache service, event publisher/handler.
- Examples: `src/frameworks/data-services/prisma`, `src/frameworks/cache`, `src/frameworks/events`.

5. `services` (module wiring)
- Dependency injection composition root.
- Bind abstraction to implementation.
- Example: `src/services/data-services/data-services.module.ts`.

### How to Add a New Feature (End-to-End)

1. Define business rule first in `core`.
- Add new enum/entity/value object if needed.
- Add or update abstraction contract if new dependency is needed.

2. Implement use-case logic.
- Add or update use-case in `src/use-cases`.
- Keep orchestration and rule checks here.
- Do not call Prisma/Redis directly from use-case.

3. Implement infrastructure adapter.
- If use-case needs new data access, add repository method in abstraction and implement it in Prisma repository.
- If needed, add cache/event implementation under `src/frameworks`.

4. Expose via controller.
- Add/extend endpoint in `src/controllers`.
- Map input DTO and output response format.

5. Wire module dependencies.
- Register provider/module in relevant Nest module (`services` or `use-cases` module).

6. Add tests.
- Unit test for use-case behavior (`src/use-cases/**/*.spec.ts`).
- E2E/API test for endpoint contract (`test/*.e2e-spec.ts`).

7. Update docs.
- Update `README.md` API section and examples.
- Update `docs/system-design.md` if architecture/flow changes.

### Practical Rule of Thumb

- If the change is business rule: start from `core` -> `use-cases`.
- If the change is technical integration: start from `core abstraction` -> `frameworks` implementation -> `use-cases` usage.
- If the change is API contract: start from DTO/controller, then adjust use-case if needed.

## Project Structure

```txt
src/
  app.module.ts
  main.ts
  configuration/
    index.ts
    filters/
  controllers/
  core/
    abstracts/
    dtos/
    entities/
  frameworks/
    data-services/
      prisma/
  services/
    data-services/
  use-cases/
    transaction/
prisma/
  schema.prisma
test/
```

## Environment Variables

See `.env.example`:

```env
PORT=3000
NODE_ENV=development
TZ=Asia/Jakarta
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myfuel
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=myfuel:cache:
REDIS_DB=0
WEBHOOK_API_KEY=replace-with-secure-key
```

If you want Redis-backed cache, install Redis client package first:

```bash
npm install redis
```

## Install and Run

```bash
nvm use 22
npm install
npm run prisma:generate
npm run start:dev
```

For first setup with demo data:

```bash
npm run db:bootstrap
```

## Database

Prisma schema is in `prisma/schema.prisma`.
Prisma uses datasource provider `postgresql`.

Useful commands:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
```

Seed file:
- `prisma/seed.ts`

Demo seeded data:
- Organization: `Demo Logistics`
- Card 1: `6037991234561001`
- Card 2: `6037991234561002`

## API

Base URL:
- `http://localhost:3000/api/v1`

Swagger:
- `http://localhost:3000/swagger`

### Health Check

- `GET /health`

Response:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "ok",
  "data": {},
  "errors": null,
  "timestamp": "2026-02-12T10:00:00.000Z",
  "requestId": "a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d"
}
```

### Webhook Transaction

- `POST /webhooks/transactions`
- Header: `x-api-key: <your-key>` (required when `WEBHOOK_API_KEY` is set)
- In production (`NODE_ENV=production`), `WEBHOOK_API_KEY` is required at startup.

Request body:

```json
{
  "requestId": "station-abc-20260211-0001",
  "cardNumber": "6037991234561001",
  "amount": 350000,
  "transactionAt": "2026-02-11T09:00:00Z",
  "stationId": "SPBU-12345"
}
```

Response (approved):

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Transaction approved and persisted.",
  "data": {
    "requestId": "station-abc-20260211-0001",
    "transactionId": "uuid",
    "reason": null
  },
  "errors": null,
  "timestamp": "2026-02-12T10:00:00.000Z",
  "requestId": "a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d"
}
```

Response (rejected):

```json
{
  "success": false,
  "code": "REJECTED",
  "message": "Insufficient organization balance",
  "data": {
    "requestId": "station-abc-20260211-0001",
    "transactionId": "uuid",
    "reason": "INSUFFICIENT_BALANCE"
  },
  "errors": null,
  "timestamp": "2026-02-12T10:00:00.000Z",
  "requestId": "a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d"
}
```

Quick test with seeded card:

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/transactions \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: replace-with-secure-key' \
  -d '{
    "requestId": "station-abc-20260211-1001",
    "cardNumber": "6037991234561001",
    "amount": 150000,
    "transactionAt": "2026-02-11T09:00:00Z",
    "stationId": "SPBU-12345"
  }'
```

Error response format (example):

```json
{
  "success": false,
  "code": "BAD_REQUEST",
  "message": "Validation failed",
  "data": {},
  "errors": [
    {
      "field": "amount",
      "message": "amount must be a positive number"
    }
  ],
  "timestamp": "2026-02-11T10:00:00.000Z",
  "requestId": "a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d"
}
```

## Testing

Unit tests:

```bash
npm test -- --runInBand
```

E2E tests:

```bash
npm run test:e2e -- --runInBand
```

Note: in sandbox environments that block socket binding, e2e tests are skipped.
To run full e2e:

```bash
ENABLE_E2E_SOCKET=true npm run test:e2e
```

## CI

CI workflow:
- `.github/workflows/ci.yml`

Pipeline runs:
- install dependencies
- lint
- unit tests
- e2e tests (`ENABLE_E2E_SOCKET=true`)
- build

## Implementation Notes

- Money values are handled in minor-units (`bigint`) inside use-case logic to avoid floating point issues.
- Main idempotency key is unique `requestId`.
- Approved write flow runs inside one transaction boundary (`runInTransaction`).
- Concurrency guard uses row lock (`FOR UPDATE`) for card and organization during final validation + write.
- Middleware adds `x-request-id` if caller does not send one.
- `WEBHOOK_API_KEY` enables API key protection for `POST /webhooks/transactions`.
- The app fails startup in production when `WEBHOOK_API_KEY` is empty.
- Use-case publishes transaction events through event publisher abstraction.
- Rejection auditing uses best-effort write to `WebhookRejectionLog`.

## Non-Goals and Known Limitations

- No top-up/funding flow in this service.
- No distributed queue/broker (events are in-process publisher/handler).
- Redis cache invalidation is TTL-based (not event-driven invalidation).
- E2E tests are optional in constrained environments that block socket binding.
