import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { requisitionsTable } from '../requisitions/requisition.schema';
import { templatesTable } from '../templates/template.schema';

export const artifactsTable = pgTable('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  requisitionId: uuid('requisition_id')
    .notNull()
    .references(() => requisitionsTable.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id')
    .notNull()
    .references(() => templatesTable.id, { onDelete: 'restrict' }), // restrict evita deletar um template que já gerou artefatos
  artifactType: varchar('artifact_type', { length: 100 }).notNull(), // Ex: REQUIREMENTS, ARCHITECTURE_DOC, UML_DIAGRAM
  fileName: varchar('file_name', { length: 255 }).notNull(),
  generatedContent: text('generated_content'), // Pode ser null enquanto está no status inicial
  status: varchar('status', { length: 50 }).notNull().default('DRAFT'), // Ex: DRAFT, APPROVED, REJECTED
  iterationCount: integer('iteration_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
