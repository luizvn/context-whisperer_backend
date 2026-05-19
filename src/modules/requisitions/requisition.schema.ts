import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { usersTable } from '../users/user.schema';

export const requisitionsTable = pgTable('requisitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  originalPrompt: text('original_prompt').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('AWAITING_SCOPE'), // Ex: AWAITING_SCOPE, GENERATING, COMPLETED
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
