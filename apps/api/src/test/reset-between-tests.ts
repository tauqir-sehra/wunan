// Every test starts with empty tables, so tests never depend on each other.
import { beforeEach } from 'vitest';
import { truncateAllTables } from '../db/reset.ts';
import { testOutbox } from '../notify/email.ts';

beforeEach(async () => {
  await truncateAllTables();
  testOutbox.length = 0;
});
