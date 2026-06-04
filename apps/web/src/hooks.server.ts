// Runs on every request to the web app:
// 1. Reads the session cookie and asks the API who is signed in.
// 2. Adds security headers to every response (constitution III).
import type { Handle } from '@sveltejs/kit/hooks';
import { clearSessionCookie, SESSION_COOKIE } from '#lib/session.ts';
import { loadMember } from '#lib/sign-in.ts';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.token = event.cookies.get(SESSION_COOKIE);
  event.locals.member = null;

  if (event.locals.token && !(await loadMember(event))) {
    // Expired or revoked: forget it so pages treat the visitor as signed out.
    clearSessionCookie(event.cookies);
    event.locals.token = undefined;
  }

  const response = await resolve(event);
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  return response;
};
