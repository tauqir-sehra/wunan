// Runs once before the end-to-end tests: empties the test database. The Mailpit inbox is left
// alone, so emails from your own `npm run dev` session survive; tests use unique addresses.
import { execSync } from 'node:child_process';

export default async function globalSetup() {
  execSync('npm run db:reset-test -w apps/api', { cwd: '../..', stdio: 'inherit' });
}
