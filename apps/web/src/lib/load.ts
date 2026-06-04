// Helpers for page `load` functions, so pages stay short.
import { error, type ServerLoadEvent } from '@sveltejs/kit';
import { ApiError } from './api.ts';

/**
 * Wraps a members-only page load. While a form is waiting for the member to sign in again
 * (form-action.ts), the layout shows the sign-in step instead of the page, so the page's data is
 * not needed and must not be fetched (the API would answer "not signed in").
 */
export function memberLoad<E extends ServerLoadEvent, T>(load: (event: E) => Promise<T>) {
  return async (event: E): Promise<T> => {
    if (event.locals.reauthPending) return {} as T;
    return load(event);
  };
}

/** Turns the API's "not found" into SvelteKit's not-found page. */
export async function loadOr404<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (problem) {
    if (problem instanceof ApiError && (problem.status === 404 || problem.status === 400)) {
      error(404, problem.message);
    }
    throw problem;
  }
}
