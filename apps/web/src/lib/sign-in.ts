// Signing in through the API, shared by the sign-in page and the "sign in again" step of forms.
import type { RequestEvent } from '@sveltejs/kit';
import { apiFor, ApiError, toApiError } from './api.ts';
import { setSessionCookie } from './session.ts';

type SessionResponse = { user: { id: string; name: string; isFounder?: boolean } } | null;

/**
 * Asks the API who owns the current token and records it in `locals` (null if nobody).
 * Only a clear "no session" signs the visitor out; other problems (the API busy or down) are
 * raised as errors, so a member is never signed out by a hiccup.
 */
export async function loadMember(event: Pick<RequestEvent, 'locals' | 'getClientAddress'>) {
  const response = await apiFor(event).raw('/api/auth/get-session');
  if (!response.ok && response.status !== 401) throw await toApiError(response);
  const session = response.ok ? ((await response.json()) as SessionResponse) : null;
  event.locals.member = session?.user
    ? { id: session.user.id, displayName: session.user.name, isFounder: session.user.isFounder ?? false }
    : null;
  return event.locals.member;
}

/** Signs in, stores the session cookie, and updates `locals`. Throws ApiError on failure. */
export async function signInWithPassword(event: RequestEvent, email: string, password: string) {
  const api = apiFor({ ...event, locals: { ...event.locals, token: undefined } });
  const response = await api.raw('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) throw await toApiError(response);
  const token = response.headers.get('set-auth-token');
  if (!token) throw new ApiError(500, 'unexpected', 'Sorry, signing in did not work. Please try again.');
  setSessionCookie(event.cookies, token);
  event.locals.token = token;
  await loadMember(event);
}
