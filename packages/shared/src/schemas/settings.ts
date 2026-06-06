// Notification settings, devices, and leaving wunan (FR-031, FR-031a, FR-032).
import { z } from 'zod';

export const notificationTypes = ['message', 'agreement', 'reminder', 'report', 'flag', 'request', 'public_message'] as const;
export const NotificationType = z.enum(notificationTypes);
export type NotificationType = z.infer<typeof NotificationType>;

export const NotificationPreference = z.object({
  type: NotificationType,
  email: z.boolean(),
  device: z.boolean()
});
export type NotificationPreference = z.infer<typeof NotificationPreference>;

/** All five types, each with an email and a device switch. Types left out keep their setting. */
export const NotificationPreferences = z.array(NotificationPreference).max(notificationTypes.length);
export type NotificationPreferences = z.infer<typeof NotificationPreferences>;

/** A browser's push subscription. Other platforms (e.g. UnifiedPush) are reserved for future apps. */
export const NewPushSubscription = z.object({
  platform: z.literal('web'),
  endpoint: z
    .url({ protocol: /^https?$/, message: 'That device address is not valid.' })
    .max(2000, 'That device address is not valid.'),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100)
  }),
  label: z
    .string()
    .trim()
    .min(1, 'Please give this device a name.')
    .max(60, 'Please keep the device name to 60 characters or fewer.')
});
export type NewPushSubscription = z.infer<typeof NewPushSubscription>;

export const PushDevice = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.string()
});
export type PushDevice = z.infer<typeof PushDevice>;

export const PushDevices = z.object({
  /** Null when this wunan has no device-notification keys set up; the button is then hidden. */
  publicKey: z.string().nullable(),
  devices: z.array(PushDevice)
});
export type PushDevices = z.infer<typeof PushDevices>;

export const DeleteAccount = z.object({
  password: z.string({ message: 'Please enter your password.' }).min(1, 'Please enter your password.')
});
export type DeleteAccount = z.infer<typeof DeleteAccount>;
