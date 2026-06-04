// drizzle-kit settings: generates SQL migrations from the schema files into ./drizzle.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case'
});
