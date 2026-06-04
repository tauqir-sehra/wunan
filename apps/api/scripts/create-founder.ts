// Creates a founding member: someone who joins without an invitation and is the last step for
// mediation (FR-029a). Operators run this once or a few times when setting up a community.
//
//   npm run create-founder -w apps/api                  (asks for the details)
//   npm run create-founder -w apps/api -- --email a@b.org --name "Sam" --password "…"
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' }, password: { type: 'string' } }
});

const { createAccount } = await import('../src/modules/members.ts');
const { sql } = await import('../src/db/index.ts');

const prompt = createInterface({ input: process.stdin, output: process.stdout });
const email = values.email ?? (await prompt.question('Email: '));
const displayName = values.name ?? (await prompt.question('Display name: '));
const password = values.password ?? (await prompt.question('Password (10–128 characters): '));
prompt.close();

try {
  const founder = await createAccount({ email, displayName, password, isFounder: true, emailVerified: true });
  console.log(`Founding member created: ${founder.displayName}`);
} catch (error) {
  console.error(`Could not create the founding member: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
