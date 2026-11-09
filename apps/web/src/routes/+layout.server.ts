// Members-only by default: signed-out visitors go to sign-in, except on the public pages.
// For signed-in members, also loads the quiet counts shown in the navigation and on home, and
// the light/dark choice the menu shows.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { themeFrom } from '#lib/theme.ts';
import type { Summary } from '@wunan/shared';
import type { LayoutServerLoad } from './$types';

const PUBLIC_PATHS = ['/sign-in', '/password-reset', '/join', '/goodbye'];

export const load: LayoutServerLoad = async (event) => {
  const { locals, url } = event;
  const isPublic = PUBLIC_PATHS.some(
    (path) => url.pathname === path || url.pathname.startsWith(`${path}/`)
  );
  // While a form waits for the member to sign in again, stay on the page (see form-action.ts).
  if (!locals.member && !isPublic && !locals.reauthPending) {
    redirect(303, `/sign-in?redirectTo=${encodeURIComponent(url.pathname)}`);
  }
  // Counts are a nicety: if they can't be loaded, the page still works without them.
  const summary =
    locals.member && !locals.reauthPending
      ? await apiFor(event)
          .get<Summary>('/api/v1/me/summary')
          .catch(() => null)
      : null;
  return { member: locals.member, summary, theme: themeFrom(event.cookies) };
};
