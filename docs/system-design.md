# System Design

This document covers Part 1 deliverables:
- Flow Diagram
- ERD
- High-Level Architecture

## 1) Flow Diagram

```mermaid
flowchart TD
  A[Petrol station sends webhook] --> B[API validates payload and API key]
  B --> C{Duplicate requestId?}

  C -- Yes --> C1{Same payload?}
  C1 -- Yes --> C2[Validate card by cardNumber]
  C2 --> C3{Card exists and active?}
  C3 -- No --> C4[Reject CARD_NOT_FOUND]
  C4 --> C5[Save rejection log and publish rejected event]
  C5 --> Z1[Return HTTP 200 code=REJECTED]
  C3 -- Yes --> C6[Return previous result]
  C6 --> Z0[Return HTTP 200 code=SUCCESS or REJECTED]
  C1 -- No --> C7[Reject DUPLICATE_REQUEST]
  C7 --> C8[Save rejection log and publish rejected event]
  C8 --> Z1

  C -- No --> D[Load card by cardNumber from cache, then DB]
  D --> E{Card exists and active?}

  E -- No --> E1[Reject CARD_NOT_FOUND]
  E1 --> E2[Save rejection log and publish rejected event]
  E2 --> Z1

  E -- Yes --> F[Load organization by card.organizationId]
  F --> G{Organization exists?}
  G -- No --> G1[Reject ORGANIZATION_NOT_FOUND]
  G1 --> G2[Save rejection log and publish rejected event]
  G2 --> Z1

  G -- Yes --> H[Start DB transaction]
  H --> I[Lock card and organization rows FOR UPDATE]
  I --> J[Read daily/monthly usage]
  J --> K{Balance and limits are valid?}

  K -- No --> K1[Save rejected transaction]
  K1 --> K2[Commit]
  K2 --> K3[Save rejection log and publish rejected event]
  K3 --> Z1

  K -- Yes --> L[Save approved transaction]
  L --> M[Deduct organization balance]
  M --> N[Update daily/monthly usage]
  N --> O[Insert balance ledger DEBIT]
  O --> P[Commit]
  P --> Q[Publish approved event]
  Q --> Z2[Return HTTP 200 code=SUCCESS]
```

## 2) ERD

```mermaid
erDiagram
  ORGANIZATION ||--o{ CARD : has
  ORGANIZATION ||--o{ TRANSACTION : owns
  ORGANIZATION ||--o{ BALANCE_LEDGER : has
  CARD ||--o{ TRANSACTION : used_for
  CARD ||--o{ CARD_DAILY_USAGE : has
  CARD ||--o{ CARD_MONTHLY_USAGE : has

  ORGANIZATION {
    uuid id PK
    string name
    decimal currentBalance
    datetime createdAt
    datetime updatedAt
  }

  CARD {
    uuid id PK
    uuid organizationId FK
    string cardNumber UK
    decimal dailyLimit
    decimal monthlyLimit
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }

  CARD_DAILY_USAGE {
    uuid id PK
    uuid cardId FK
    date usageDate
    decimal usedAmount
    datetime updatedAt
  }

  CARD_MONTHLY_USAGE {
    uuid id PK
    uuid cardId FK
    string usageMonth
    decimal usedAmount
    datetime updatedAt
  }

  TRANSACTION {
    uuid id PK
    string requestId UK
    uuid organizationId FK
    uuid cardId FK
    string stationId
    decimal amount
    datetime trxAt
    enum status
    enum rejectionReason
    datetime createdAt
  }

  BALANCE_LEDGER {
    uuid id PK
    uuid organizationId FK
    enum type
    decimal amount
    decimal beforeBalance
    decimal afterBalance
    string referenceType
    string referenceId
    datetime createdAt
  }

  WEBHOOK_REJECTION_LOG {
    uuid id PK
    string requestId
    string cardNumber
    decimal amount
    string stationId
    datetime transactionAt
    enum reason
    string message
    json rawPayload
    datetime createdAt
  }
```

ERD note:
- Optional fields in code: `Transaction.rejectionReason`, `WebhookRejectionLog.cardNumber`, `WebhookRejectionLog.amount`, `WebhookRejectionLog.stationId`, `WebhookRejectionLog.transactionAt`, `WebhookRejectionLog.rawPayload`.

## 3) High-Level Architecture

```mermaid
flowchart LR
  ST[Petrol Station] --> API[NestJS API]
  API --> UC[TransactionUseCases]
  UC --> CORE[Core: entities + abstractions]
  UC --> DS[DataServices]
  DS --> PRISMA[Prisma repositories]
  DS --> REDIS[Redis cache]
  UC --> EV[Events]
  PRISMA --> DB[(PostgreSQL)]
```

## Design Notes
- Business rejection returns HTTP 200 with `code=REJECTED`.
- Idempotency uses unique `requestId` with safe replay for same payload.
- Concurrency safety uses DB transaction and row lock.
- History is saved in `Transaction`, `BalanceLedger`, and `WebhookRejectionLog`.
- Easy to extend for weekly limit, vehicle limit, and organization aggregate limit.
