import {
  CreateWebhookRejectionLogInput,
  IWebhookRejectionLogRepository
} from 'src/core/abstracts';
import { DbClient } from './db-client.type';

export class PrismaWebhookRejectionLogRepository implements IWebhookRejectionLogRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateWebhookRejectionLogInput): Promise<void> {
    await this.db.webhookRejectionLog.create({
      data: {
        requestId: input.requestId,
        cardNumber: input.cardNumber,
        amount: input.amount,
        stationId: input.stationId,
        transactionAt: input.transactionAt,
        reason: input.reason,
        message: input.message,
        rawPayload: input.rawPayload
      }
    });
  }
}
