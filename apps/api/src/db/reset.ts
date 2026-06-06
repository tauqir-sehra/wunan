// Empties every wunan table. Used only by tests and the test-database reset script.
import { sql } from './index.ts';

export async function truncateAllTables() {
  const tables = await sql<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'`;
  if (tables.length === 0) return;
  const names = tables.map((t) => `"${t.tablename}"`).join(', ');
  await sql.unsafe(`truncate ${names} restart identity cascade`);
}

/**
 * Drops every table, type, and recorded migration, leaving an empty database. Development and tests
 * only: wunan keeps no data across schema rewrites before its first release (002 research §9).
 */
export async function dropEverything() {
  await sql`drop schema if exists drizzle cascade`;
  await sql`drop schema public cascade`;
  await sql`create schema public`;
}
