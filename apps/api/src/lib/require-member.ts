// Middleware for member-only endpoints: resolves the bearer token to a signed-in, non-deleted
// member and makes it available as `c.get('member')`. Anything else gets a plain 401.
import { createMiddleware } from 'hono/factory';
import { auth, type AuthMember } from '../auth.ts';
import { errors } from './errors.ts';

export type AppEnv = { Variables: { member: AuthMember; sessionToken: string } };

export const requireMember = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session || session.user.deletedAt) throw errors.notSignedIn();
  c.set('member', session.user);
  c.set('sessionToken', session.session.token);
  await next();
});
