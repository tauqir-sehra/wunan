// Live delivery of new messages to members who have a thread open (FR-018a; research §9): a private
// conversation, or a public thread on a request or offering (003 FR-023g). Saving a message runs
// NOTIFY on the thread's channel; this module LISTENs (one shared database connection for all
// channels, managed by postgres.js) and hands the new message's id to every open stream for it.
import { sql } from '../db/index.ts';
import { log } from '../lib/log.ts';

type Subscriber = { memberId: string; deliver: (messageId: string) => void };
type Channel = { subscribers: Set<Subscriber>; unlisten: Promise<() => Promise<void>> };

const channels = new Map<string, Channel>();

/** A private conversation, or the public thread of a request or offering (keyed by its id). */
export type ThreadKind = 'conversation' | 'public';

/** The NOTIFY channel name for a thread (letters, digits, and underscores only). */
export const channelFor = (id: string, kind: ThreadKind = 'conversation') => `${kind}_${id.replace(/-/g, '')}`;

/** Starts delivering new message ids for a thread. Returns a function that stops it. */
export function subscribe(id: string, memberId: string, deliver: (messageId: string) => void, kind: ThreadKind = 'conversation') {
  const subscriber: Subscriber = { memberId, deliver };
  const name = channelFor(id, kind);
  let channel = channels.get(name);
  if (!channel) {
    const subscribers = new Set<Subscriber>();
    const unlisten = sql
      .listen(name, (messageId) => {
        for (const s of subscribers) s.deliver(messageId);
      })
      .then((listening) => listening.unlisten);
    unlisten.catch((error: Error) => log.error('live_listen_failed', { reason: error.message }));
    channel = { subscribers, unlisten };
    channels.set(name, channel);
  }
  channel.subscribers.add(subscriber);

  return async () => {
    const current = channels.get(name);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (current.subscribers.size === 0) {
      channels.delete(name);
      await (await current.unlisten)();
    }
  };
}

/** Resolves once the database is listening for this thread (used by tests). */
export async function ready(id: string, kind: ThreadKind = 'conversation') {
  await channels.get(channelFor(id, kind))?.unlisten;
}

/** Whether a member has this thread open right now (they don't need a notification). */
export function isConnected(memberId: string, id: string, kind: ThreadKind = 'conversation') {
  const channel = channels.get(channelFor(id, kind));
  if (!channel) return false;
  for (const s of channel.subscribers) if (s.memberId === memberId) return true;
  return false;
}

/** Tells everyone with the thread open that a message was saved or changed. */
export async function announce(id: string, messageId: string, kind: ThreadKind = 'conversation') {
  await sql`select pg_notify(${channelFor(id, kind)}, ${messageId})`;
}
