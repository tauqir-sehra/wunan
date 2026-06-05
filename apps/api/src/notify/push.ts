// Device notifications through Web Push, with the operator's own VAPID keys. No third-party
// push service is used beyond the browser's own (contracts/notifications.md).
import { eq } from 'drizzle-orm';
import webpush from 'web-push';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { pushSubscription } from '../db/schema/index.ts';
import { log } from '../lib/log.ts';
import { pushPublicKey } from '../modules/settings.ts';
import type { Notice } from './index.ts';

/** Sends a notice to every device the member turned on. Gone devices are removed. */
export async function sendPushToMember(memberId: string, notice: Notice) {
  if (!pushPublicKey()) return;
  const devices = await db.select().from(pushSubscription).where(eq(pushSubscription.memberId, memberId));
  // Only these three fields reach the device; the service worker shows them silently.
  const payload = JSON.stringify({ title: notice.title, body: notice.body, url: notice.url });

  await Promise.all(
    devices.map(async (device) => {
      if (device.platform !== 'web' || !device.p256dh || !device.auth) return;
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
          {
            vapidDetails: {
              subject: config.VAPID_SUBJECT,
              publicKey: config.VAPID_PUBLIC_KEY,
              privateKey: config.VAPID_PRIVATE_KEY
            },
            TTL: 24 * 60 * 60,
            urgency: 'normal',
            timeout: 10_000
          }
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The browser unsubscribed or the member cleared its data; the address won't work again.
          await db.delete(pushSubscription).where(eq(pushSubscription.id, device.id));
          log.info('push_subscription_gone');
          return;
        }
        log.warn('push_send_failed', { status: status ?? 'network' });
      }
    })
  );
}
