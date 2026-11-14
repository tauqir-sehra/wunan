// Home (007): signed-in members land here and see what needs them, from `GET /me/home`. `?all=`
// (group ids, comma-separated) shows every line of those groups rather than the first 5. Signed-out
// visitors go where they went before Home existed.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { memberLoad } from '#lib/load.ts';
import type { Home } from '@wunan/shared';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  if (!event.locals.member) redirect(307, `/offerings${event.url.search}`);
  const all = (event.url.searchParams.get('all') ?? '').split(',').filter(Boolean);
  return { home: await apiFor(event).get<Home>('/api/v1/me/home'), all };
});
