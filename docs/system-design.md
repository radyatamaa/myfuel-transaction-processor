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

  C -- Yes --> C1[Reject DUPLICATE_REQUEST]
  C1 --> C2[Save rejection log and publish rejected event]
  C2 --> Z1[Return HTTP 200 code=REJECTED]

  C -- No --> D[Load card and organization from cache, then DB]
  D --> E{Card is active and organization exists?}

  E -- No --> E1[Reject CARD_NOT_FOUND or ORGANIZATION_NOT_FOUND]
  E1 --> E2[Save rejection log and publish rejected event]
  E2 --> Z1

  E -- Yes --> F[Start DB transaction]
  F --> G[Lock card and organization rows FOR UPDATE]
  G --> H[Read daily/monthly usage]
  H --> I{Balance and limits are valid?}

  I -- No --> I1[Save rejected transaction]
  I1 --> I2[Commit]
  I2 --> I3[Save rejection log and publish rejected event]
  I3 --> Z1

  I -- Yes --> J[Save approved transaction]
  J --> K[Deduct organization balance]
  K --> L[Update daily/monthly usage]
  L --> M[Insert balance ledger DEBIT]
  M --> N[Commit]
  N --> O[Publish approved event]
  O --> Z2[Return HTTP 200 code=SUCCESS]
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
  UC --> INFRA[Prisma + Cache + Events]
  INFRA --> CORE
  INFRA --> DB[(PostgreSQL)]
  INFRA --> REDIS[(Redis Optional)]
```

## Design Notes
- Business rejection returns HTTP 200 with `code=REJECTED`.
- Idempotency uses unique `requestId`.
- Concurrency safety uses DB transaction and row lock.
- History is saved in `Transaction`, `BalanceLedger`, and `WebhookRejectionLog`.
- Easy to extend for weekly limit, vehicle limit, and organization aggregate limit.
