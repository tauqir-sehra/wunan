// Prepares the test database for end-to-end tests: applies migrations, then empties every table.
// Always uses TEST_DATABASE_URL, never the development or production database.
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { runMigrations } = await import('../src/db/migrate.ts');
const { truncateAllTables } = await import('../src/db/reset.ts');
const { sql } = await import('../src/db/index.ts');
await runMigrations();
await truncateAllTables();
await sql.end();
console.log('Test database is ready.');
