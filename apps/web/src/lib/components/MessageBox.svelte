<!--
  The box for writing a message, the same everywhere: a label, the text box (with the characters
  left in its corner), a line saying who can read it, and the send button at the right. Sending
  keeps the page where it is and empties the box (constitution V); without JavaScript the form's
  address ends in the thread's anchor, so the reloaded page comes back to it. The page shows
  "sent" through `status`. Private threads add things to the message: `attached` shows them (as
  pills) in the top part of the text box, and `attach` (the "+") sits by the Send button; both are
  inside the form, so they're sent with it.
-->
<script lang="ts">
  import { enhance } from '$app/forms';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { onMount, untrack, type Snippet } from 'svelte';

  let {
    id,
    label,
    action,
    hint,
    maxlength,
    buttonLabel,
    buttonVariant = 'outline',
    value = '',
    error,
    problem,
    status,
    attach,
    attached,
    onSent
  }: {
    id: string;
    label: string;
    /** The form action, ending in the thread's anchor, e.g. "?/post#public-messages". */
    action: string;
    /** Who can read it. */
    hint: string;
    maxlength: number;
    buttonLabel: string;
    buttonVariant?: 'default' | 'outline';
    /** What the member had typed, when the server sent it back with a problem. */
    value?: string;
    /** A problem with the text itself. */
    error?: string;
    /** Any other problem with sending, shown under the box. */
    problem?: string;
    /** For example "Your message is posted." */
    status?: string;
    /** The "+" button for adding things to the message, beside Send. */
    attach?: Snippet;
    /** What has been added, shown in the top part of the text box. */
    attached?: Snippet;
    /** Called once a message has been sent, to clear what was added. */
    onSent?: () => void;
  } = $props();

  let text = $state(untrack(() => value));
  // The box grows with the text instead of having a resize handle. Browsers without
  // field-sizing get the same from a height set here.
  let box: HTMLTextAreaElement | undefined = $state();
  $effect(() => {
    void text;
    if (!box || CSS.supports('field-sizing', 'content')) return;
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight + 2, 320)}px`;
  });
  let scripted = $state(false);
  onMount(() => (scripted = true));
  const left = $derived(maxlength - text.length);
  // Announced only near the limit, so screen readers aren't told on every key press.
  const countAnnouncement = $derived(
    left === 20
      ? '20 characters left.'
      : left === 0
        ? 'No characters left.'
        : left < 0
          ? `${-left} characters too many.`
          : ''
  );
</script>

<form
  method="POST"
  {action}
  class="grid max-w-xl gap-1.5"
  use:enhance={() =>
    async ({ result, update }) => {
      await update({ reset: false });
      if (result.type === 'success') {
        text = '';
        onSent?.();
      }
    }}
>
  <Label for={id} class="text-sm">{label}</Label>
  {#if error}<p id="{id}-error" class="text-sm font-medium text-destructive">{error}</p>{/if}
  <!-- One box: what's added in its own part at the top, then the text, then the characters left. -->
  <div
    class="overflow-hidden rounded-md border border-input bg-background outline-offset-2 outline-ring has-[textarea:focus-visible]:outline-3 has-[textarea[aria-invalid]]:border-2 has-[textarea[aria-invalid]]:border-destructive"
  >
    {#if attached}{@render attached()}{/if}
    <textarea
      {id}
      name="body"
      rows="2"
      class="block field-sizing-content max-h-80 min-h-16 w-full resize-none bg-transparent px-3 py-2 text-base focus-visible:outline-none"
      bind:this={box}
      aria-describedby="{id}-hint {id}-count{error ? ` ${id}-error` : ''}"
      aria-invalid={error ? 'true' : undefined}
      bind:value={text}></textarea>
    <p
      id="{id}-count"
      class="px-3 pb-1.5 text-right text-xs whitespace-nowrap {left < 0
        ? 'font-medium text-destructive'
        : 'text-muted-foreground'}"
    >
      {#if scripted}{left >= 0
          ? `${left} characters left`
          : `${-left} characters too many`}{:else}Up to {maxlength} characters{/if}
    </p>
  </div>
  <div class="flex items-start gap-3">
    <p id="{id}-hint" class="min-w-0 flex-1 text-xs text-muted-foreground">{hint}</p>
    {#if attach}{@render attach()}{/if}
    <Button type="submit" variant={buttonVariant} size="sm" class="shrink-0">{buttonLabel}</Button>
  </div>
  <div role="status" class="text-sm text-muted-foreground">{status ?? ''}</div>
  {#if problem}<p class="text-sm font-medium text-destructive">{problem}</p>{/if}
  <div class="sr-only" aria-live="polite">{countAnnouncement}</div>
</form>
