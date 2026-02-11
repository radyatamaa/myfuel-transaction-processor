import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IDataServices, ITransactionEventPublisher } from 'src/core/abstracts';
import { ProcessTransactionDto, WebhookResponseDto } from 'src/core/dtos';
import { BalanceLedgerType, RejectionReason, WebhookResponseStatus } from 'src/core/entities';
import { TransactionFactoryService } from './transaction-factory.service';

@Injectable()
export class TransactionUseCases {
  constructor(
    @Inject(IDataServices) private readonly dataServices: IDataServices,
    private readonly factory: TransactionFactoryService,
    @Optional()
    @Inject(ITransactionEventPublisher)
    private readonly eventPublisher?: ITransactionEventPublisher
  ) {}

  async process(payload: ProcessTransactionDto): Promise<WebhookResponseDto> {
    const existingTransaction = await this.dataServices.transactions.findByRequestId(payload.requestId);
    if (existingTransaction) {
      const result = this.factory.buildRejected(
        payload.requestId,
        RejectionReason.DUPLICATE_REQUEST,
        'Duplicate requestId'
      );
      await this.trackRejection(payload, result);
      await this.publishResultSafely(payload, result);
      return result;
    }

    const card = await this.dataServices.cards.findByCardNumber(payload.cardNumber);
    if (!card || !card.isActive) {
      const result = this.factory.buildRejected(
        payload.requestId,
        RejectionReason.CARD_NOT_FOUND,
        'Card not found or inactive'
      );
      await this.trackRejection(payload, result);
      await this.publishResultSafely(payload, result);
      return result;
    }

    const organization = await this.dataServices.organizations.findById(card.organizationId);
    if (!organization) {
      const result = this.factory.buildRejected(
        payload.requestId,
        RejectionReason.CARD_NOT_FOUND,
        'Organization not found'
      );
      await this.trackRejection(payload, result);
      await this.publishResultSafely(payload, result);
      return result;
    }

    const trxAt = new Date(payload.transactionAt);
    const amountMinor = this.factory.toMinorUnits(payload.amount);
    const amount = this.factory.fromMinorUnits(amountMinor);

    try {
      const result = await this.dataServices.runInTransaction(async (tx) => {
        await tx.cards.lockById(card.id);
        await tx.organizations.lockById(organization.id);

        const lockedCard = await tx.cards.findById(card.id);
        if (!lockedCard || !lockedCard.isActive) {
          const rejectedTransaction = await tx.transactions.createRejected({
            requestId: payload.requestId,
            organizationId: organization.id,
            cardId: card.id,
            stationId: payload.stationId,
            amount,
            trxAt,
            rejectionReason: RejectionReason.CARD_NOT_FOUND
          });

          return this.factory.buildRejectedWithTransactionId(
            payload.requestId,
            RejectionReason.CARD_NOT_FOUND,
            'Card not found or inactive',
            rejectedTransaction.id
          );
        }

        const lockedOrganization = await tx.organizations.findById(organization.id);
        if (!lockedOrganization) {
          return this.factory.buildRejected(
            payload.requestId,
            RejectionReason.CARD_NOT_FOUND,
            'Organization not found'
          );
        }

        const usage = await tx.cards.getUsageSnapshot(card.id, trxAt);
        const balanceMinor = this.factory.toMinorUnits(lockedOrganization.currentBalance);
        const dailyLimitMinor = this.factory.toMinorUnits(lockedCard.dailyLimit);
        const monthlyLimitMinor = this.factory.toMinorUnits(lockedCard.monthlyLimit);
        const dailyUsedMinor = this.factory.toMinorUnits(usage.dailyUsedAmount);
        const monthlyUsedMinor = this.factory.toMinorUnits(usage.monthlyUsedAmount);

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

          return this.factory.buildRejectedWithTransactionId(
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

          return this.factory.buildRejectedWithTransactionId(
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

          return this.factory.buildRejectedWithTransactionId(
            payload.requestId,
            RejectionReason.MONTHLY_LIMIT_EXCEEDED,
            'Monthly card limit exceeded',
            rejectedTransaction.id
          );
        }

        const newBalanceMinor = balanceMinor - amountMinor;
        const newBalance = this.factory.fromMinorUnits(newBalanceMinor);

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
          beforeBalance: this.factory.fromMinorUnits(balanceMinor),
          afterBalance: newBalance,
          referenceType: 'TRANSACTION',
          referenceId: transaction.id
        });

        return this.factory.buildApproved(payload.requestId, transaction.id);
      });

      await this.publishResultSafely(payload, result, {
        cardId: card.id,
        organizationId: organization.id,
        amount
      });
      if (result.status === WebhookResponseStatus.REJECTED) {
        await this.trackRejection(payload, result);
      }

      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const result = this.factory.buildRejected(
          payload.requestId,
          RejectionReason.DUPLICATE_REQUEST,
          'Duplicate requestId'
        );
        await this.trackRejection(payload, result);
        await this.publishResultSafely(payload, result);
        return result;
      }

      throw error;
    }
  }

  private async trackRejection(
    payload: ProcessTransactionDto,
    result: WebhookResponseDto
  ): Promise<void> {
    if (result.status !== WebhookResponseStatus.REJECTED || !result.reason) {
      return;
    }

    const amount = this.factory.fromMinorUnits(this.factory.toMinorUnits(payload.amount));

    try {
      await this.dataServices.rejectionLogs.create({
        requestId: payload.requestId,
        cardNumber: payload.cardNumber,
        amount,
        stationId: payload.stationId,
        transactionAt: new Date(payload.transactionAt),
        reason: result.reason,
        message: result.message,
        rawPayload: JSON.stringify(payload)
      });
    } catch {
      return;
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

    if (
      result.status === WebhookResponseStatus.APPROVED &&
      result.transactionId &&
      context?.organizationId &&
      context?.cardId &&
      context?.amount
    ) {
      await this.eventPublisher.publishApproved(
        this.factory.buildApprovedEvent(payload, result, {
          organizationId: context.organizationId,
          cardId: context.cardId,
          amount: context.amount
        })
      );
      return;
    }

    if (result.status === WebhookResponseStatus.REJECTED && result.reason) {
      await this.eventPublisher.publishRejected(
        this.factory.buildRejectedEvent(payload, result, context)
      );
    }
  }

  private async publishResultSafely(
    payload: ProcessTransactionDto,
    result: WebhookResponseDto,
    context?: { organizationId?: string; cardId?: string; amount?: string }
  ): Promise<void> {
    try {
      await this.publishResult(payload, result, context);
    } catch {
      return;
    }
  }
}
