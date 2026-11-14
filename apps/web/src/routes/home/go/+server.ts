// Pressing an offers or "asked to change" line on Home (007 FR-006a, research §5): records the press,
// so the line goes until something new comes, then takes the member to where they act on it.
// A plain link to a `GET` endpoint works without JavaScript, and because this isn't a page SvelteKit
// never loads it early on hover (which would mark lines pressed that weren't). The press is only
// recorded when the visit comes from wunan itself; a link from another site just redirects.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import type { HomePressed } from '@wunan/shared';
import type { RequestHandler } from './$types';

/** Whether this visit was started from a wunan page (or typed in), not from another site. */
function fromWunan(request: Request, origin: string) {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  const referer = request.headers.get('referer');
  return referer !== null && new URL(referer).origin === origin;
}

export const GET: RequestHandler = async (event) => {
  const { url, locals, request } = event;
  if (!locals.member)
    redirect(303, `/sign-in?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);

  const kind = url.searchParams.get('kind');
  const id = url.searchParams.get('id') ?? '';
  const subject = url.searchParams.get('subject');
  let pressed: HomePressed;
  let target: string;
  if (kind === 'offers') {
    pressed = { kind, requestId: id };
    target = `/requests/${encodeURIComponent(id)}`;
  } else if (kind === 'askedToChange' && (subject === 'offering' || subject === 'request')) {
    pressed = { kind, subject, id };
    target = `/${subject}s/${encodeURIComponent(id)}`;
  } else {
    redirect(303, '/');
  }

  if (fromWunan(request, url.origin)) {
    // If this fails, the line simply stays on Home; the member still gets where they were going.
    await apiFor(event)
      .post('/api/v1/me/home/pressed', pressed)
      .catch(() => undefined);
  }
  redirect(303, target);
};
