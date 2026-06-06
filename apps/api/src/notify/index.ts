// Decides whether and how to tell a member about something (contracts/notifications.md).
// Calm rules: only the types a member turned on, no urgency, short previews, and at most one
// notification per conversation per hour (constitution V). Requests and public threads are kept
// infrequent the same way, keyed by the request or offering (003 FR-023e).
import { and, eq, gt } from 'drizzle-orm';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import {
  member,
  notificationLog,
  notificationPreference,
  type NotificationType
} from '../db/schema/index.ts';
import { log } from '../lib/log.ts';
import { sendEmail } from './email.ts';
import { sendPushToMember } from './push.ts';

export type Notice = {
  title: string;
  body: string;
  /** Path in the web app, e.g. "/messages/123". */
  url: string;
  conversationId?: string;
  /** At most one notice about this request or offering per `minutes` for each member. */
  throttle?: { subjectId: string; minutes: number };
};

const PREVIEW_LIMIT = 100;

/** Removes exclamation marks and shortens previews, so no notification reads as urgent. */
export function calm(text: string, limit = PREVIEW_LIMIT): string {
  const quiet = text.replace(/!+/g, '.').replace(/\s+/g, ' ').trim();
  return quiet.length > limit ? `${quiet.slice(0, limit - 1).trimEnd()}…` : quiet;
}

export async function notify(memberId: string, type: NotificationType, notice: Notice) {
  const [recipient] = await db
    .select({ email: member.email, deletedAt: member.deletedAt })
    .from(member)
    .where(eq(member.id, memberId));
  if (!recipient || recipient.deletedAt) return;

  // Missing preference rows mean the defaults: both channels off.
  const [preference] = await db
    .select()
    .from(notificationPreference)
    .where(and(eq(notificationPreference.memberId, memberId), eq(notificationPreference.type, type)));
  const wantsEmail = preference?.email ?? false;
  const wantsDevice = preference?.device ?? false;
  if (!wantsEmail && !wantsDevice) return;

  if (notice.conversationId) {
    const hourAgo = new Date(Date.now() - 60 * 60_000);
    const [recent] = await db
      .select({ id: notificationLog.id })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.memberId, memberId),
          eq(notificationLog.conversationId, notice.conversationId),
          gt(notificationLog.sentAt, hourAgo)
        )
      )
      .limit(1);
    if (recent) return;
  }

  if (notice.throttle) {
    const since = new Date(Date.now() - notice.throttle.minutes * 60_000);
    const [recent] = await db
      .select({ id: notificationLog.id })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.memberId, memberId),
          eq(notificationLog.type, type),
          eq(notificationLog.subjectId, notice.throttle.subjectId),
          gt(notificationLog.sentAt, since)
        )
      )
      .limit(1);
    if (recent) return;
  }

  const { throttle, ...rest } = notice;
  const calmNotice = { ...rest, title: calm(notice.title, 120), body: calm(notice.body) };
  await db
    .insert(notificationLog)
    .values({ memberId, type, conversationId: notice.conversationId ?? null, subjectId: throttle?.subjectId ?? null });

  // A failed channel is logged, never shown as an error to whoever caused the notification.
  if (wantsEmail) {
    await sendEmail({
      to: recipient.email,
      subject: calmNotice.title,
      text: `${calmNotice.body}\n\nOpen it in wunan:\n${siteLink(calmNotice.url)}`,
      settingsFooter: true
    }).catch(() => log.warn('notification_email_failed', { type }));
  }
  if (wantsDevice) {
    await sendPushToMember(memberId, calmNotice).catch(() => log.warn('notification_push_failed', { type }));
  }
}

function siteLink(path: string) {
  return `${config.SITE_URL}${path}`;
}
