// Members-only by default: signed-out visitors go to sign-in, except on the public pages.
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const PUBLIC_PATHS = ['/sign-in', '/password-reset', '/join'];

export const load: LayoutServerLoad = ({ locals, url }) => {
  const isPublic = PUBLIC_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
  // While a form waits for the member to sign in again, stay on the page (see form-action.ts).
  if (!locals.member && !isPublic && !locals.reauthPending) {
    redirect(303, `/sign-in?redirectTo=${encodeURIComponent(url.pathname)}`);
  }
  return { member: locals.member };
};
