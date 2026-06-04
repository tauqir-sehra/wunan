// Simple rate limits stored in the database, so they survive restarts and work across
// several API processes. Used for messages, invitations, flags, and joining.
import { getConnInfo } from '@hono/node-server/conninfo';
import { and, count, eq, gt, lt } from 'drizzle-orm';
import type { Context } from 'hono';
import { db } from '../db/index.ts';
import { rateLimitEvent } from '../db/schema/index.ts';
import { errors } from './errors.ts';

/** Records one attempt for `key`, or throws "slow down" if `max` attempts already happened. */
export async function checkRateLimit(key: string, max: number, windowMinutes: number) {
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const [row] = await db
    .select({ attempts: count() })
    .from(rateLimitEvent)
    .where(and(eq(rateLimitEvent.key, key), gt(rateLimitEvent.createdAt, since)));
  if ((row?.attempts ?? 0) >= max) throw errors.slowDown();
  await db.insert(rateLimitEvent).values({ key });
}

/** Deletes attempts older than a day (the longest window used). Run by the hourly job. */
export async function pruneRateLimitEvents() {
  await db.delete(rateLimitEvent).where(lt(rateLimitEvent.createdAt, new Date(Date.now() - 86_400_000)));
}

/**
 * The visitor's address for per-IP limits (research §14, "Visitor address"). Caddy and the web
 * app put it in `X-Forwarded-For`; the right-most entry is the one our own proxy added. Without
 * the header (local development, direct curl) the connection's address is used.
 */
export function clientAddress(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const last = forwarded.split(',').at(-1)?.trim();
    if (last) return last;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown'; // No socket, e.g. in tests that call app.request() without the header.
  }
}
