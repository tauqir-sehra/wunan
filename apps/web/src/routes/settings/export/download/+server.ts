// Streams the member's export ZIP from the API as a download (FR-032; contracts/export-format.md).
import { error } from '@sveltejs/kit';
import { apiFor, toApiError } from '#lib/api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  if (!event.locals.member) error(401, 'Please sign in to continue.');
  const response = await apiFor(event).raw('/api/v1/me/export');
  if (!response.ok) {
    const problem = await toApiError(response);
    error(problem.status, problem.message);
  }
  return new Response(response.body, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': response.headers.get('content-disposition') ?? 'attachment; filename="wunan-export.zip"',
      'cache-control': 'no-store'
    }
  });
};
