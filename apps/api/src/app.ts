// The wunan API as a Hono app: shared middleware, authentication routes, the health check, the
// generated OpenAPI document, and every /api/v1 route. `index.ts` starts it; tests call it directly.
import { bodyLimit } from 'hono/body-limit';
import { createRouter } from './app-router.ts';
import { auth, rewriteAuthError } from './auth.ts';
import { sql } from './db/index.ts';
import { ApiError, handleError } from './lib/errors.ts';
import { log } from './lib/log.ts';
import { agreementRoutes } from './routes/agreements.ts';
import { conversationRoutes } from './routes/conversations.ts';
import { invitationRoutes } from './routes/invitations.ts';
import { listingRoutes } from './routes/listings.ts';
import { photoRoutes } from './routes/photos.ts';
import { memberRoutes } from './routes/members.ts';
import { meRoutes } from './routes/me.ts';

const MB = 1024 * 1024;

export const app = createRouter();

app.onError(handleError);
app.notFound((c) => c.json(new ApiError(404, 'not_found', 'That page could not be found.').toBody(), 404));

// Request log: method, route pattern (never the raw path, which can contain tokens), status, time.
app.use('*', async (c, next) => {
  const started = performance.now();
  await next();
  log.info('request', {
    method: c.req.method,
    route: c.req.routePath,
    status: c.res.status,
    ms: Math.round(performance.now() - started)
  });
});

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Cache-Control', c.res.headers.get('Cache-Control') ?? 'no-store');
});

// JSON bodies up to 1 MB; photo uploads up to 10 MB (plus room for the multipart wrapper).
app.use('/api/*', async (c, next) => {
  const isPhotoUpload = c.req.method === 'POST' && /\/listings\/[^/]+\/photos$/.test(c.req.path);
  return bodyLimit({
    maxSize: isPhotoUpload ? 11 * MB : 1 * MB,
    onError: () => {
      throw new ApiError(413, 'too_large', isPhotoUpload ? 'That photo is larger than 10 MB.' : 'That request is too large.');
    }
  })(c, next);
});

// Better Auth: sign in, sign out, session, password reset. Errors rewritten to wunan's shape.
app.on(['GET', 'POST'], '/api/auth/*', async (c) => rewriteAuthError(await auth.handler(c.req.raw)));

app.get('/api/v1/health', async (c) => {
  await sql`select 1`;
  return c.json({ ok: true });
});

// Versioned API routes (contracts/api.md). Each area lives in its own file under routes/.
app.route('/api/v1', invitationRoutes);
app.route('/api/v1', memberRoutes);
app.route('/api/v1', meRoutes);
app.route('/api/v1', listingRoutes);
app.route('/api/v1', photoRoutes);
app.route('/api/v1', conversationRoutes);
app.route('/api/v1', agreementRoutes);

app.openAPIRegistry.registerComponent('securitySchemes', 'bearer', {
  type: 'http',
  scheme: 'bearer',
  description: 'Session token from POST /api/auth/sign-in/email (the `set-auth-token` header).'
});

app.doc31('/api/v1/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'wunan API',
    version: '1',
    description: 'The wunan backend. Every client (the web app, future native apps) uses this API.'
  }
});
