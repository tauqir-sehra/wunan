// Find, the page members land on: search and filter what's available (FR-015 to FR-017). The
// filters are a plain GET form, so results can be bookmarked and it works without JavaScript.
import { memberLoad } from '#lib/load.ts';
import { searchPage } from '#lib/search.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => searchPage(event, event.url));
