// "Show more" on Find: the next page of results as JSON, added under the ones already shown, so
// the member stays where they are. Same filters as the page, same API call.
import { error, json } from '@sveltejs/kit';
import { searchPage } from '#lib/search.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  if (!event.locals.member) error(401, 'Please sign in to continue.');
  const page = await searchPage(event, event.url);
  return json({ offerings: page.offerings, nextQuery: page.nextQuery });
};
