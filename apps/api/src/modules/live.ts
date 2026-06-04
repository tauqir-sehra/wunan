// Live delivery of new messages to members who have a conversation open (FR-018a; research §9).
// Saving a message runs NOTIFY on the conversation's channel; this module LISTENs (one shared
// database connection for all channels, managed by postgres.js) and hands the new message's id to
// every open stream for that conversation.
import { sql } from '../db/index.ts';
import { log } from '../lib/log.ts';

type Subscriber = { memberId: string; deliver: (messageId: string) => void };
type Channel = { subscribers: Set<Subscriber>; unlisten: Promise<() => Promise<void>> };

const channels = new Map<string, Channel>();

/** The NOTIFY channel name for a conversation (letters, digits, and underscores only). */
export const channelFor = (conversationId: string) => `conversation_${conversationId.replace(/-/g, '')}`;

/** Starts delivering new message ids for a conversation. Returns a function that stops it. */
export function subscribe(conversationId: string, memberId: string, deliver: (messageId: string) => void) {
  const subscriber: Subscriber = { memberId, deliver };
  let channel = channels.get(conversationId);
  if (!channel) {
    const subscribers = new Set<Subscriber>();
    const unlisten = sql
      .listen(channelFor(conversationId), (messageId) => {
        for (const s of subscribers) s.deliver(messageId);
      })
      .then((listening) => listening.unlisten);
    unlisten.catch((error: Error) => log.error('live_listen_failed', { reason: error.message }));
    channel = { subscribers, unlisten };
    channels.set(conversationId, channel);
  }
  channel.subscribers.add(subscriber);

  return async () => {
    const current = channels.get(conversationId);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (current.subscribers.size === 0) {
      channels.delete(conversationId);
      await (await current.unlisten)();
    }
  };
}

/** Resolves once the database is listening for this conversation (used by tests). */
export async function ready(conversationId: string) {
  await channels.get(conversationId)?.unlisten;
}

/** Whether a member has this conversation open right now (they don't need a notification). */
export function isConnected(memberId: string, conversationId: string) {
  const channel = channels.get(conversationId);
  if (!channel) return false;
  for (const s of channel.subscribers) if (s.memberId === memberId) return true;
  return false;
}

/** Tells everyone with the conversation open that a message was saved. */
export async function announce(conversationId: string, messageId: string) {
  await sql`select pg_notify(${channelFor(conversationId)}, ${messageId})`;
}
