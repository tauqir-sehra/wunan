// "Show more" under Finished: the next 20 as JSON, added under the ones already shown.
import { error, json } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { listQuery } from '#lib/arrangement-list.ts';
import type { ArrangementList } from '@wunan/shared';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  if (!event.locals.member) error(401, 'Please sign in to continue.');
  const page = await apiFor(event).get<ArrangementList>(
    `/api/v1/arrangements${listQuery(event.url)}`
  );
  return json({ finished: page.finished, finishedNext: page.finishedNext });
};
