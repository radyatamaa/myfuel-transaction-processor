-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RejectionReason" AS ENUM ('CARD_NOT_FOUND', 'ORGANIZATION_NOT_FOUND', 'INSUFFICIENT_BALANCE', 'DAILY_LIMIT_EXCEEDED', 'MONTHLY_LIMIT_EXCEEDED', 'DUPLICATE_REQUEST');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentBalance" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "dailyLimit" DECIMAL(18,2) NOT NULL,
    "monthlyLimit" DECIMAL(18,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardDailyUsage" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "usageDate" DATE NOT NULL,
    "usedAmount" DECIMAL(18,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardDailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardMonthlyUsage" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "usageMonth" TEXT NOT NULL,
    "usedAmount" DECIMAL(18,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardMonthlyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "trxAt" TIMESTAMP(3) NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "rejectionReason" "RejectionReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "beforeBalance" DECIMAL(18,2) NOT NULL,
    "afterBalance" DECIMAL(18,2) NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookRejectionLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "cardNumber" TEXT,
    "amount" DECIMAL(18,2),
    "stationId" TEXT,
    "transactionAt" TIMESTAMP(3),
    "reason" "RejectionReason" NOT NULL,
    "message" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookRejectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Card_cardNumber_key" ON "Card"("cardNumber");

-- CreateIndex
CREATE INDEX "Card_organizationId_idx" ON "Card"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CardDailyUsage_cardId_usageDate_key" ON "CardDailyUsage"("cardId", "usageDate");

-- CreateIndex
CREATE UNIQUE INDEX "CardMonthlyUsage_cardId_usageMonth_key" ON "CardMonthlyUsage"("cardId", "usageMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_requestId_key" ON "Transaction"("requestId");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_idx" ON "Transaction"("organizationId");

-- CreateIndex
CREATE INDEX "Transaction_cardId_idx" ON "Transaction"("cardId");

-- CreateIndex
CREATE INDEX "Transaction_trxAt_idx" ON "Transaction"("trxAt");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "BalanceLedger_organizationId_idx" ON "BalanceLedger"("organizationId");

-- CreateIndex
CREATE INDEX "BalanceLedger_referenceType_referenceId_idx" ON "BalanceLedger"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "WebhookRejectionLog_requestId_idx" ON "WebhookRejectionLog"("requestId");

-- CreateIndex
CREATE INDEX "WebhookRejectionLog_reason_idx" ON "WebhookRejectionLog"("reason");

-- CreateIndex
CREATE INDEX "WebhookRejectionLog_createdAt_idx" ON "WebhookRejectionLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardDailyUsage" ADD CONSTRAINT "CardDailyUsage_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardMonthlyUsage" ADD CONSTRAINT "CardMonthlyUsage_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceLedger" ADD CONSTRAINT "BalanceLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
