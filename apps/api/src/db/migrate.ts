// Applies any SQL migrations in ./drizzle that the database has not seen yet.
// Runs on every API start, and on its own with `npm run db:migrate`.
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from './index.ts';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations() {
  await migrate(db, { migrationsFolder });
}

if (import.meta.main) {
  await runMigrations();
  await sql.end();
  console.log('Database is up to date.');
}
