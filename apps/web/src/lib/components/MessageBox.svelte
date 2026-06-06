<!--
  The box for writing a message, the same everywhere: a label, the text box, a line saying who can
  read it with the characters left, and the send button at the right. Sending keeps the page where
  it is and empties the box (constitution V); without JavaScript the form's address ends in the
  thread's anchor, so the reloaded page comes back to it. The page shows "sent" through `status`.
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
    extra
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
    /** More buttons on their own row below, such as "Share contact". */
    extra?: Snippet;
  } = $props();

  let text = $state(untrack(() => value));
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
      if (result.type === 'success') text = '';
    }}
>
  <Label for={id} class="text-sm">{label}</Label>
  {#if error}<p id="{id}-error" class="text-sm font-medium text-destructive">{error}</p>{/if}
  <textarea
    {id}
    name="body"
    rows="2"
    class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-base aria-invalid:border-2 aria-invalid:border-destructive"
    aria-describedby="{id}-hint {id}-count{error ? ` ${id}-error` : ''}"
    aria-invalid={error ? 'true' : undefined}
    bind:value={text}></textarea>
  <div class="flex items-start gap-3">
    <p id="{id}-hint" class="min-w-0 flex-1 text-xs text-muted-foreground">{hint}</p>
    <span
      id="{id}-count"
      class="pt-0.5 text-xs whitespace-nowrap {left < 0
        ? 'font-medium text-destructive'
        : 'text-muted-foreground'}"
    >
      {#if scripted}{left >= 0
          ? `${left} characters left`
          : `${-left} characters too many`}{:else}Up to {maxlength} characters{/if}
    </span>
    <Button type="submit" variant={buttonVariant} size="sm" class="shrink-0">{buttonLabel}</Button>
  </div>
  <div role="status" class="text-sm text-muted-foreground">{status ?? ''}</div>
  {#if problem}<p class="text-sm font-medium text-destructive">{problem}</p>{/if}
  <div class="sr-only" aria-live="polite">{countAnnouncement}</div>
</form>
{#if extra}<div class="flex max-w-xl flex-wrap gap-2">{@render extra()}</div>{/if}
