import { IDataServices, ITransactionEventPublisher } from '../../core/abstracts';
import { RejectionReason, TransactionStatus, WebhookResponseStatus } from '../../core/entities';
import { TransactionUseCases } from './transaction.use-case';
import { TransactionFactoryService } from './transaction-factory.service';

type MockDataServices = {
  cards: {
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
      cards: {
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
      runInTransaction: jest.fn()
    };

    dataServices.runInTransaction.mockImplementation(
      async (callback: (tx: IDataServices) => Promise<unknown>) => {
        return callback(dataServices as unknown as IDataServices);
      }
    );

    return dataServices;
  }

  it('returns rejected when requestId is duplicate', async () => {
    const dataServices = createMockDataServices();
    dataServices.transactions.findByRequestId.mockResolvedValue({
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

    const useCase = new TransactionUseCases(dataServices as unknown as IDataServices, new TransactionFactoryService());
    const result = await useCase.process(payload);

    expect(result.status).toBe(WebhookResponseStatus.REJECTED);
    expect(result.reason).toBe(RejectionReason.DUPLICATE_REQUEST);
    expect(dataServices.cards.findByCardNumber).not.toHaveBeenCalled();
  });

  it('persists rejected transaction when balance is insufficient', async () => {
    const dataServices = createMockDataServices();
    dataServices.transactions.findByRequestId.mockResolvedValue(null);
    dataServices.cards.findByCardNumber.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.organizations.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Org',
      currentBalance: '50.00',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.cards.getUsageSnapshot.mockResolvedValue({
      dailyUsedAmount: '0',
      monthlyUsedAmount: '0'
    });
    dataServices.transactions.createRejected.mockResolvedValue({
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
    expect(dataServices.transactions.createRejected).toHaveBeenCalledTimes(1);
  });

  it('returns approved and persists updates when validation passes', async () => {
    const dataServices = createMockDataServices();
    dataServices.transactions.findByRequestId.mockResolvedValue(null);
    dataServices.cards.findByCardNumber.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.organizations.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Org',
      currentBalance: '500.00',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.cards.getUsageSnapshot.mockResolvedValue({
      dailyUsedAmount: '100.00',
      monthlyUsedAmount: '200.00'
    });
    dataServices.transactions.createApproved.mockResolvedValue({
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
    expect(dataServices.transactions.createApproved).toHaveBeenCalledTimes(1);
    expect(dataServices.organizations.updateBalance).toHaveBeenCalledTimes(1);
    expect(dataServices.cards.addUsage).toHaveBeenCalledTimes(1);
    expect(dataServices.ledgers.create).toHaveBeenCalledTimes(1);
  });

  it('publishes approved event when transaction is approved', async () => {
    const dataServices = createMockDataServices();
    const eventPublisher: jest.Mocked<ITransactionEventPublisher> = {
      publishApproved: jest.fn(),
      publishRejected: jest.fn()
    };

    dataServices.transactions.findByRequestId.mockResolvedValue(null);
    dataServices.cards.findByCardNumber.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: payload.cardNumber,
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.organizations.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Org',
      currentBalance: '500.00',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.cards.getUsageSnapshot.mockResolvedValue({
      dailyUsedAmount: '0',
      monthlyUsedAmount: '0'
    });
    dataServices.transactions.createApproved.mockResolvedValue({
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
});
