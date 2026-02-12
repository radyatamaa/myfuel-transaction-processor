# System Design

This document covers Part 1 deliverables:
- Flow Diagram
- ERD
- High-Level System Architecture

## 1) Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    participant S as Petrol Station
    participant API as Webhook API (NestJS)
    participant UC as Transaction Use Case
    participant C as Redis Cache (optional)
    participant DB as PostgreSQL
    participant EV as Event Publisher/Handler

    S->>API: POST /webhooks/transactions
    API->>UC: process(requestId, cardNumber, amount, transactionAt, stationId)

    UC->>DB: find transaction by requestId
    alt duplicate requestId
        UC->>DB: insert webhook_rejection_log
        UC->>EV: publish rejected event
        UC-->>API: REJECTED (DUPLICATE_REQUEST)
        API-->>S: 200 + code=REJECTED
    else continue
        UC->>C: get card by cardNumber
        alt cache miss
            UC->>DB: find card by cardNumber
            UC->>C: set card (TTL)
        end

        alt card not found/inactive
            UC->>DB: insert webhook_rejection_log
            UC->>EV: publish rejected event
            UC-->>API: REJECTED (CARD_NOT_FOUND)
            API-->>S: 200 + code=REJECTED
        else continue
            UC->>C: get organization by card.organizationId
            alt cache miss
                UC->>DB: find organization by id
                UC->>C: set organization (TTL)
            end

            alt organization not found
                UC->>DB: insert webhook_rejection_log
                UC->>EV: publish rejected event
                UC-->>API: REJECTED (ORGANIZATION_NOT_FOUND)
                API-->>S: 200 + code=REJECTED
            else continue
                UC->>DB: BEGIN TRANSACTION
                UC->>DB: lock card + organization (FOR UPDATE)
                UC->>DB: get daily/monthly usage snapshot

                alt insufficient balance
                    UC->>DB: insert transaction (REJECTED)
                    UC->>DB: COMMIT
                    UC->>DB: insert webhook_rejection_log
                    UC->>EV: publish rejected event
                    UC-->>API: REJECTED (INSUFFICIENT_BALANCE)
                    API-->>S: 200 + code=REJECTED
                else daily limit exceeded
                    UC->>DB: insert transaction (REJECTED)
                    UC->>DB: COMMIT
                    UC->>DB: insert webhook_rejection_log
                    UC->>EV: publish rejected event
                    UC-->>API: REJECTED (DAILY_LIMIT_EXCEEDED)
                    API-->>S: 200 + code=REJECTED
                else monthly limit exceeded
                    UC->>DB: insert transaction (REJECTED)
                    UC->>DB: COMMIT
                    UC->>DB: insert webhook_rejection_log
                    UC->>EV: publish rejected event
                    UC-->>API: REJECTED (MONTHLY_LIMIT_EXCEEDED)
                    API-->>S: 200 + code=REJECTED
                else approved
                    UC->>DB: insert transaction (APPROVED)
                    UC->>DB: update organization balance
                    UC->>DB: upsert card_daily_usage and card_monthly_usage
                    UC->>DB: insert balance_ledger (DEBIT)
                    UC->>DB: COMMIT
                    UC->>EV: publish approved event
                    UC-->>API: SUCCESS (APPROVED)
                    API-->>S: 200 + code=SUCCESS
                end
            end
        end
    end
```

## 2) ERD

```mermaid
erDiagram
    ORGANIZATION ||--o{ CARD : has
    ORGANIZATION ||--o{ TRANSACTION : owns
    ORGANIZATION ||--o{ BALANCE_LEDGER : tracks
    CARD ||--o{ TRANSACTION : used_for
    CARD ||--o{ CARD_DAILY_USAGE : accumulates
    CARD ||--o{ CARD_MONTHLY_USAGE : accumulates

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
      string unique_cardId_usageDate UK
    }

    CARD_MONTHLY_USAGE {
      uuid id PK
      uuid cardId FK
      string usageMonth
      decimal usedAmount
      datetime updatedAt
      string unique_cardId_usageMonth UK
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

## 3) High-Level Architecture

```mermaid
flowchart LR
    PS[Petrol Station System]
    API[NestJS API Layer<br/>Controller + Validation + Auth Guard]
    UC[Use Case Layer<br/>TransactionUseCases]
    CACHE[Cache Layer<br/>Redis optional / In-memory fallback]
    DS[Data Service Layer<br/>Prisma Repositories]
    DB[(PostgreSQL)]
    EV[Event Layer<br/>Publisher + Handler]

    PS -->|Webhook POST| API
    API --> UC
    UC <--> CACHE
    UC --> DS
    DS --> DB
    UC --> EV
```

## Scalability and Extensibility Notes

- Concurrency-safe write path:
  - transaction boundary in database.
  - row locks (`FOR UPDATE`) on card and organization before final validation and write.
- Idempotency:
  - unique `requestId` on `Transaction`.
  - duplicate handling in application + DB unique constraint fallback.
- Historical tracking:
  - `Transaction` stores all approved/rejected outcomes.
  - `BalanceLedger` stores balance movement history.
  - `WebhookRejectionLog` stores rejected payload context for audit/debug.
- Usage reset logic:
  - daily and monthly usage are naturally partitioned by `usageDate` and `usageMonth`.
- Future rule extensions:
  - Add `CardWeeklyUsage` for weekly limits.
  - Add `Vehicle` and relation to `Card` for vehicle-based limit.
  - Add organization aggregate limit table and validator strategy.
- Performance:
  - optional Redis cache for card/organization read path.
  - indexes on frequently filtered columns (`requestId`, `cardId`, `organizationId`, `status`, `trxAt`).

## Assumptions

- One webhook request represents one fuel purchase.
- API returns HTTP 200 for business reject (`code=REJECTED`) to avoid sender retry storms.
- Validation or authentication failures return proper 4xx.
- Decimal money precision uses database decimal and use-case minor-unit conversion for comparisons.
