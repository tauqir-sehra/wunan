// Types for SvelteKit's request-scoped data, filled in by hooks.server.ts.
declare global {
  namespace App {
    interface Locals {
      /** Session token from the HttpOnly `wunan_session` cookie; never sent to the browser. */
      token: string | undefined;
      /** The signed-in member, or null. */
      member: { id: string; displayName: string; isFounder: boolean } | null;
      /** Set when a form action is waiting for the member to sign in again (see form-action.ts). */
      reauthPending?: boolean;
    }
  }
}

export {};
