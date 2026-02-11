import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IDataServices } from 'src/core/abstracts';
import { ProcessTransactionDto, WebhookResponseDto } from 'src/core/dtos';
import { RejectionReason, WebhookResponseStatus } from 'src/core/entities';

@Injectable()
export class TransactionUseCases {
  constructor(@Inject(IDataServices) private readonly dataServices: IDataServices) {}

  status() {
    return {
      module: 'transaction',
      ready: true,
      note: 'Step 8 validation and atomic write flow ready'
    };
  }

  async process(payload: ProcessTransactionDto): Promise<WebhookResponseDto> {
    const existingTransaction = await this.dataServices.transactions.findByRequestId(payload.requestId);
    if (existingTransaction) {
      return this.rejected(payload.requestId, RejectionReason.DUPLICATE_REQUEST, 'Duplicate requestId');
    }

    const card = await this.dataServices.cards.findByCardNumber(payload.cardNumber);
    if (!card || !card.isActive) {
      return this.rejected(payload.requestId, RejectionReason.CARD_NOT_FOUND, 'Card not found or inactive');
    }

    const organization = await this.dataServices.organizations.findById(card.organizationId);
    if (!organization) {
      return this.rejected(payload.requestId, RejectionReason.CARD_NOT_FOUND, 'Organization not found');
    }

    const trxAt = new Date(payload.transactionAt);
    const usage = await this.dataServices.cards.getUsageSnapshot(card.id, trxAt);

    const amountMinor = this.toMinorUnits(payload.amount);
    const balanceMinor = this.toMinorUnits(organization.currentBalance);
    const dailyLimitMinor = this.toMinorUnits(card.dailyLimit);
    const monthlyLimitMinor = this.toMinorUnits(card.monthlyLimit);
    const dailyUsedMinor = this.toMinorUnits(usage.dailyUsedAmount);
    const monthlyUsedMinor = this.toMinorUnits(usage.monthlyUsedAmount);

    if (balanceMinor < amountMinor) {
      return this.rejected(
        payload.requestId,
        RejectionReason.INSUFFICIENT_BALANCE,
        'Insufficient organization balance'
      );
    }

    if (dailyUsedMinor + amountMinor > dailyLimitMinor) {
      return this.rejected(
        payload.requestId,
        RejectionReason.DAILY_LIMIT_EXCEEDED,
        'Daily card limit exceeded'
      );
    }

    if (monthlyUsedMinor + amountMinor > monthlyLimitMinor) {
      return this.rejected(
        payload.requestId,
        RejectionReason.MONTHLY_LIMIT_EXCEEDED,
        'Monthly card limit exceeded'
      );
    }

    const newBalanceMinor = balanceMinor - amountMinor;
    const newBalance = this.fromMinorUnits(newBalanceMinor);
    const amount = this.fromMinorUnits(amountMinor);

    try {
      const approvedTransaction = await this.dataServices.runInTransaction(async (tx) => {
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

        return transaction;
      });

      return {
        success: true,
        status: WebhookResponseStatus.APPROVED,
        message: 'Transaction approved and persisted.',
        reason: null,
        requestId: payload.requestId,
        transactionId: approvedTransaction.id
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.rejected(payload.requestId, RejectionReason.DUPLICATE_REQUEST, 'Duplicate requestId');
      }

      throw error;
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
