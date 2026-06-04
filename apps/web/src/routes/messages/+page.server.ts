// My conversations, latest first (FR-018). The list updates when the page is reloaded.
import { apiFor } from '#lib/api.ts';
import { memberLoad } from '#lib/load.ts';
import type { ConversationSummary } from '@wunan/shared';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const { items } = await apiFor(event).get<{ items: ConversationSummary[] }>('/api/v1/conversations');
  return { conversations: items };
});
