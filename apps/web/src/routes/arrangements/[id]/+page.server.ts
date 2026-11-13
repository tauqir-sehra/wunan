// One arrangement (004 US2), from asking to the end, at one address: its stage, timeline, details,
// what this member can do next, and its messages. Every action updates the page in place; nothing
// here sends the member to another page (FR-016). A helper from a request for help reads it, with
// the messages only if they were shared with them (FR-021a).
// The requester adds or changes one detail at a time here (006): `?detail=when` opens that field in
// its row, and the `detail` action saves only that detail.
import { fail } from '@sveltejs/kit';
import { apiFor, ApiError } from '#lib/api.ts';
import { detailBody, isDetailKey, pressableDetails } from '#lib/arrangement-form.ts';
import { loadThread, threadActions } from '#lib/arrangement-thread.ts';
import { formAction, text } from '#lib/form-action.ts';
import { formValues } from '#lib/offering-form.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { Arrangement, Offering } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

const path = (id: string | undefined) => `/api/v1/arrangements/${encodeURIComponent(id ?? '')}`;

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const arrangement = await loadOr404(() => api.get<Arrangement>(path(event.params.id)));
  const thread = arrangement.conversationId
    ? await loadThread(api, arrangement.conversationId, {
        markRead: arrangement.myRole !== 'helper'
      })
    : null;
  // The offering's choices are needed only while one of the details is open.
  const detail = event.url.searchParams.get('detail');
  const offering =
    isDetailKey(detail) && pressableDetails(arrangement).includes(detail)
      ? await api.get<Offering>(`/api/v1/offerings/${arrangement.offering.id}`)
      : null;
  return { arrangement, thread, offering };
});

export const actions: Actions = {
  // One detail, saved on its own; a problem comes back with what was typed and the offering, so the
  // field opens again in its row, also without JavaScript.
  detail: formAction(async ({ event, form, api }) => {
    const arrangement = await api.get<Arrangement>(path(event.params.id));
    const detail = form.get('detail');
    if (!isDetailKey(detail) || arrangement.myRole !== 'requester')
      return fail(403, { error: 'Only the person who asked can change this, while it is open.' });
    // If it ended meanwhile, the API says so; the answer keeps what was typed (006 edge cases).
    const values = formValues(form);
    try {
      await api.patch(path(event.params.id), detailBody(detail, values, arrangement.offering.type));
      return { done: 'detail' };
    } catch (problem) {
      if (!(problem instanceof ApiError) || problem.status === 401) throw problem;
      const offering = await api.get<Offering>(`/api/v1/offerings/${arrangement.offering.id}`);
      return fail(problem.status, {
        error: problem.message,
        fields: problem.fields,
        values: { ...values, detail },
        offering
      });
    }
  }),
  accept: formAction(async ({ event, form, api }) => {
    try {
      await api.post(`${path(event.params.id)}/accept`, { version: Number(form.get('version')) });
      return { done: 'accepted' };
    } catch (problem) {
      // The details changed while the lister was reading: show the new ones and ask again.
      if (problem instanceof ApiError && problem.code === 'arrangement_changed')
        return { changed: problem.message };
      throw problem;
    }
  }),
  // Declining and withdrawing ask first; the second press (with `confirmed`) does it.
  decline: formAction(async ({ event, form, api }) => {
    if (form.get('confirmed') !== 'yes') return { confirm: 'decline' };
    await api.post(`${path(event.params.id)}/decline`, { note: text(form, 'note') ?? null });
    return { done: 'declined' };
  }),
  withdraw: formAction(async ({ event, form, api }) => {
    if (form.get('confirmed') !== 'yes') return { confirm: 'withdraw' };
    await api.post(`${path(event.params.id)}/withdraw`, { note: text(form, 'note') ?? null });
    return { done: 'withdrawn' };
  }),
  returned: formAction(async ({ event, api }) => {
    await api.post(`${path(event.params.id)}/returned`);
    return { done: 'returned' };
  }),
  done: formAction(async ({ event, api }) => {
    await api.post(`${path(event.params.id)}/done`);
    return { done: 'marked_done' };
  }),
  notDone: formAction(async ({ event, api }) => {
    await api.post(`${path(event.params.id)}/not-done`);
    return { done: 'not_done' };
  }),
  ...threadActions(
    async (api, event) => (await api.get<Arrangement>(path(event.params.id))).conversationId ?? ''
  )
};
