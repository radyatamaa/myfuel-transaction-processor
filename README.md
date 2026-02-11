# myfuel-transaction-processor

Reference architecture style:
`/Users/mbpm1pro/Documents/kerja/pribadi/technical_test/populix-chatbot/src`

## Step Progress

1. Step 1 (done): folder architecture scaffold.
2. Step 2 (done): NestJS runtime initialization + Node 22 project setup (still no business logic).

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

## Notes

- No MyFuel transaction logic implemented yet.
- No Prisma/Redis integration yet.
- Next step (Step 3): setup config/env + dependency modules (without business rules).
