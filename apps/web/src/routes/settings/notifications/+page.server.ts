// Notification settings: an email and a device switch for each kind, and the devices that
// receive them (FR-031, FR-031a; contracts/notifications.md).
import { apiFor } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { memberLoad } from '#lib/load.ts';
import { notificationTypes, type NotificationPreferences, type PushDevices } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const [preferences, devices] = await Promise.all([
    api.get<NotificationPreferences>('/api/v1/me/notification-preferences'),
    api.get<PushDevices>('/api/v1/me/push-subscriptions')
  ]);
  return { preferences, devices };
});

export const actions: Actions = {
  // Unticked checkboxes are not sent, so every kind is saved from what was ticked.
  save: formAction(async ({ form, api }) => {
    await api.put(
      '/api/v1/me/notification-preferences',
      notificationTypes.map((type) => ({
        type,
        email: form.get(`email-${type}`) === 'on',
        device: form.get(`device-${type}`) === 'on'
      }))
    );
    return { saved: 'preferences' as const };
  }),
  removeDevice: formAction(async ({ form, api }) => {
    await api.delete(`/api/v1/me/push-subscriptions/${encodeURIComponent(String(form.get('id') ?? ''))}`);
    return { saved: 'removed' as const };
  })
};
