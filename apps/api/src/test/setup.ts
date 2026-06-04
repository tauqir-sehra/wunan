// Helpers for API tests: create members, sign in, and call endpoints through `app.request()`
// (no network). Every call carries an `X-Forwarded-For` address so per-IP limits are testable.
import { app } from '../app.ts';
import { createAccount } from '../modules/members.ts';

export const PASSWORD = 'correct horse battery';
let counter = 0;

export type TestMember = { id: string; email: string; displayName: string; password: string };

function nextEmail(name: string) {
  counter += 1;
  return `${name.toLowerCase()}${counter}@example.org`;
}

export async function createFounder(displayName = 'Founder'): Promise<TestMember> {
  const email = nextEmail(displayName);
  const user = await createAccount({ email, displayName, password: PASSWORD, isFounder: true, emailVerified: true });
  return { id: user.id, email, displayName, password: PASSWORD };
}

/** A confirmed member invited by `inviter` (created directly; invitation flow is tested separately). */
export async function createInvitedMember(inviter: TestMember, displayName = 'Alex'): Promise<TestMember> {
  const email = nextEmail(displayName);
  const user = await createAccount({ email, displayName, password: PASSWORD, invitedById: inviter.id, emailVerified: true });
  return { id: user.id, email, displayName, password: PASSWORD };
}

type CallOptions = { token?: string; body?: unknown; ip?: string; headers?: Record<string, string> };

export type ApiResult = { status: number; body: any; headers: Headers }; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function api(method: string, path: string, options: CallOptions = {}): Promise<ApiResult> {
  const headers: Record<string, string> = {
    'x-forwarded-for': options.ip ?? '203.0.113.1',
    ...options.headers
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  let body: FormData | string | undefined;
  if (options.body instanceof FormData) body = options.body;
  else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const response = await app.request(path, { method, headers, body });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON; keep the text.
  }
  return { status: response.status, body: parsed, headers: response.headers };
}

/** Signs in and returns the bearer token. */
export async function signIn(member: { email: string; password: string }, ip?: string): Promise<string> {
  const result = await api('POST', '/api/auth/sign-in/email', {
    body: { email: member.email, password: member.password },
    ...(ip ? { ip } : {})
  });
  const token = result.headers.get('set-auth-token');
  if (result.status !== 200 || !token) {
    throw new Error(`Sign-in failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
  return token;
}
