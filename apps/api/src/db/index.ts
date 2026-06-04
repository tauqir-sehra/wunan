// The single database connection pool, shared by the whole API.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.ts';
import * as schema from './schema/index.ts';

export const sql = postgres(config.DATABASE_URL, { max: 10, onnotice: () => {} });
export const db = drizzle(sql, { schema, casing: 'snake_case' });
export type Database = typeof db;
export { schema };
