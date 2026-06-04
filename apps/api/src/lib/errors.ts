// One error shape for every endpoint: { error: { code, message, fields? } }.
// `message` is a plain-language sentence that clients can show to people as-is (constitution II).
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import { log } from './log.ts';

export type ErrorBody = {
  error: { code: string; message: string; fields?: Record<string, string> };
};

export class ApiError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;
  readonly fields: Record<string, string> | undefined;

  constructor(
    status: ContentfulStatusCode,
    code: string,
    message: string,
    fields?: Record<string, string>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  toBody(): ErrorBody {
    return {
      error: { code: this.code, message: this.message, ...(this.fields ? { fields: this.fields } : {}) }
    };
  }
}

/** Common errors, written once so every client shows the same words. */
export const errors = {
  notSignedIn: () => new ApiError(401, 'not_signed_in', 'Please sign in to continue.'),
  notFound: (what = 'That page') =>
    new ApiError(404, 'not_found', `${what} could not be found. It may have been removed.`),
  forbidden: () => new ApiError(403, 'not_allowed', "You can't do that here."),
  slowDown: () =>
    new ApiError(429, 'slow_down', "You're doing that a lot. Please wait a few minutes and try again.")
};

/**
 * Turns Zod issues into `{ fieldName: "Plain message." }`. Schemas in packages/shared set
 * friendly messages; this fallback covers anything they missed.
 */
export function fieldsFromZod(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    // Fields sent that don't belong (e.g., a loan length on a Gift) are named one by one.
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) fields[key] ??= "This doesn't apply here.";
      continue;
    }
    const name = issue.path.join('.') || 'form';
    if (fields[name]) continue;
    fields[name] = issue.message && !issue.message.startsWith('Invalid')
      ? issue.message
      : 'Please check this.';
  }
  return fields;
}

export function validationError(error: z.ZodError) {
  return new ApiError(400, 'validation_failed', 'Some details need fixing.', fieldsFromZod(error));
}

/** Hono error handler: known errors keep their message; anything else becomes a calm apology. */
export function handleError(err: Error, c: Context) {
  if (err instanceof ApiError) return c.json(err.toBody(), err.status);
  // Hono raises errors with a status for malformed requests (e.g., body too large).
  const status = (err as { status?: number }).status;
  if (status === 413) {
    return c.json(new ApiError(413, 'too_large', 'That file is too large.').toBody(), 413);
  }
  if (status === 400) {
    return c.json(new ApiError(400, 'bad_request', 'Something in that request was not readable.').toBody(), 400);
  }
  log.error('unhandled_error', { path: c.req.routePath, error: err.name, detail: err.message });
  return c.json(
    new ApiError(500, 'server_error', 'Sorry, something went wrong on our side. Please try again.').toBody(),
    500
  );
}
