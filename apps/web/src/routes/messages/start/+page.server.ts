// Start (or continue) a conversation with a member, optionally about a listing, by writing the
// first message. Reuses the existing conversation for the same member and listing.
import { error, redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { memberLoad } from '#lib/load.ts';
import type { Listing, MemberProfile } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const memberId = event.url.searchParams.get('member');
  const listingId = event.url.searchParams.get('listing');
  if (!memberId) error(404, 'Not found');
  const api = apiFor(event);
  try {
    const [other, listing] = await Promise.all([
      api.get<MemberProfile>(`/api/v1/members/${encodeURIComponent(memberId)}`),
      listingId ? api.get<Listing>(`/api/v1/listings/${encodeURIComponent(listingId)}`) : Promise.resolve(null)
    ]);
    return { other, listing };
  } catch {
    error(404, 'That member or listing could not be found.');
  }
});

export const actions: Actions = {
  default: formAction(async ({ form, api }) => {
    const listingId = text(form, 'listingId');
    const { id } = await api.post<{ id: string }>('/api/v1/conversations', {
      memberId: String(form.get('memberId') ?? ''),
      ...(listingId ? { listingId } : {})
    });
    await api.post(`/api/v1/conversations/${id}/messages`, { body: String(form.get('body') ?? '') });
    redirect(303, `/messages/${id}`);
  })
};
