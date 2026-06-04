// Wraps every form action so that problems are handled the same, calm way everywhere:
// - API validation errors come back as `{ error, fields, values }` for the form to show.
// - If the member's sign-in ran out (API answers 401), nothing they typed is lost: the page shows a
//   sign-in step inside the same form, and one submit signs them in and then runs the original
//   action with their input (constitution V; research §6). Chosen files can't be kept this way, so
//   the member is asked to choose them again.
import { fail, type RequestEvent } from '@sveltejs/kit';
import { ApiError, apiFor, type Api } from './api.ts';
import { signInWithPassword } from './sign-in.ts';

export type Reauth = {
  /** The original action URL (path plus `?/name`). */
  action: string;
  /** The member's input, kept as hidden fields. */
  fields: [string, string][];
  hadFiles: boolean;
  email?: string;
  error?: string;
};

export type FormProblem = {
  error?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
  reauth?: Reauth;
};

type Handler<T> = (context: { event: RequestEvent; form: FormData; api: Api }) => Promise<T>;

const REAUTH_EMAIL = '_reauth_email';
const REAUTH_PASSWORD = '_reauth_password';

export function formAction<T>(handler: Handler<T>) {
  return async (event: RequestEvent) => {
    const form = await event.request.formData();

    const reauthEmail = form.get(REAUTH_EMAIL);
    if (typeof reauthEmail === 'string') {
      const password = String(form.get(REAUTH_PASSWORD) ?? '');
      form.delete(REAUTH_EMAIL);
      form.delete(REAUTH_PASSWORD);
      try {
        await signInWithPassword(event, reauthEmail, password);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        event.locals.reauthPending = true;
        return fail(error.status, { reauth: keepForReauth(event, form, reauthEmail, error.message) });
      }
    }

    try {
      return await handler({ event, form, api: apiFor(event) });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 401) {
        event.locals.reauthPending = true;
        return fail(401, { reauth: keepForReauth(event, form) });
      }
      return fail(error.status, { error: error.message, fields: error.fields, values: textValues(form) });
    }
  };
}

/** The text a member typed, to refill the form after an error. Passwords are never echoed back. */
export function textValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of form) {
    if (typeof value === 'string' && !/password/i.test(name)) values[name] = value;
  }
  return values;
}

function keepForReauth(event: RequestEvent, form: FormData, email?: string, error?: string): Reauth {
  const fields: [string, string][] = [];
  let hadFiles = false;
  for (const [name, value] of form) {
    // Passwords are never written back into the page; the member types them again.
    if (typeof value === 'string' && !/password/i.test(name)) fields.push([name, value]);
    else if (typeof value !== 'string' && value.size > 0) hadFiles = true;
  }
  return {
    action: `${event.url.pathname}${event.url.search}`,
    fields,
    hadFiles,
    ...(email ? { email } : {}),
    ...(error ? { error } : {})
  };
}

/** Reads a text field, trimmed; empty becomes undefined. */
export function text(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
