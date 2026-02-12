import { IDataServices, ITransactionEventPublisher } from '../../core/abstracts';
import { RejectionReason, TransactionStatus, WebhookResponseStatus } from '../../core/entities';
import { TransactionUseCases } from './transaction.use-case';
import { TransactionFactoryService } from './transaction-factory.service';

type MockDataServices = {
  prisma: {
    cards: {
      findById: jest.Mock;
      findByCardNumber: jest.Mock;
      getUsageSnapshot: jest.Mock;
      addUsage: jest.Mock;
      lockById: jest.Mock;
    };
    organizations: {
      findById: jest.Mock;
      updateBalance: jest.Mock;
      lockById: jest.Mock;
    };
    transactions: {
      findByRequestId: jest.Mock;
      createApproved: jest.Mock;
      createRejected: jest.Mock;
    };
    ledgers: {
      create: jest.Mock;
    };
    rejectionLogs: {
      create: jest.Mock;
    };
  };
  redis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };
  runInTransaction: jest.Mock;
};

describe('TransactionUseCases', () => {
  const payload = {
    requestId: 'req-001',
    cardNumber: '6037991234561001',
    amount: 100,
    transactionAt: '2026-02-11T09:00:00Z',
    stationId: 'SPBU-1'
  };

  function createMockDataServices(): MockDataServices {
    const dataServices: MockDataServices = {
      prisma: {
        cards: {
          findById: jest.fn(),
          findByCardNumber: jest.fn(),
          getUsageSnapshot: jest.fn(),
          addUsage: jest.fn(),
          lockById: jest.fn()
        },
        organizations: {
          findById: jest.fn(),
          updateBalance: jest.fn(),
          lockById: jest.fn()
        },
        transactions: {
          findByRequestId: jest.fn(),
          createApproved: jest.fn(),
          createRejected: jest.fn()
        },
        ledgers: {
          create: jest.fn()
        },
        rejectionLogs: {
          create: jest.fn()
        }
      },
      redis: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn()
      },
      runInTransaction: jest.fn()
    };

    dataServices.runInTransaction.mockImplementation(
      async (callback: (tx: IDataServices) => Promise<unknown>) => {
        return callback(dataServices as unknown as IDataServices);
      }
    );

    return dataServices;
  }

  it('returns previous result when requestId is duplicate with same payload', async () => {
    const dataServices = createMockDataServices();
    dataServices.prisma.transactions.findByRequestId.mockResolvedValue({
      id: 'trx-dup',
      requestId: payload.requestId,
      organizationId: 'org-1',
      cardId: 'card-1',
      stationId: payload.stationId,
      amount: '100.00',
      trxAt: new Date(payload.transactionAt),
      status: TransactionStatus.APPROVED,
      rejectionReason: null,
      createdAt: new Date()
    });
    dataServices.prisma.cards.findByCardNumber.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const useCase = new TransactionUseCases(dataServices as unknown as IDataServices, new TransactionFactoryService());
    const result = await useCase.process(payload);

    expect(result.status).toBe(WebhookResponseStatus.APPROVED);
    expect(result.transactionId).toBe('trx-dup');
    expect(dataServices.prisma.cards.findByCardNumber).toHaveBeenCalledWith(payload.cardNumber);
    expect(dataServices.prisma.rejectionLogs.create).not.toHaveBeenCalled();
  });

  it('returns rejected when requestId is duplicate with different payload', async () => {
    const dataServices = createMockDataServices();
    dataServices.prisma.transactions.findByRequestId.mockResolvedValue({
      id: 'trx-dup',
      requestId: payload.requestId,
      organizationId: 'org-1',
      cardId: 'card-1',
      stationId: 'SPBU-2',
      amount: '100.00',
      trxAt: new Date(payload.transactionAt),
      status: TransactionStatus.APPROVED,
      rejectionReason: null,
      createdAt: new Date()
    });

    const useCase = new TransactionUseCases(dataServices as unknown as IDataServices, new TransactionFactoryService());
    const result = await useCase.process(payload);

    expect(result.status).toBe(WebhookResponseStatus.REJECTED);
    expect(result.reason).toBe(RejectionReason.DUPLICATE_REQUEST);
    expect(result.message).toContain('Idempotency conflict');
    expect(dataServices.prisma.cards.findByCardNumber).not.toHaveBeenCalled();
    expect(dataServices.prisma.rejectionLogs.create).toHaveBeenCalledTimes(1);
  });

  it('returns rejected when organization is not found', async () => {
    const dataServices = createMockDataServices();
    dataServices.prisma.transactions.findByRequestId.mockResolvedValue(null);
    dataServices.prisma.cards.findByCardNumber.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.organizations.findById.mockResolvedValue(null);

    const useCase = new TransactionUseCases(dataServices as unknown as IDataServices, new TransactionFactoryService());
    const result = await useCase.process(payload);

    expect(result.status).toBe(WebhookResponseStatus.REJECTED);
    expect(result.reason).toBe(RejectionReason.ORGANIZATION_NOT_FOUND);
    expect(dataServices.prisma.rejectionLogs.create).toHaveBeenCalledTimes(1);
    expect(dataServices.runInTransaction).not.toHaveBeenCalled();
  });

  it('persists rejected transaction when balance is insufficient', async () => {
    const dataServices = createMockDataServices();
    dataServices.prisma.transactions.findByRequestId.mockResolvedValue(null);
    dataServices.prisma.cards.findByCardNumber.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.cards.findById.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.organizations.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Org',
      currentBalance: '50.00',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.cards.getUsageSnapshot.mockResolvedValue({
      dailyUsedAmount: '0',
      monthlyUsedAmount: '0'
    });
    dataServices.prisma.transactions.createRejected.mockResolvedValue({
      id: 'trx-rejected',
      requestId: payload.requestId,
      organizationId: 'org-1',
      cardId: 'card-1',
      stationId: payload.stationId,
      amount: '100.00',
      trxAt: new Date(payload.transactionAt),
      status: TransactionStatus.REJECTED,
      rejectionReason: RejectionReason.INSUFFICIENT_BALANCE,
      createdAt: new Date()
    });

    const useCase = new TransactionUseCases(dataServices as unknown as IDataServices, new TransactionFactoryService());
    const result = await useCase.process(payload);

    expect(result.status).toBe(WebhookResponseStatus.REJECTED);
    expect(result.reason).toBe(RejectionReason.INSUFFICIENT_BALANCE);
    expect(result.transactionId).toBe('trx-rejected');
    expect(dataServices.prisma.transactions.createRejected).toHaveBeenCalledTimes(1);
    expect(dataServices.prisma.rejectionLogs.create).toHaveBeenCalledTimes(1);
  });

  it('returns approved and persists updates when validation passes', async () => {
    const dataServices = createMockDataServices();
    dataServices.prisma.transactions.findByRequestId.mockResolvedValue(null);
    dataServices.prisma.cards.findByCardNumber.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.cards.findById.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.organizations.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Org',
      currentBalance: '500.00',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.cards.getUsageSnapshot.mockResolvedValue({
      dailyUsedAmount: '100.00',
      monthlyUsedAmount: '200.00'
    });
    dataServices.prisma.transactions.createApproved.mockResolvedValue({
      id: 'trx-approved',
      requestId: payload.requestId,
      organizationId: 'org-1',
      cardId: 'card-1',
      stationId: payload.stationId,
      amount: '100.00',
      trxAt: new Date(payload.transactionAt),
      status: TransactionStatus.APPROVED,
      rejectionReason: null,
      createdAt: new Date()
    });

    const useCase = new TransactionUseCases(dataServices as unknown as IDataServices, new TransactionFactoryService());
    const result = await useCase.process(payload);

    expect(result.status).toBe(WebhookResponseStatus.APPROVED);
    expect(result.transactionId).toBe('trx-approved');
    expect(dataServices.prisma.transactions.createApproved).toHaveBeenCalledTimes(1);
    expect(dataServices.prisma.organizations.updateBalance).toHaveBeenCalledTimes(1);
    expect(dataServices.prisma.cards.addUsage).toHaveBeenCalledTimes(1);
    expect(dataServices.prisma.ledgers.create).toHaveBeenCalledTimes(1);
    expect(dataServices.prisma.rejectionLogs.create).not.toHaveBeenCalled();
  });

  it('publishes approved event when transaction is approved', async () => {
    const dataServices = createMockDataServices();
    const eventPublisher: jest.Mocked<ITransactionEventPublisher> = {
      publishApproved: jest.fn(),
      publishRejected: jest.fn()
    };

    dataServices.prisma.transactions.findByRequestId.mockResolvedValue(null);
    dataServices.prisma.cards.findByCardNumber.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.cards.findById.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.organizations.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Org',
      currentBalance: '500.00',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.cards.getUsageSnapshot.mockResolvedValue({
      dailyUsedAmount: '0',
      monthlyUsedAmount: '0'
    });
    dataServices.prisma.transactions.createApproved.mockResolvedValue({
      id: 'trx-approved',
      requestId: payload.requestId,
      organizationId: 'org-1',
      cardId: 'card-1',
      stationId: payload.stationId,
      amount: '100.00',
      trxAt: new Date(payload.transactionAt),
      status: TransactionStatus.APPROVED,
      rejectionReason: null,
      createdAt: new Date()
    });

    const useCase = new TransactionUseCases(
      dataServices as unknown as IDataServices,
      new TransactionFactoryService(),
      eventPublisher
    );
    await useCase.process(payload);

    expect(eventPublisher.publishApproved).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publishRejected).not.toHaveBeenCalled();
  });

  it('returns rejected when card becomes inactive after lock', async () => {
    const dataServices = createMockDataServices();
    dataServices.prisma.transactions.findByRequestId.mockResolvedValue(null);
    dataServices.prisma.cards.findByCardNumber.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.organizations.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Org',
      currentBalance: '500.00',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.cards.findById.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.prisma.transactions.createRejected.mockResolvedValue({
      id: 'trx-rejected',
      requestId: payload.requestId,
      organizationId: 'org-1',
      cardId: 'card-1',
      stationId: payload.stationId,
      amount: '100.00',
      trxAt: new Date(payload.transactionAt),
      status: TransactionStatus.REJECTED,
      rejectionReason: RejectionReason.CARD_NOT_FOUND,
      createdAt: new Date()
    });

    const useCase = new TransactionUseCases(dataServices as unknown as IDataServices, new TransactionFactoryService());
    const result = await useCase.process(payload);

    expect(result.status).toBe(WebhookResponseStatus.REJECTED);
    expect(result.reason).toBe(RejectionReason.CARD_NOT_FOUND);
    expect(result.transactionId).toBe('trx-rejected');
    expect(dataServices.prisma.cards.getUsageSnapshot).not.toHaveBeenCalled();
  });
});
