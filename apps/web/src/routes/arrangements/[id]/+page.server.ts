// One arrangement (004 US2), from asking to the end, at one address: its stage, timeline, details,
// what this member can do next, and its messages. Every action updates the page in place; nothing
// here sends the member to another page (FR-016). A helper from a request for help reads it, with
// the messages only if they were shared with them (FR-021a).
import { apiFor, ApiError } from '#lib/api.ts';
import { loadThread, threadActions } from '#lib/arrangement-thread.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { Arrangement } from '@wunan/shared';
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
  return { arrangement, thread };
});

export const actions: Actions = {
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
