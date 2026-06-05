// Notification settings and the devices that receive notifications (FR-031, FR-031a).
// Both channels are off until the member turns them on; nothing here turns them on by itself
// except the one explained step of turning on this device (contracts/notifications.md).
import type { NewPushSubscription, NotificationPreferences } from '@wunan/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { notificationPreference, notificationTypes, pushSubscription } from '../db/schema/index.ts';
import { ApiError, errors } from '../lib/errors.ts';

export async function getPreferences(memberId: string) {
  const rows = await db
    .select({ type: notificationPreference.type, email: notificationPreference.email, device: notificationPreference.device })
    .from(notificationPreference)
    .where(eq(notificationPreference.memberId, memberId));
  // Missing rows mean the defaults: both channels off.
  return notificationTypes.map((type) => {
    const row = rows.find((r) => r.type === type);
    return { type, email: row?.email ?? false, device: row?.device ?? false };
  });
}

export async function savePreferences(memberId: string, preferences: NotificationPreferences) {
  const seen = new Set<string>();
  for (const preference of preferences) {
    if (seen.has(preference.type)) {
      throw new ApiError(400, 'validation_failed', 'Some details need fixing.', {
        form: 'Each kind of notification can only be listed once.'
      });
    }
    seen.add(preference.type);
  }
  if (preferences.length > 0) {
    await db
      .insert(notificationPreference)
      .values(preferences.map((p) => ({ memberId, type: p.type, email: p.email, device: p.device })))
      .onConflictDoUpdate({
        target: [notificationPreference.memberId, notificationPreference.type],
        set: { email: rawExcluded('email'), device: rawExcluded('device') }
      });
  }
  return getPreferences(memberId);
}

// `excluded.<column>` refers to the row that conflicted, so each type gets its own values.
const rawExcluded = (column: 'email' | 'device') => sql.raw(`excluded.${column}`);

/** Null when the operator has not set up device notifications (no VAPID keys). */
export function pushPublicKey() {
  return config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY && config.VAPID_SUBJECT ? config.VAPID_PUBLIC_KEY : null;
}

export async function listDevices(memberId: string) {
  const rows = await db
    .select({ id: pushSubscription.id, label: pushSubscription.label, createdAt: pushSubscription.createdAt })
    .from(pushSubscription)
    .where(eq(pushSubscription.memberId, memberId))
    .orderBy(asc(pushSubscription.createdAt));
  return {
    publicKey: pushPublicKey(),
    devices: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
  };
}

/**
 * Browsers only hand out addresses on their makers' push services. Accepting only those keeps
 * the API from being told to send requests to arbitrary servers, including ones on the
 * operator's own network.
 */
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/
];

function isKnownPushService(endpoint: string) {
  const url = new URL(endpoint);
  return url.protocol === 'https:' && url.port === '' && PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname));
}

/**
 * Saves this device and, as part of the same single step, turns on device notifications for
 * every kind if none were on yet (the page says so before the member presses the button).
 * A browser has one address; if someone else turned it on before, it now belongs to this member.
 */
export async function addDevice(memberId: string, details: NewPushSubscription) {
  if (!pushPublicKey()) {
    throw new ApiError(409, 'push_not_available', "Device notifications aren't set up on this wunan.");
  }
  if (!isKnownPushService(details.endpoint)) {
    throw new ApiError(400, 'validation_failed', 'Some details need fixing.', {
      endpoint: "This browser's notification service isn't supported. Email notifications still work."
    });
  }
  return db.transaction(async (tx) => {
    const [saved] = await tx
      .insert(pushSubscription)
      .values({
        memberId,
        platform: details.platform,
        endpoint: details.endpoint,
        p256dh: details.keys.p256dh,
        auth: details.keys.auth,
        label: details.label
      })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: { memberId, p256dh: details.keys.p256dh, auth: details.keys.auth, label: details.label, createdAt: new Date() }
      })
      .returning();
    if (!saved) throw new Error('Device was not saved');

    const current = await tx
      .select({ device: notificationPreference.device })
      .from(notificationPreference)
      .where(and(eq(notificationPreference.memberId, memberId), eq(notificationPreference.device, true)))
      .limit(1);
    if (current.length === 0) {
      await tx
        .insert(notificationPreference)
        .values(notificationTypes.map((type) => ({ memberId, type, device: true })))
        .onConflictDoUpdate({
          target: [notificationPreference.memberId, notificationPreference.type],
          set: { device: true }
        });
    }
    return { id: saved.id, label: saved.label, createdAt: saved.createdAt.toISOString() };
  });
}

/** Only the member who owns a device can remove it; anyone else is told it doesn't exist. */
export async function removeDevice(memberId: string, deviceId: string) {
  const removed = await db
    .delete(pushSubscription)
    .where(and(eq(pushSubscription.id, deviceId), eq(pushSubscription.memberId, memberId)))
    .returning({ id: pushSubscription.id });
  if (removed.length === 0) throw errors.notFound('That device');
}
