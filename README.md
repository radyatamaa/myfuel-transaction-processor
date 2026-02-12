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
