export interface Card {
  id: string;
  organizationId: string;
  cardNumber: string;
  dailyLimit: string;
  monthlyLimit: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CardDailyUsage {
  id: string;
  cardId: string;
  usageDate: string;
  usedAmount: string;
  updatedAt: Date;
}

export interface CardMonthlyUsage {
  id: string;
  cardId: string;
  usageMonth: string;
  usedAmount: string;
  updatedAt: Date;
}
