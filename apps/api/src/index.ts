// Starts the wunan API: applies database migrations, serves HTTP, and runs the hourly jobs.
import { serve } from '@hono/node-server';
import { app } from './app.ts';
import { config } from './config.ts';
import { runMigrations } from './db/migrate.ts';
import { sql } from './db/index.ts';
import { startHourlyJobs } from './jobs.ts';
import { log } from './lib/log.ts';

await runMigrations();
const jobsTimer = startHourlyJobs();

const server = serve({ fetch: app.fetch, port: config.API_PORT }, (info) => {
  log.info('api_started', { port: info.port });
});

// Finish in-flight requests and close the database cleanly on shutdown (e.g., `docker stop`).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearInterval(jobsTimer);
    server.close(async () => {
      await sql.end({ timeout: 5 });
      process.exit(0);
    });
  });
}
