// Runs once before all API tests: brings the test database schema up to date.
export default async function setup() {
  await import('./env.ts');
  const { runMigrations } = await import('../db/migrate.ts');
  const { sql } = await import('../db/index.ts');
  await runMigrations();
  await sql.end();
}
