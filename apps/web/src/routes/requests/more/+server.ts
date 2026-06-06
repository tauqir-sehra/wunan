// "Show more" on Requests: the next page as JSON, added under the ones already shown.
import { error, json } from '@sveltejs/kit';
import { requestPage } from '#lib/request-search.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  if (!event.locals.member) error(401, 'Please sign in to continue.');
  const page = await requestPage(event, event.url);
  return json({ requests: page.requests, nextQuery: page.nextQuery });
};
