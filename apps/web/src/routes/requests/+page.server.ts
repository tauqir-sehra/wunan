// Requests: what members are asking for (003 FR-020 to FR-022), and "My requests". The filters are
// a plain GET form, so results can be bookmarked and it works without JavaScript.
import { memberLoad } from '#lib/load.ts';
import { requestPage } from '#lib/request-search.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => requestPage(event, event.url));
