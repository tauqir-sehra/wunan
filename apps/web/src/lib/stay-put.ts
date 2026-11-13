// Forms that update the page in place, so nothing jumps (constitution V, "things on screen stay
// put"): the page's data refreshes, the scroll position stays, and `onSuccess` can close the pop-up
// the form was in. Without JavaScript the forms still post normally; their actions end in the
// section's `#anchor` so the reloaded page comes back to where the member was.
import type { SubmitFunction } from '$app/forms';

/**
 * `reset: false` keeps what the form shows (for settings forms, whose saved values are what's
 * shown). `refreshAll: true` also refreshes the page's data after a problem, for when the problem
 * is that something changed meanwhile.
 */
export function stayPut(
  onSuccess?: () => void,
  { reset = true, refreshAll }: { reset?: boolean; refreshAll?: boolean } = {}
): SubmitFunction {
  return () =>
    async ({ result, update }) => {
      // `navigate: false`: the result applies to this page as it is, so an address like
      // `?detail=when` isn't dropped by a navigation that would also scroll to the top.
      await update({ reset, navigate: false, ...(refreshAll ? { refreshAll } : {}) });
      if (result.type === 'success') onSuccess?.();
    };
}

/**
 * For a confirmation that opens under the button that was pressed ("Yes, withdraw it"): if part of
 * it would be below the bottom of the window, the page scrolls just far enough to show it, and
 * not at all when it already fits. Use as `use:reveal`.
 */
export function reveal(node: HTMLElement) {
  node.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
