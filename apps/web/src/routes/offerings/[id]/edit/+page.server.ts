// Edit an offering and its photos (owner only). The type can't change.
import { error, redirect } from '@sveltejs/kit';
import { apiFor, toApiError } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { formValues, offeringBody } from '#lib/offering-form.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { Offering } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const offering = await loadOr404(() => apiFor(event).get<Offering>(`/api/v1/offerings/${encodeURIComponent(event.params.id)}`));
  if (offering.owner.id !== event.locals.member?.id) error(403, 'Only the person who listed this can edit it.');
  return { offering };
});

const base = (id: string | undefined) => `/api/v1/offerings/${encodeURIComponent(id ?? '')}`;

export const actions: Actions = {
  save: formAction(async ({ event, form, api }) => {
    const values = formValues(form);
    await api.patch(base(event.params.id), offeringBody(values, { forEdit: true }));
    redirect(303, `/offerings/${event.params.id}`);
  }),
  addPhotos: formAction(async ({ event, form, api }) => {
    const problems: string[] = [];
    let added = 0;
    for (let index = 0; index < 6; index += 1) {
      const file = form.get(`photo_${index}`);
      if (!(file instanceof File) || file.size === 0) continue;
      const upload = new FormData();
      upload.set('file', file);
      upload.set('alt', String(form.get(`alt_${index}`) ?? ''));
      const response = await api.raw(`${base(event.params.id)}/photos`, { method: 'POST', body: upload });
      if (response.ok) added += 1;
      else problems.push(`Photo ${index + 1}: ${(await toApiError(response)).message}`);
    }
    if (problems.length) return { photoError: problems.join(' '), added };
    return { added };
  }),
  updatePhoto: formAction(async ({ event, form, api }) => {
    await api.patch(`${base(event.params.id)}/photos/${encodeURIComponent(String(form.get('photoId')))}`, { alt: text(form, 'alt') ?? null });
    return { photoSaved: true };
  }),
  // Deleting asks first; the second press (with `confirmed`) deletes.
  deletePhoto: formAction(async ({ event, form, api }) => {
    const photoId = String(form.get('photoId'));
    if (form.get('confirmed') !== 'yes') return { confirmDelete: photoId };
    await api.delete(`${base(event.params.id)}/photos/${encodeURIComponent(photoId)}`);
    return { photoDeleted: true };
  })
};
