import { Provider } from '@nestjs/common';
import { prisma, PrismaClient } from '@context-whisperer/database';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

export const databaseProvider: Provider = {
  provide: DATABASE_CONNECTION,
  useFactory: (): PrismaClient => {
    return prisma;
  },
};
