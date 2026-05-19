import { pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';

export const templatesTable = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  targetDocument: varchar('target_document', { length: 255 }).notNull(), // Ex: 2_Arquitetura.md
  contentMd: text('content_md').notNull(),
});
