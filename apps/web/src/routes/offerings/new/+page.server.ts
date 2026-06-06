// Create an offering in four short steps (FR-007). Each step is a normal form post, and earlier answers
// travel along as hidden fields; the details step needs JavaScript (002 research §10). Photos are chosen on the last step
// because files can't be carried between steps.
import { fail, redirect } from '@sveltejs/kit';
import { CreateOffering, OfferingType } from '@wunan/shared';
import { formAction } from '#lib/form-action.ts';
import { formValues, offeringBody } from '#lib/offering-form.ts';
import { fieldErrors } from '#lib/zod-fields.ts';
import { apiFor, toApiError } from '#lib/api.ts';
import { offeringPrefillFromRequest } from '#lib/request-form.ts';
import { offeringTypeFor, type Request } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const type = OfferingType.safeParse(event.url.searchParams.get('type'));
  // Answering a request (003 FR-012): the type is fixed and the form starts from the request.
  const forRequest = event.url.searchParams.get('forRequest');
  if (forRequest && event.locals.member) {
    const request = await apiFor(event).get<Request>(`/api/v1/requests/${encodeURIComponent(forRequest)}`).catch(() => null);
    if (request?.canAnswer) {
      return { startType: offeringTypeFor[request.kind], request, prefill: { ...offeringPrefillFromRequest(request), forRequest: request.id } };
    }
  }
  return { startType: type.success ? type.data : null, request: null, prefill: null };
};

const AREA_STEP = 3;

export const actions: Actions = {
  next: async ({ request }) => {
    const values = formValues(await request.formData());
    const step = Number(values._step ?? 1);

    if (step === 1 && !OfferingType.safeParse(values.type).success) {
      return fail(400, { step, values, fields: { type: 'Please choose what kind of offering this is.' } });
    }
    if (step >= 2) {
      const checked = CreateOffering.safeParse(offeringBody(values));
      if (!checked.success) {
        const fields = fieldErrors(checked.error);
        // Places are asked on step 3; everything else on step 2.
        const isPlace = (name: string) => name === 'area' || name === 'meetingPlace';
        const relevant = Object.fromEntries(Object.entries(fields).filter(([name]) => (step === AREA_STEP) === isPlace(name)));
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
    const created = await api.post<{ id: string; linked?: boolean }>('/api/v1/offerings', offeringBody(values));

    // Photos are added one by one; a problem with one photo doesn't undo the offering.
    const problems: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      const file = form.get(`photo_${index}`);
      if (!(file instanceof File) || file.size === 0) continue;
      const upload = new FormData();
      upload.set('file', file);
      upload.set('alt', String(form.get(`alt_${index}`) ?? ''));
      const response = await api.raw(`/api/v1/offerings/${created.id}/photos`, { method: 'POST', body: upload });
      if (!response.ok) problems.push(`Photo ${index + 1}: ${(await toApiError(response)).message}`);
    }
    const query = new URLSearchParams({ created: '1' });
    if (created.linked === false) query.set('notLinked', '1');
    if (problems.length) query.set('photoProblems', problems.join(' '));
    redirect(303, `/offerings/${created.id}?${query}`);
  })
};
