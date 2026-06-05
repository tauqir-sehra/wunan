// The session cookie: holds the API's bearer token, readable only by the web server.
import { dev } from '$app/env';
import type { Cookies } from '@sveltejs/kit';

export const SESSION_COOKIE = 'wunan_session';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/**
 * Always `Secure` in production (wunan is served over HTTPS). In development the site may be
 * opened over plain http from another device on the network (e.g. a phone at
 * http://192.168.1.20:5173), where browsers would silently drop a `Secure` cookie.
 */
function secure(url: URL) {
  return !dev || url.protocol === 'https:';
}

export function setSessionCookie(cookies: Cookies, url: URL, token: string) {
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: secure(url),
    sameSite: 'lax',
    maxAge: THIRTY_DAYS
  });
}

export function clearSessionCookie(cookies: Cookies, url: URL) {
  cookies.delete(SESSION_COOKIE, { path: '/', secure: secure(url) });
}

/** Only allow redirects to paths on this site, never to other sites. */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
