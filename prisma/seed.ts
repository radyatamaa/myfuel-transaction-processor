import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const CARD_1_ID = '22222222-2222-4222-8222-222222222222';
const CARD_2_ID = '33333333-3333-4333-8333-333333333333';

async function main(): Promise<void> {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {
      name: 'Demo Logistics',
      currentBalance: '5000000.00'
    },
    create: {
      id: ORG_ID,
      name: 'Demo Logistics',
      currentBalance: '5000000.00'
    }
  });

  await prisma.card.upsert({
    where: { cardNumber: '6037991234561001' },
    update: {
      organizationId: ORG_ID,
      dailyLimit: '2000000.00',
      monthlyLimit: '30000000.00',
      isActive: true
    },
    create: {
      id: CARD_1_ID,
      organizationId: ORG_ID,
      cardNumber: '6037991234561001',
      dailyLimit: '2000000.00',
      monthlyLimit: '30000000.00',
      isActive: true
    }
  });

  await prisma.card.upsert({
    where: { cardNumber: '6037991234561002' },
    update: {
      organizationId: ORG_ID,
      dailyLimit: '1000000.00',
      monthlyLimit: '15000000.00',
      isActive: true
    },
    create: {
      id: CARD_2_ID,
      organizationId: ORG_ID,
      cardNumber: '6037991234561002',
      dailyLimit: '1000000.00',
      monthlyLimit: '15000000.00',
      isActive: true
    }
  });

  console.log('Seed completed');
  console.log('Organization:', ORG_ID, 'Demo Logistics');
  console.log('Cards:', '6037991234561001', '6037991234561002');
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
