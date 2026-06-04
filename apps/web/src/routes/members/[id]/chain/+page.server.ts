// The invite chain from a member up to a founding member (FR-004).
import { apiFor } from '#lib/api.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { MemberChain } from '@wunan/shared';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => ({
  chain: (await loadOr404(() => apiFor(event).get<MemberChain>(`/api/v1/members/${encodeURIComponent(event.params.id)}/chain`))).chain
}));
