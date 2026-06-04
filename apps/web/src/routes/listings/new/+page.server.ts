// Create a listing in four short steps (FR-007). Works without JavaScript: each step is a normal
// form post, and earlier answers travel along as hidden fields. Photos are chosen on the last step
// because files can't be carried between steps.
import { fail, redirect } from '@sveltejs/kit';
import { CreateListing, ListingType } from '@wunan/shared';
import { formAction } from '#lib/form-action.ts';
import { formValues, listingBody } from '#lib/listing-form.ts';
import { fieldErrors } from '#lib/zod-fields.ts';
import { toApiError } from '#lib/api.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  const type = ListingType.safeParse(url.searchParams.get('type'));
  return { startType: type.success ? type.data : null };
};

const AREA_STEP = 3;

export const actions: Actions = {
  next: async ({ request }) => {
    const values = formValues(await request.formData());
    const step = Number(values._step ?? 1);

    if (step === 1 && !ListingType.safeParse(values.type).success) {
      return fail(400, { step, values, fields: { type: 'Please choose what kind of listing this is.' } });
    }
    if (step >= 2) {
      const checked = CreateListing.safeParse(listingBody(values));
      if (!checked.success) {
        const fields = fieldErrors(checked.error);
        // Area is asked on step 3; everything else on step 2.
        const relevant = Object.fromEntries(Object.entries(fields).filter(([name]) => (step === AREA_STEP) === (name === 'area')));
        if (Object.keys(relevant).length > 0) return fail(400, { step, values, fields: relevant });
      }
    }
    return { step: step + 1, values };
  },

  back: async ({ request }) => {
    const values = formValues(await request.formData());
    return { step: Math.max(1, Number(values._step ?? 2) - 1), values };
  },

  publish: formAction(async ({ form, api }) => {
    const values = formValues(form);
    const created = await api.post<{ id: string }>('/api/v1/listings', listingBody(values));

    // Photos are added one by one; a problem with one photo doesn't undo the listing.
    const problems: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      const file = form.get(`photo_${index}`);
      if (!(file instanceof File) || file.size === 0) continue;
      const upload = new FormData();
      upload.set('file', file);
      upload.set('alt', String(form.get(`alt_${index}`) ?? ''));
      const response = await api.raw(`/api/v1/listings/${created.id}/photos`, { method: 'POST', body: upload });
      if (!response.ok) problems.push(`Photo ${index + 1}: ${(await toApiError(response)).message}`);
    }
    const query = new URLSearchParams({ created: '1' });
    if (problems.length) query.set('photoProblems', problems.join(' '));
    redirect(303, `/listings/${created.id}?${query}`);
  })
};
