# myfuel-transaction-processor

Reference architecture style:
`/Users/mbpm1pro/Documents/kerja/pribadi/technical_test/populix-chatbot/src`

## Step Progress

1. Step 1 (done): folder architecture scaffold.
2. Step 2 (done): NestJS runtime initialization + Node 22 project setup (still no business logic).
3. Step 3 (done): config/env + module wiring placeholders for transaction/organization/card.

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

## Notes

- No MyFuel transaction business rules yet.
- No Prisma repository implementation yet.
- Next step (Step 4): define DTO/entity contracts for transaction webhook and API docs scaffolding.
