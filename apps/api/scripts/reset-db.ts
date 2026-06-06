// Deletes everything in the development database and rebuilds it from the migrations.
// Use after pulling a schema change: wunan keeps no data across schema rewrites before its first
// release. `--test` resets the test database (TEST_DATABASE_URL) instead. Never runs in production.
if (process.env.NODE_ENV === 'production') {
  console.error('reset-db deletes all data, so it never runs in production.');
  process.exit(1);
}
const useTest = process.argv.includes('--test');
if (useTest) {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

const { dropEverything } = await import('../src/db/reset.ts');
const { runMigrations } = await import('../src/db/migrate.ts');
const { sql } = await import('../src/db/index.ts');
await dropEverything();
await runMigrations();
await sql.end();
console.log(`${useTest ? 'Test database' : 'Database'} rebuilt from scratch.`);
