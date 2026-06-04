import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function runMigrations() {
  console.log('⏳ Iniciando execução das migrations...');

  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:senha@localhost:5432/context_whisperer';
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    console.log('✅ Migrations aplicadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao aplicar migrations:', error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

void runMigrations();
