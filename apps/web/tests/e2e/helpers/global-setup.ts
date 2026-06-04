// Runs once before the end-to-end tests: empties the test database and the Mailpit inbox.
import { execSync } from 'node:child_process';

export default async function globalSetup() {
  execSync('npm run db:reset-test -w apps/api', { cwd: '../..', stdio: 'inherit' });
  await fetch('http://localhost:8025/api/v1/messages', { method: 'DELETE' });
}
