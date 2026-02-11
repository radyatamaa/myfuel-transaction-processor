export interface Organization {
  id: string;
  name: string;
  currentBalance: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum BalanceLedgerType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT'
}

export interface BalanceLedger {
  id: string;
  organizationId: string;
  type: BalanceLedgerType;
  amount: string;
  beforeBalance: string;
  afterBalance: string;
  referenceType: string;
  referenceId: string;
  createdAt: Date;
}
