import { IOrganizationRepository } from 'src/core/abstracts';
import { Organization } from 'src/core/entities';
import { DbClient } from './db-client.type';

export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Organization | null> {
    const row = await this.db.organization.findUnique({ where: { id } });
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      currentBalance: row.currentBalance.toString(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async updateBalance(id: string, newBalance: string): Promise<void> {
    await this.db.organization.update({
      where: { id },
      data: { currentBalance: newBalance }
    });
  }

  async lockById(id: string): Promise<void> {
    await this.db.$queryRaw`SELECT id FROM "Organization" WHERE id = ${id} FOR UPDATE`;
  }
}
