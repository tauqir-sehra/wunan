// Background jobs that run every hour inside the API process. A PostgreSQL advisory lock makes
// sure only one copy runs even if several API processes are started (research §11).
import { sql } from './db/index.ts';
import { pruneRateLimitEvents } from './lib/rate-limit.ts';
import { log } from './lib/log.ts';
import { releaseExpiredHolds } from './modules/invitations.ts';
import { runReminders } from './modules/reminders.ts';

const LOCK_ID = 7_412_001; // Any fixed number; identifies "wunan hourly jobs" to PostgreSQL.
const HOUR = 60 * 60_000;

type Job = { name: string; run: () => Promise<unknown> };

const jobs: Job[] = [
  { name: 'release_expired_holds', run: releaseExpiredHolds },
  { name: 'prune_rate_limits', run: pruneRateLimitEvents },
  { name: 'return_reminders', run: runReminders }
];

/** Adds a job (e.g., return reminders) to the hourly run. */
export function addHourlyJob(job: Job) {
  jobs.push(job);
}

export async function runHourlyJobs() {
  // An advisory lock belongs to one connection, so reserve one for the whole run.
  const connection = await sql.reserve();
  try {
    const [row] = await connection<{ locked: boolean }[]>`select pg_try_advisory_lock(${LOCK_ID}) as locked`;
    if (!row?.locked) return;
    try {
      for (const job of jobs) {
        await job.run().catch((error: Error) => log.error('job_failed', { job: job.name, reason: error.message }));
      }
    } finally {
      await connection`select pg_advisory_unlock(${LOCK_ID})`;
    }
  } finally {
    connection.release();
  }
}

export function startHourlyJobs() {
  const timer = setInterval(() => void runHourlyJobs(), HOUR);
  timer.unref();
  void runHourlyJobs();
  return timer;
}
