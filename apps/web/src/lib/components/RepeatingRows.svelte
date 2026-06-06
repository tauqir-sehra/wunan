<!--
  A short list the member grows one row at a time (what a trade accepts, when a service is offered).
  "Add another" adds a row and moves focus to its first field; the X at the right of a row
  ("Remove thing 2" to screen readers) takes it away and says so
  politely to screen readers. Needs JavaScript (002 research §10); the form says so when it's off.
-->
<script lang="ts" generics="T">
  import { tick, type Snippet } from 'svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import XIcon from '@lucide/svelte/icons/x';

  let {
    rows = $bindable(),
    blank,
    max,
    addLabel = 'Add another',
    itemName,
    errorFor,
    row
  }: {
    rows: T[];
    blank: () => T;
    max: number;
    addLabel?: string;
    /** "thing" → "Remove thing 2". */
    itemName: string;
    /** A row's problem from the server, shown under it. */
    errorFor?: (index: number) => string;
    /** The row's fields. Show their labels on the first row only from `sm` up (`index ? 'sm:sr-only' : ''`),
        so the rows read like a small table; narrow screens, where rows wrap, keep them on every row. */
    row: Snippet<[T, number]>;
  } = $props();

  let list: HTMLOListElement | undefined = $state();
  let announcement = $state('');

  async function add() {
    rows.push(blank());
    await tick();
    list?.querySelector<HTMLElement>(`li:last-child input, li:last-child select`)?.focus();
  }

  function remove(index: number) {
    rows.splice(index, 1);
    announcement = `Removed ${itemName} ${index + 1}.`;
  }
</script>

{#if rows.length > 0}
  <ol bind:this={list} class="grid grid-cols-[minmax(0,1fr)] gap-2">
    {#each rows as item, index (index)}
      {@const error = errorFor?.(index)}
      <li class="grid min-w-0 gap-1 border-b pb-3 last:border-0 last:pb-0 sm:border-0 sm:pb-0">
        <div class="flex min-w-0 items-end gap-1">
          <div class="min-w-0 flex-1">{@render row(item, index)}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="shrink-0 text-muted-foreground"
            aria-label="Remove {itemName} {index + 1}"
            title="Remove"
            onclick={() => remove(index)}
          >
            <XIcon class="size-5" aria-hidden="true" />
          </Button>
        </div>
        {#if error}<p class="text-sm font-medium text-destructive">{error}</p>{/if}
      </li>
    {/each}
  </ol>
{/if}
<div class="flex flex-wrap items-center gap-3">
  <Button type="button" variant="outline" size="sm" onclick={add} disabled={rows.length >= max}>
    <PlusIcon class="size-4" aria-hidden="true" />{addLabel}
  </Button>
  {#if rows.length >= max}<span class="text-sm text-muted-foreground"
      >That's the most you can add ({max}).</span
    >{/if}
</div>
<div class="sr-only" aria-live="polite">{announcement}</div>
