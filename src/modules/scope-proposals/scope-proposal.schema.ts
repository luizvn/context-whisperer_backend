import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { requisitionsTable } from '../requisitions/requisition.schema';

export const scopeProposalsTable = pgTable('scope_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  requisitionId: uuid('requisition_id')
    .notNull()
    .references(() => requisitionsTable.id, { onDelete: 'cascade' }),
  contentMd: text('content_md').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('PENDING'), // Ex: PENDING, APPROVED, REJECTED
  userFeedback: text('user_feedback'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
