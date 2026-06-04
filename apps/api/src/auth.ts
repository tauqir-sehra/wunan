// Sign-in, sessions, and password resets, handled by Better Auth (constitution III: no hand-rolled
// authentication). Every client uses bearer tokens: `Authorization: Bearer <session token>`.
//
// Decisions worth knowing (research §6):
// - Public sign-up is off. Accounts are created only by accepting an invitation
//   (modules/invitations.ts), which also handles the email-confirmation link itself, so an account
//   can never become active without its invitation being marked used. Better Auth's own
//   verify-email and self-service profile routes are therefore disabled.
// - Unconfirmed members cannot sign in (`requireEmailVerification`).
// - Errors are rewritten into wunan's error shape with plain words (see `rewriteAuthError`).
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { config } from './config.ts';
import { db } from './db/index.ts';
import * as schema from './db/schema/index.ts';
import { ApiError, type ErrorBody } from './lib/errors.ts';
import { log } from './lib/log.ts';
import { sendEmail } from './notify/email.ts';

const DAY = 60 * 60 * 24;
const isTest = config.NODE_ENV === 'test';

export const auth = betterAuth({
  baseURL: config.SITE_URL,
  basePath: '/api/auth',
  secret: config.BETTER_AUTH_SECRET,
  trustedOrigins: [config.SITE_URL],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      member: schema.member,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit
    }
  }),
  user: {
    modelName: 'member',
    fields: { name: 'displayName' },
    // `input: false`: none of these can be set through Better Auth's endpoints.
    additionalFields: {
      bio: { type: 'string', required: false, input: false },
      invitedById: { type: 'string', required: false, input: false },
      isFounder: { type: 'boolean', required: false, defaultValue: false, input: false },
      sharePhone: { type: 'string', required: false, input: false, returned: false },
      shareEmail: { type: 'string', required: false, input: false, returned: false },
      deletedAt: { type: 'date', required: false, input: false }
    }
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      await sendEmail({
        to: user.email,
        subject: 'Reset your wunan password',
        text:
          `Someone (hopefully you) asked to reset the password for your wunan account.\n\n` +
          `To choose a new password, open this link within the next hour:\n` +
          `${config.SITE_URL}/password-reset/${token}\n\n` +
          `If you didn't ask for this, you can ignore this email. Your password stays the same.`
      });
    }
  },
  session: {
    expiresIn: 30 * DAY,
    updateAge: DAY
  },
  // Routes wunan replaces with its own endpoints, or does not offer.
  disabledPaths: [
    '/sign-up/email',
    '/verify-email',
    '/send-verification-email',
    '/update-user',
    '/change-email',
    '/delete-user',
    '/change-password',
    '/list-accounts',
    '/unlink-account'
  ],
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: isTest ? 1000 : 100,
    customRules: {
      '/sign-in/email': { window: 10 * 60, max: 10 },
      '/request-password-reset': { window: 60 * 60, max: 5 },
      '/reset-password': { window: 60 * 60, max: 10 }
    }
  },
  advanced: {
    // Per-visitor limits behind Caddy and the web app (research §14, "Visitor address").
    ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    database: { generateId: 'uuid' },
    // Bearer tokens only: no auth cookies are ever relied on by clients.
    useSecureCookies: config.SITE_URL.startsWith('https://')
  },
  databaseHooks: {
    session: {
      create: {
        // Belt and braces: a deleted member can never get a new session.
        before: async (session) => {
          const [owner] = await db
            .select({ deletedAt: schema.member.deletedAt })
            .from(schema.member)
            .where(eq(schema.member.id, session.userId));
          if (!owner || owner.deletedAt) return false;
          return { data: session };
        }
      }
    }
  },
  plugins: [bearer()]
});

export type AuthMember = typeof auth.$Infer.Session.user;

/** Plain-language messages for the Better Auth errors members can actually run into. */
const AUTH_ERRORS: Record<string, [number, string, string]> = {
  INVALID_EMAIL_OR_PASSWORD: [
    401,
    'invalid_sign_in',
    "That email and password don't match. Please check them and try again."
  ],
  EMAIL_NOT_VERIFIED: [403, 'email_not_confirmed', 'Please open the confirmation link we emailed you.'],
  PASSWORD_TOO_SHORT: [400, 'password_too_short', 'Please choose a password of at least 10 characters.'],
  PASSWORD_TOO_LONG: [400, 'password_too_long', 'Please choose a password of at most 128 characters.'],
  INVALID_TOKEN: [400, 'link_not_valid', 'This link has expired or was already used. Please ask for a new one.'],
  TOKEN_EXPIRED: [400, 'link_not_valid', 'This link has expired or was already used. Please ask for a new one.'],
  INVALID_EMAIL: [400, 'validation_failed', 'Please enter a valid email address.']
};

/**
 * Rewrites a Better Auth error response into `{ error: { code, message } }` so every endpoint
 * fails the same way (contracts/api.md). Successful responses pass through untouched.
 */
export async function rewriteAuthError(response: Response): Promise<Response> {
  if (response.ok || response.status < 400) return response;
  let code = '';
  try {
    const body = (await response.clone().json()) as { code?: string };
    code = body.code ?? '';
  } catch {
    // Not JSON (e.g., a disabled route); handled by status below.
  }
  const known = AUTH_ERRORS[code];
  let error: ApiError;
  if (known) error = new ApiError(known[0] as 400, known[1], known[2]);
  else if (response.status === 429) error = new ApiError(429, 'slow_down', "You're doing that a lot. Please wait a few minutes and try again.");
  else if (response.status === 404) error = new ApiError(404, 'not_found', 'That page could not be found.');
  else if (response.status === 401) error = new ApiError(401, 'not_signed_in', 'Please sign in to continue.');
  else {
    // Unmapped Better Auth errors are logged by code (never with request details) so they can be
    // given a plain-language message here.
    log.warn('auth_error_unmapped', { code: code || 'none', status: response.status });
    error = new ApiError(400, 'request_failed', 'That did not work. Please check the details and try again.');
  }

  const headers = new Headers(response.headers);
  headers.set('content-type', 'application/json');
  headers.delete('content-length');
  const body: ErrorBody = error.toBody();
  return new Response(JSON.stringify(body), { status: error.status, headers });
}
