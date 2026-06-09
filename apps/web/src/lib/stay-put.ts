// Forms that update the page in place, so nothing jumps (constitution V, "things on screen stay
// put"): the page's data refreshes, the scroll position stays, and `onSuccess` can close the pop-up
// the form was in. Without JavaScript the forms still post normally; their actions end in the
// section's `#anchor` so the reloaded page comes back to where the member was.
import type { SubmitFunction } from '$app/forms';

/** `reset: false` keeps what the form shows (for settings forms, whose saved values are what's shown). */
export function stayPut(
  onSuccess?: () => void,
  { reset = true }: { reset?: boolean } = {}
): SubmitFunction {
  return () =>
    async ({ result, update }) => {
      await update({ reset });
      if (result.type === 'success') onSuccess?.();
    };
}
