import { Injectable } from '@nestjs/common';
import {
  TransactionApprovedEvent,
  TransactionRejectedEvent
} from 'src/core/abstracts';
import { ProcessTransactionDto, WebhookResponseDto } from 'src/core/dtos';
import { RejectionReason, WebhookResponseStatus } from 'src/core/entities';

@Injectable()
export class TransactionFactoryService {
  buildRejected(
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

  buildRejectedWithTransactionId(
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

  buildApproved(requestId: string, transactionId: string): WebhookResponseDto {
    return {
      success: true,
      status: WebhookResponseStatus.APPROVED,
      message: 'Transaction approved and persisted.',
      reason: null,
      requestId,
      transactionId
    };
  }

  toMinorUnits(value: string | number): bigint {
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

  fromMinorUnits(value: bigint): string {
    const sign = value < 0n ? '-' : '';
    const normalized = value < 0n ? -value : value;
    const integerPart = normalized / 100n;
    const fractionPart = normalized % 100n;

    return `${sign}${integerPart.toString()}.${fractionPart.toString().padStart(2, '0')}`;
  }

  buildApprovedEvent(
    payload: ProcessTransactionDto,
    response: WebhookResponseDto,
    context: { organizationId: string; cardId: string; amount: string }
  ): TransactionApprovedEvent {
    return {
      requestId: response.requestId,
      transactionId: response.transactionId ?? '',
      organizationId: context.organizationId,
      cardId: context.cardId,
      amount: context.amount,
      stationId: payload.stationId,
      transactionAt: payload.transactionAt
    };
  }

  buildRejectedEvent(
    payload: ProcessTransactionDto,
    response: WebhookResponseDto,
    context?: { organizationId?: string; cardId?: string; amount?: string }
  ): TransactionRejectedEvent {
    return {
      requestId: response.requestId,
      transactionId: response.transactionId ?? undefined,
      organizationId: context?.organizationId,
      cardId: context?.cardId,
      amount: context?.amount,
      stationId: payload.stationId,
      transactionAt: payload.transactionAt,
      reason: response.reason ?? RejectionReason.DUPLICATE_REQUEST,
      message: response.message
    };
  }
}
