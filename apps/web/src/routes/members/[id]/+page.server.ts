// A member's profile: who invited them and who they invited (FR-003).
import { apiFor } from '#lib/api.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { MemberProfile } from '@wunan/shared';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => ({
  profile: await loadOr404(() => apiFor(event).get<MemberProfile>(`/api/v1/members/${encodeURIComponent(event.params.id)}`))
}));
