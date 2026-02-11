import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppController } from '../src/controllers/app.controller';
import { WebhookController } from '../src/controllers/webhook.controller';
import { HttpExceptionFilter } from '../src/configuration/filters/http-exception.filter';
import { IDataServices } from '../src/core/abstracts';
import { RejectionReason, TransactionStatus } from '../src/core/entities';
import { TransactionUseCases } from '../src/use-cases/transaction/transaction.use-case';

type MockDataServices = {
  cards: {
    findByCardNumber: jest.Mock;
    getUsageSnapshot: jest.Mock;
    addUsage: jest.Mock;
  };
  organizations: {
    findById: jest.Mock;
    updateBalance: jest.Mock;
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

function createMockDataServices(): MockDataServices {
  const dataServices: MockDataServices = {
    cards: {
      findByCardNumber: jest.fn(),
      getUsageSnapshot: jest.fn(),
      addUsage: jest.fn()
    },
    organizations: {
      findById: jest.fn(),
      updateBalance: jest.fn()
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

const describeE2E = process.env.ENABLE_E2E_SOCKET === 'true' ? describe : describe.skip;

describeE2E('WebhookController (e2e)', () => {
  let app: INestApplication;
  const dataServices = createMockDataServices();
  const httpApp = () => app.getHttpAdapter().getInstance();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, WebhookController],
      providers: [
        TransactionUseCases,
        {
          provide: IDataServices,
          useValue: dataServices
        }
      ]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
      })
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
    dataServices.runInTransaction.mockImplementation(
      async (callback: (tx: IDataServices) => Promise<unknown>) => {
        return callback(dataServices as unknown as IDataServices);
      }
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns ok', async () => {
    await request(httpApp())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, message: 'ok' });
      });
  });

  it('POST /api/v1/webhooks/transactions returns 400 on invalid payload', async () => {
    await request(httpApp())
      .post('/api/v1/webhooks/transactions')
      .send({
        requestId: 'req-invalid',
        amount: -10,
        transactionAt: 'invalid-date'
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.success).toBe(false);
        expect(body.statusCode).toBe(400);
      });
  });

  it('POST /api/v1/webhooks/transactions returns approved response', async () => {
    dataServices.transactions.findByRequestId.mockResolvedValue(null);
    dataServices.cards.findByCardNumber.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: '6037991234561001',
      dailyLimit: '1000.00',
      monthlyLimit: '10000.00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.organizations.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Org',
      currentBalance: '5000.00',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataServices.cards.getUsageSnapshot.mockResolvedValue({
      dailyUsedAmount: '100.00',
      monthlyUsedAmount: '500.00'
    });
    dataServices.transactions.createApproved.mockResolvedValue({
      id: 'trx-approved',
      requestId: 'req-approve',
      organizationId: 'org-1',
      cardId: 'card-1',
      stationId: 'SPBU-1',
      amount: '150.00',
      trxAt: new Date('2026-02-11T10:00:00Z'),
      status: TransactionStatus.APPROVED,
      rejectionReason: null,
      createdAt: new Date()
    });

    await request(httpApp())
      .post('/api/v1/webhooks/transactions')
      .send({
        requestId: 'req-approve',
        cardNumber: '6037991234561001',
        amount: 150,
        transactionAt: '2026-02-11T10:00:00Z',
        stationId: 'SPBU-1'
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.status).toBe('APPROVED');
        expect(body.transactionId).toBe('trx-approved');
      });
  });

  it('POST /api/v1/webhooks/transactions returns rejected on insufficient balance', async () => {
    dataServices.transactions.findByRequestId.mockResolvedValue(null);
    dataServices.cards.findByCardNumber.mockResolvedValue({
      id: 'card-1',
      organizationId: 'org-1',
      cardNumber: '6037991234561001',
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
      requestId: 'req-reject',
      organizationId: 'org-1',
      cardId: 'card-1',
      stationId: 'SPBU-1',
      amount: '100.00',
      trxAt: new Date('2026-02-11T10:00:00Z'),
      status: TransactionStatus.REJECTED,
      rejectionReason: RejectionReason.INSUFFICIENT_BALANCE,
      createdAt: new Date()
    });

    await request(httpApp())
      .post('/api/v1/webhooks/transactions')
      .send({
        requestId: 'req-reject',
        cardNumber: '6037991234561001',
        amount: 100,
        transactionAt: '2026-02-11T10:00:00Z',
        stationId: 'SPBU-1'
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(false);
        expect(body.status).toBe('REJECTED');
        expect(body.reason).toBe('INSUFFICIENT_BALANCE');
        expect(body.transactionId).toBe('trx-rejected');
      });
  });
});
