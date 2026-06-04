// The session cookie: holds the API's bearer token, readable only by the web server.
import type { Cookies } from '@sveltejs/kit';

export const SESSION_COOKIE = 'wunan_session';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function setSessionCookie(cookies: Cookies, token: string) {
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: THIRTY_DAYS
  });
}

export function clearSessionCookie(cookies: Cookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** Only allow redirects to paths on this site, never to other sites. */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
