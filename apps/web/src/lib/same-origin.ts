// SvelteKit checks the origin of form posts; these JSON endpoints check it themselves, so another
// site can never add or remove a member's devices.
import { error, type RequestEvent } from '@sveltejs/kit';

export function sameOrigin(event: RequestEvent) {
  if (event.request.headers.get('origin') !== event.url.origin) error(403, "You can't do that here.");
}
