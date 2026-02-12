import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { IDataServices, ITransactionEventPublisher } from 'src/core/abstracts';
import { ProcessTransactionDto, WebhookResponseDto } from 'src/core/dtos';
import {
  BalanceLedgerType,
  Card,
  Organization,
  RejectionReason,
  Transaction,
  TransactionStatus,
  WebhookResponseStatus
} from 'src/core/entities';
import { TransactionFactoryService } from './transaction-factory.service';

@Injectable()
export class TransactionUseCases {
  private static readonly CARD_CACHE_TTL_SECONDS = 60;
  private static readonly ORGANIZATION_CACHE_TTL_SECONDS = 60;
  private readonly logger = new Logger(TransactionUseCases.name);

  constructor(
    @Inject(IDataServices) private readonly dataServices: IDataServices,
    private readonly factory: TransactionFactoryService,
    @Optional()
    @Inject(ITransactionEventPublisher)
    private readonly eventPublisher?: ITransactionEventPublisher
  ) {}

  async process(payload: ProcessTransactionDto): Promise<WebhookResponseDto> {
    const startedAt = Date.now();
    this.logger.log(
      JSON.stringify({
        event: 'transaction_received',
        requestId: payload.requestId,
        cardNumber: this.maskCardNumber(payload.cardNumber),
        stationId: payload.stationId,
        amount: payload.amount
      })
    );

    const existingTransaction = await this.dataServices.prisma.transactions.findByRequestId(payload.requestId);
    if (existingTransaction) {
      if (this.isDuplicatePayloadSame(existingTransaction, payload)) {
        return this.buildReplayResult(existingTransaction,payload,startedAt);
      }

      const result = this.factory.buildRejected(
        payload.requestId,
        RejectionReason.DUPLICATE_REQUEST,
        'Idempotency conflict: requestId already used with different payload'
      );
      await this.trackRejection(payload, result);
      await this.publishResultSafely(payload, result);
      this.logBusinessRejection(result.reason, payload.requestId, startedAt);
      return result;
    }

    const {result,card} = await this.dupCheckCardByCardNumber(payload,startedAt)
    if (result) {
      return result;
    }

    const organization = await this.getOrganizationById(card.organizationId);
    if (!organization) {
      const result = this.factory.buildRejected(
        payload.requestId,
        RejectionReason.ORGANIZATION_NOT_FOUND,
        'Organization not found'
      );
      await this.trackRejection(payload, result);
      await this.publishResultSafely(payload, result);
      this.logBusinessRejection(result.reason, payload.requestId, startedAt);
      return result;
    }

    const trxAt = new Date(payload.transactionAt);
    const amountMinor = this.factory.toMinorUnits(payload.amount);
    const amount = this.factory.fromMinorUnits(amountMinor);

    try {
      const result = await this.dataServices.runInTransaction(async (tx) => {
        await tx.prisma.cards.lockById(card.id);
        await tx.prisma.organizations.lockById(organization.id);

        const lockedCard = await tx.prisma.cards.findById(card.id);
        if (!lockedCard || !lockedCard.isActive) {
          const rejectedTransaction = await tx.prisma.transactions.createRejected({
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

        const lockedOrganization = await tx.prisma.organizations.findById(organization.id);
        if (!lockedOrganization) {
          return this.factory.buildRejected(
            payload.requestId,
            RejectionReason.ORGANIZATION_NOT_FOUND,
            'Organization not found'
          );
        }

        const usage = await tx.prisma.cards.getUsageSnapshot(card.id, trxAt);
        const balanceMinor = this.factory.toMinorUnits(lockedOrganization.currentBalance);
        const dailyLimitMinor = this.factory.toMinorUnits(lockedCard.dailyLimit);
        const monthlyLimitMinor = this.factory.toMinorUnits(lockedCard.monthlyLimit);
        const dailyUsedMinor = this.factory.toMinorUnits(usage.dailyUsedAmount);
        const monthlyUsedMinor = this.factory.toMinorUnits(usage.monthlyUsedAmount);

        if (balanceMinor < amountMinor) {
          const rejectedTransaction = await tx.prisma.transactions.createRejected({
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
          const rejectedTransaction = await tx.prisma.transactions.createRejected({
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
          const rejectedTransaction = await tx.prisma.transactions.createRejected({
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

        const transaction = await tx.prisma.transactions.createApproved({
          requestId: payload.requestId,
          organizationId: organization.id,
          cardId: card.id,
          stationId: payload.stationId,
          amount,
          trxAt
        });

        await tx.prisma.organizations.updateBalance(organization.id, newBalance);
        await tx.prisma.cards.addUsage(card.id, trxAt, amount);
        await tx.prisma.ledgers.create({
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
      await this.syncCachesAfterMutation(payload, organization, card, result);
      if (result.status === WebhookResponseStatus.REJECTED) {
        await this.trackRejection(payload, result);
        this.logBusinessRejection(result.reason, payload.requestId, startedAt);
      } else {
        this.logger.log(
          JSON.stringify({
            event: 'transaction_approved',
            requestId: payload.requestId,
            transactionId: result.transactionId,
            durationMs: Date.now() - startedAt
          })
        );
      }

      return result;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const result = this.factory.buildRejected(
          payload.requestId,
          RejectionReason.DUPLICATE_REQUEST,
          'Duplicate requestId'
        );
        await this.trackRejection(payload, result);
        await this.publishResultSafely(payload, result);
        this.logBusinessRejection(result.reason, payload.requestId, startedAt);
        return result;
      }

      this.logger.error(
        JSON.stringify({
          event: 'transaction_failed',
          requestId: payload.requestId,
          durationMs: Date.now() - startedAt
        }),
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  private async dupCheckCardByCardNumber(payload: ProcessTransactionDto, startedAt: number) {
    const card = await this.getCardByCardNumber(payload.cardNumber);
    if (!card || !card.isActive) {
      const result = this.factory.buildRejected(
        payload.requestId,
        RejectionReason.CARD_NOT_FOUND,
        'Card not found or inactive'
      );
      await this.trackRejection(payload, result);
      await this.publishResultSafely(payload, result);
      this.logBusinessRejection(result.reason, payload.requestId, startedAt);
      return {result,card};
    }

    return {card, result:null};
  }

  private logBusinessRejection(
    reason: RejectionReason | null | undefined,
    requestId: string,
    startedAt: number
  ): void {
    this.logger.warn(
      JSON.stringify({
        event: 'transaction_rejected',
        requestId,
        reason: reason ?? null,
        durationMs: Date.now() - startedAt
      })
    );
  }

  private maskCardNumber(cardNumber: string): string {
    if (cardNumber.length <= 4) {
      return cardNumber;
    }
    return `${'*'.repeat(Math.max(0, cardNumber.length - 4))}${cardNumber.slice(-4)}`;
  }

  private isDuplicatePayloadSame(existing: Transaction, payload: ProcessTransactionDto): boolean {
    const existingAmountMinor = this.factory.toMinorUnits(existing.amount);
    const payloadAmountMinor = this.factory.toMinorUnits(payload.amount);

    return (
      existing.stationId === payload.stationId &&
      existingAmountMinor === payloadAmountMinor &&
      existing.trxAt.getTime() === new Date(payload.transactionAt).getTime()
    );
  }

  private async buildReplayResult(existing: Transaction, payload: ProcessTransactionDto, startedAt: number): Promise<WebhookResponseDto> {
    const {result} = await this.dupCheckCardByCardNumber(payload,startedAt);
    if (result) {
      return result
    }
    if (existing.status === TransactionStatus.APPROVED) {
      return this.factory.buildApproved(existing.requestId, existing.id);
    }

    return this.factory.buildRejectedWithTransactionId(
      existing.requestId,
      RejectionReason.DUPLICATE_REQUEST,
      'Duplicate requestId',
      existing.id
    );
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
      await this.dataServices.prisma.rejectionLogs.create({
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

  private cardCacheKey(cardNumber: string): string {
    return `card:${cardNumber}`;
  }

  private organizationCacheKey(organizationId: string): string {
    return `organization:${organizationId}`;
  }

  private async getCardByCardNumber(cardNumber: string): Promise<Card | null> {
    const cacheKey = this.cardCacheKey(cardNumber);
    const cached = await this.dataServices.redis.get<Card>(cacheKey);
    if (cached) {
      return cached;
    }

    const card = await this.dataServices.prisma.cards.findByCardNumber(cardNumber);
    if (!card) {
      return null;
    }

    await this.dataServices.redis.set(
      cacheKey,
      card,
      TransactionUseCases.CARD_CACHE_TTL_SECONDS
    );

    return card;
  }

  private async getOrganizationById(organizationId: string): Promise<Organization | null> {
    const cacheKey = this.organizationCacheKey(organizationId);
    const cached = await this.dataServices.redis.get<Organization>(cacheKey);
    if (cached) {
      return cached;
    }

    const organization = await this.dataServices.prisma.organizations.findById(organizationId);
    if (!organization) {
      return null;
    }

    await this.dataServices.redis.set(
      cacheKey,
      organization,
      TransactionUseCases.ORGANIZATION_CACHE_TTL_SECONDS
    );

    return organization;
  }

  private async syncCachesAfterMutation(
    payload: ProcessTransactionDto,
    organization: Organization,
    card: Card,
    result: WebhookResponseDto
  ): Promise<void> {
    if (result.status !== WebhookResponseStatus.APPROVED) {
      return;
    }

    const amountMinor = this.factory.toMinorUnits(payload.amount);
    const previousBalanceMinor = this.factory.toMinorUnits(organization.currentBalance);
    const newBalance = this.factory.fromMinorUnits(previousBalanceMinor - amountMinor);

    try {
      await this.dataServices.redis.set(
        this.organizationCacheKey(organization.id),
        {
          ...organization,
          currentBalance: newBalance
        },
        TransactionUseCases.ORGANIZATION_CACHE_TTL_SECONDS
      );

      await this.dataServices.redis.set(
        this.cardCacheKey(card.cardNumber),
        card,
        TransactionUseCases.CARD_CACHE_TTL_SECONDS
      );
    } catch {
      return;
    }
  }
}
