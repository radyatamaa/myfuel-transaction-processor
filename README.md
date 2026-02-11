# MyFuel Transaction Processor

This service handles fuel transactions from petrol station webhooks.

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
- Global validation pipe and global exception filter.
- Request correlation with `x-request-id` on every request.
- Basic request logging (method, path, status, duration, request id).
- Webhook API key guard for transaction endpoint (`x-api-key`).
- Transaction events (`approved`/`rejected`) with handler logging.

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
    crm-services/
    data-services/
      mysql/
  services/
    crm-services/
    data-services/
  use-cases/
    transaction/
    organization/
    card/
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
WEBHOOK_API_KEY=replace-with-secure-key
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
  "message": "ok"
}
```

### Webhook Transaction

- `POST /webhooks/transactions`
- Header: `x-api-key: <your-key>` (required when `WEBHOOK_API_KEY` is set)

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
  "status": "APPROVED",
  "message": "Transaction approved and persisted.",
  "reason": null,
  "requestId": "station-abc-20260211-0001",
  "transactionId": "uuid"
}
```

Response (rejected):

```json
{
  "success": false,
  "status": "REJECTED",
  "message": "Insufficient organization balance",
  "reason": "INSUFFICIENT_BALANCE",
  "requestId": "station-abc-20260211-0001",
  "transactionId": "uuid"
}
```

Quick test with seeded card:

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/transactions \\\n+  -H 'Content-Type: application/json' \\\n+  -H 'x-api-key: replace-with-secure-key' \\\n+  -d '{\n+    \"requestId\": \"station-abc-20260211-1001\",\n+    \"cardNumber\": \"6037991234561001\",\n+    \"amount\": 150000,\n+    \"transactionAt\": \"2026-02-11T09:00:00Z\",\n+    \"stationId\": \"SPBU-12345\"\n+  }'\n+```

Error response format (example):

```json
{
  "success": false,
  "statusCode": 400,
  "error": "BadRequest",
  "message": ["amount must be a positive number"],
  "path": "/api/v1/webhooks/transactions",
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
- build

## Implementation Notes

- Money values are handled in minor-units (`bigint`) inside use-case logic to avoid floating point issues.
- Main idempotency key is unique `requestId`.
- Approved write flow runs inside one transaction boundary (`runInTransaction`).
- Concurrency guard uses row lock (`FOR UPDATE`) for card and organization during final validation + write.
- Middleware adds `x-request-id` if caller does not send one.
- `WEBHOOK_API_KEY` enables API key protection for `POST /webhooks/transactions`.
- Use-case publishes transaction events through event publisher abstraction.
- Rejection auditing uses best-effort write to `WebhookRejectionLog`.
