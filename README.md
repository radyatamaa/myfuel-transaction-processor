# myfuel-transaction-processor

Reference architecture style:
`/Users/mbpm1pro/Documents/kerja/pribadi/technical_test/populix-chatbot/src`

## Step Progress

1. Step 1 (done): folder architecture scaffold.
2. Step 2 (done): NestJS runtime initialization + Node 22 project setup (still no business logic).
3. Step 3 (done): config/env + module wiring placeholders for transaction/organization/card.
4. Step 4 (done): webhook DTO/entity contracts + Swagger/validation scaffold.
5. Step 5 (done): Prisma data model + data-services repository contracts (scaffold only).
6. Step 6 (done): Prisma client integration + read-only repository implementations.
7. Step 7 (done): transaction validation flow in use-case (read-only, no write transaction).
8. Step 8 (done): atomic write flow for approved transaction.

## Step 2 Scope

- Added project setup files:
  - `package.json`
  - `.nvmrc`, `.node-version`
  - `nest-cli.json`
  - `tsconfig.json`, `tsconfig.build.json`
  - `.eslintrc.cjs`, `.prettierrc`
  - `test/jest-e2e.json`
  - `.github/workflows/ci.yml`
- Added minimal runnable Nest app:
  - `src/main.ts`
  - `src/app.module.ts`
  - `src/controllers/app.controller.ts`
- Kept architecture folders aligned with reference style.

## Step 3 Scope

- Added environment/config foundation:
  - `.env.example`
  - `src/configuration/index.ts`
  - `ConfigModule` wiring in `src/app.module.ts`
- Added module wiring placeholders:
  - `src/use-cases/transaction/*`
  - `src/use-cases/organization/*`
  - `src/use-cases/card/*`
  - `src/services/data-services/data-services.module.ts`
  - `src/services/crm-services/crm-services.module.ts`
  - `src/frameworks/data-services/mysql/*`
  - `src/frameworks/crm-services/internal/*`
- Added webhook status placeholder endpoint:
  - `GET /api/v1/webhooks/status`

## Step 4 Scope

- Added webhook request/response contracts:
  - `src/core/dtos/process-transaction.dto.ts`
  - `src/core/dtos/webhook-response.dto.ts`
- Added basic transaction entity enums:
  - `src/core/entities/transaction.entity.ts`
- Updated webhook controller with contract endpoint:
  - `POST /api/v1/webhooks/transactions` (returns `202 Accepted`)
- Enabled API docs and request validation scaffold:
  - Swagger at `/swagger`
  - Global `ValidationPipe` in `src/main.ts`

## Step 5 Scope

- Added Prisma schema foundation:
  - `prisma/schema.prisma`
- Added core entity contracts for data layer:
  - `src/core/entities/card.entity.ts`
  - `src/core/entities/organization.entity.ts`
  - `src/core/entities/transaction.entity.ts` (extended)
- Added repository/data-services contracts:
  - `src/core/abstracts/repositories.abstract.ts`
  - `src/core/abstracts/data-services.abstract.ts`
- Updated MySQL data service as typed scaffold implementing contracts:
  - `src/frameworks/data-services/mysql/mysql-data-services.service.ts`
  - `src/frameworks/data-services/mysql/mysql-data-services.module.ts`
- Added Prisma scripts and dependency declarations:
  - `package.json`

## Step 6 Scope

- Added Prisma runtime service:
  - `src/frameworks/data-services/mysql/prisma.service.ts`
- Integrated Prisma service to data-services module:
  - `src/frameworks/data-services/mysql/mysql-data-services.module.ts`
- Implemented read-only repository methods (no write business logic yet):
  - `findByCardNumber`
  - `getUsageSnapshot`
  - `findById` (organization)
  - `findByRequestId` (transaction)
  - file: `src/frameworks/data-services/mysql/mysql-data-services.service.ts`

## Step 7 Scope

- Implemented use-case validation flow:
  - duplicate request check
  - card existence/active check
  - organization existence check
  - balance check
  - daily/monthly limit check
- Added money comparison helper using minor-units (`bigint`) to avoid float precision issues.
- Updated webhook endpoint behavior:
  - `POST /api/v1/webhooks/transactions` now returns validation result (`APPROVED` / `REJECTED`)
  - still **no write/update** to database yet.

## Step 8 Scope

- Added write contracts in repository abstractions:
  - create approved/rejected transaction
  - update organization balance
  - upsert card daily/monthly usage
- Implemented write methods in data-services Prisma implementation.
- Implemented atomic persistence flow in use-case:
  - create approved transaction
  - deduct organization balance
  - update usage counters
  - all inside one DB transaction boundary (`runInTransaction`)
- API response now includes optional `transactionId` for approved transactions.

## Notes

- Validation + approved write flow are implemented.
- Rejected transaction persistence/logging policy can be expanded in next step.
- Next step (Step 9): persist rejected transactions when possible and add unit tests for transaction use-case branches.
