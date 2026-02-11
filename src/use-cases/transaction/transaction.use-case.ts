import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IDataServices, ITransactionEventPublisher } from 'src/core/abstracts';
import { ProcessTransactionDto, WebhookResponseDto } from 'src/core/dtos';
import { BalanceLedgerType, RejectionReason, WebhookResponseStatus } from 'src/core/entities';

@Injectable()
export class TransactionUseCases {
  constructor(
    @Inject(IDataServices) private readonly dataServices: IDataServices,
    @Optional()
    @Inject(ITransactionEventPublisher)
    private readonly eventPublisher?: ITransactionEventPublisher
  ) {}

  status() {
    return {
      module: 'transaction',
      ready: true,
      note: 'Step 11 adds balance ledger persistence for approved flow'
    };
  }

  async process(payload: ProcessTransactionDto): Promise<WebhookResponseDto> {
    const existingTransaction = await this.dataServices.transactions.findByRequestId(payload.requestId);
    if (existingTransaction) {
      const result = this.rejected(payload.requestId, RejectionReason.DUPLICATE_REQUEST, 'Duplicate requestId');
      await this.publishResult(payload, result);
      return result;
    }

    const card = await this.dataServices.cards.findByCardNumber(payload.cardNumber);
    if (!card || !card.isActive) {
      const result = this.rejected(payload.requestId, RejectionReason.CARD_NOT_FOUND, 'Card not found or inactive');
      await this.publishResult(payload, result);
      return result;
    }

    const organization = await this.dataServices.organizations.findById(card.organizationId);
    if (!organization) {
      const result = this.rejected(payload.requestId, RejectionReason.CARD_NOT_FOUND, 'Organization not found');
      await this.publishResult(payload, result);
      return result;
    }

    const trxAt = new Date(payload.transactionAt);
    const amountMinor = this.toMinorUnits(payload.amount);
    const amount = this.fromMinorUnits(amountMinor);

    try {
      const result = await this.dataServices.runInTransaction(async (tx) => {
        // Lock card and organization rows to reduce concurrent double-spend risk.
        await tx.cards.lockById(card.id);
        await tx.organizations.lockById(organization.id);

        const lockedOrganization = await tx.organizations.findById(organization.id);
        if (!lockedOrganization) {
          return this.rejected(payload.requestId, RejectionReason.CARD_NOT_FOUND, 'Organization not found');
        }

        const usage = await tx.cards.getUsageSnapshot(card.id, trxAt);
        const balanceMinor = this.toMinorUnits(lockedOrganization.currentBalance);
        const dailyLimitMinor = this.toMinorUnits(card.dailyLimit);
        const monthlyLimitMinor = this.toMinorUnits(card.monthlyLimit);
        const dailyUsedMinor = this.toMinorUnits(usage.dailyUsedAmount);
        const monthlyUsedMinor = this.toMinorUnits(usage.monthlyUsedAmount);

        if (balanceMinor < amountMinor) {
          const rejectedTransaction = await tx.transactions.createRejected({
            requestId: payload.requestId,
            organizationId: organization.id,
            cardId: card.id,
            stationId: payload.stationId,
            amount,
            trxAt,
            rejectionReason: RejectionReason.INSUFFICIENT_BALANCE
          });

          return this.rejectedWithTransactionId(
            payload.requestId,
            RejectionReason.INSUFFICIENT_BALANCE,
            'Insufficient organization balance',
            rejectedTransaction.id
          );
        }

        if (dailyUsedMinor + amountMinor > dailyLimitMinor) {
          const rejectedTransaction = await tx.transactions.createRejected({
            requestId: payload.requestId,
            organizationId: organization.id,
            cardId: card.id,
            stationId: payload.stationId,
            amount,
            trxAt,
            rejectionReason: RejectionReason.DAILY_LIMIT_EXCEEDED
          });

          return this.rejectedWithTransactionId(
            payload.requestId,
            RejectionReason.DAILY_LIMIT_EXCEEDED,
            'Daily card limit exceeded',
            rejectedTransaction.id
          );
        }

        if (monthlyUsedMinor + amountMinor > monthlyLimitMinor) {
          const rejectedTransaction = await tx.transactions.createRejected({
            requestId: payload.requestId,
            organizationId: organization.id,
            cardId: card.id,
            stationId: payload.stationId,
            amount,
            trxAt,
            rejectionReason: RejectionReason.MONTHLY_LIMIT_EXCEEDED
          });

          return this.rejectedWithTransactionId(
            payload.requestId,
            RejectionReason.MONTHLY_LIMIT_EXCEEDED,
            'Monthly card limit exceeded',
            rejectedTransaction.id
          );
        }

        const newBalanceMinor = balanceMinor - amountMinor;
        const newBalance = this.fromMinorUnits(newBalanceMinor);

        const transaction = await tx.transactions.createApproved({
          requestId: payload.requestId,
          organizationId: organization.id,
          cardId: card.id,
          stationId: payload.stationId,
          amount,
          trxAt
        });

        await tx.organizations.updateBalance(organization.id, newBalance);
        await tx.cards.addUsage(card.id, trxAt, amount);
        await tx.ledgers.create({
          organizationId: organization.id,
          type: BalanceLedgerType.DEBIT,
          amount,
          beforeBalance: this.fromMinorUnits(balanceMinor),
          afterBalance: newBalance,
          referenceType: 'TRANSACTION',
          referenceId: transaction.id
        });

        return {
          success: true,
          status: WebhookResponseStatus.APPROVED,
          message: 'Transaction approved and persisted.',
          reason: null,
          requestId: payload.requestId,
          transactionId: transaction.id
        };
      });
      await this.publishResult(payload, result, {
        cardId: card.id,
        organizationId: organization.id,
        amount
      });
      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const result = this.rejected(payload.requestId, RejectionReason.DUPLICATE_REQUEST, 'Duplicate requestId');
        await this.publishResult(payload, result);
        return result;
      }

      throw error;
    }
  }

  private async publishResult(
    payload: ProcessTransactionDto,
    result: WebhookResponseDto,
    context?: { organizationId?: string; cardId?: string; amount?: string }
  ): Promise<void> {
    if (!this.eventPublisher) {
      return;
    }

    if (result.status === WebhookResponseStatus.APPROVED && result.transactionId) {
      await this.eventPublisher.publishApproved({
        requestId: result.requestId,
        transactionId: result.transactionId,
        organizationId: context?.organizationId ?? '',
        cardId: context?.cardId ?? '',
        amount: context?.amount ?? String(payload.amount),
        stationId: payload.stationId,
        transactionAt: payload.transactionAt
      });
      return;
    }

    if (result.status === WebhookResponseStatus.REJECTED && result.reason) {
      await this.eventPublisher.publishRejected({
        requestId: result.requestId,
        transactionId: result.transactionId ?? undefined,
        organizationId: context?.organizationId,
        cardId: context?.cardId,
        amount: context?.amount,
        stationId: payload.stationId,
        transactionAt: payload.transactionAt,
        reason: result.reason,
        message: result.message
      });
    }
  }

  private rejected(
    requestId: string,
    reason: RejectionReason,
    message: string
  ): WebhookResponseDto {
    return {
      success: false,
      status: WebhookResponseStatus.REJECTED,
      message,
      reason,
      requestId
    };
  }

  private rejectedWithTransactionId(
    requestId: string,
    reason: RejectionReason,
    message: string,
    transactionId: string
  ): WebhookResponseDto {
    return {
      success: false,
      status: WebhookResponseStatus.REJECTED,
      message,
      reason,
      requestId,
      transactionId
    };
  }

  private toMinorUnits(value: string | number): bigint {
    const raw = String(value).trim();
    if (!raw) {
      return 0n;
    }

    const sign = raw.startsWith('-') ? -1n : 1n;
    const normalized = raw.replace('-', '');
    const [integerPart, fractionPart = ''] = normalized.split('.');
    const cents = (fractionPart + '00').slice(0, 2);
    const integerMinor = BigInt(integerPart || '0') * 100n;
    const fractionMinor = BigInt(cents || '0');

    return sign * (integerMinor + fractionMinor);
  }

  private fromMinorUnits(value: bigint): string {
    const sign = value < 0n ? '-' : '';
    const normalized = value < 0n ? -value : value;
    const integerPart = normalized / 100n;
    const fractionPart = normalized % 100n;

    return `${sign}${integerPart.toString()}.${fractionPart.toString().padStart(2, '0')}`;
  }
}
