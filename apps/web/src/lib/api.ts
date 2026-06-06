// The web app's only way to reach data: a small client for the wunan API. It runs on the web
// server, adds the member's bearer token and the visitor's address, and turns API errors into
// `ApiError`s whose messages are already written for people (constitution II).
import { API_INTERNAL_URL, SITE_URL } from '$app/env/private';
import type { RequestEvent } from '@sveltejs/kit';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  /** Anything else the API sent to help recover, e.g. `proposalId` or `issues`. */
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}, details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

export type Api = ReturnType<typeof apiFor>;

/** Creates an API client for one request, acting as the signed-in member (if any). */
export function apiFor(event: Pick<RequestEvent, 'locals' | 'getClientAddress'>) {
  async function raw(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (event.locals.token) headers.set('authorization', `Bearer ${event.locals.token}`);
    // Lets the API rate-limit per visitor rather than per web server (research §14).
    headers.set('x-forwarded-for', event.getClientAddress());
    // The web server acts for this site; Better Auth's CSRF check expects the site's origin.
    if (SITE_URL) headers.set('origin', SITE_URL);
    return fetch(`${API_INTERNAL_URL}${path}`, { ...init, headers });
  }

  async function request<T>(method: string, path: string, body?: Body): Promise<T> {
    const init: RequestInit = { method };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers = { 'content-type': 'application/json' };
    }
    const response = await raw(path, init);
    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    raw,
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: Body) => request<T>('POST', path, body ?? {}),
    put: <T>(path: string, body?: Body) => request<T>('PUT', path, body ?? {}),
    patch: <T>(path: string, body?: Body) => request<T>('PATCH', path, body ?? {}),
    delete: <T>(path: string, body?: Body) => request<T>('DELETE', path, body)
  };
}

/** Reads the API's `{ error: { code, message, fields } }` body. */
export async function toApiError(response: Response): Promise<ApiError> {
  try {
    const { error } = (await response.json()) as {
      error: { code: string; message: string; fields?: Record<string, string>; [detail: string]: unknown };
    };
    const { code, message, fields, ...details } = error;
    return new ApiError(response.status, code, message, fields, details);
  } catch {
    return new ApiError(
      response.status,
      'unexpected',
      'Sorry, something went wrong on our side. Please try again.'
    );
  }
}
