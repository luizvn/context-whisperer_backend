import { Provider } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

export const databaseProvider: Provider = {
  provide: DATABASE_CONNECTION,
  useFactory: () => {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:senha@localhost:5432/context_whisperer';

    const client = postgres(connectionString);

    return drizzle(client);
  },
};
