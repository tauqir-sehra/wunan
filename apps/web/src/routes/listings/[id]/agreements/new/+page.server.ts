// Record an agreement on my listing (FR-022, FR-024): choose who, how much, and (for loans) the
// return date; review; confirm. The listing updates automatically.
import { error, fail, redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction, text, textValues } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { AgreementCandidate, Listing } from '@wunan/shared';
import type { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const id = encodeURIComponent(event.params.id);
  const listing = await loadOr404(() => api.get<Listing>(`/api/v1/listings/${id}`));
  if (listing.owner.id !== event.locals.member?.id) error(403, 'Only the person who listed this can record an agreement.');
  const { items } = await api.get<{ items: z.infer<typeof AgreementCandidate>[] }>(`/api/v1/listings/${id}/agreement-candidates`);
  return { listing, candidates: items };
});

function body(form: FormData) {
  return {
    otherMemberId: String(form.get('otherMemberId') ?? ''),
    ...(text(form, 'amount') ? { amount: text(form, 'amount') } : {}),
    ...(text(form, 'returnDue') ? { returnDue: text(form, 'returnDue') } : {}),
    ...(text(form, 'sessions') ? { sessions: text(form, 'sessions') } : {}),
    note: text(form, 'note') ?? null
  };
}

export const actions: Actions = {
  // Step 1: show what will be recorded, before anything changes.
  review: async ({ request }) => {
    const form = await request.formData();
    if (!form.get('otherMemberId')) return fail(400, { values: textValues(form), fields: { otherMemberId: 'Please choose who you agreed with.' } });
    return { review: textValues(form) };
  },
  // Step 2: record it.
  record: formAction(async ({ event, form, api }) => {
    const created = await api.post<{ id: string }>(`/api/v1/listings/${encodeURIComponent(event.params.id ?? '')}/agreements`, body(form));
    redirect(303, `/agreements/${created.id}?recorded=1`);
  })
};
