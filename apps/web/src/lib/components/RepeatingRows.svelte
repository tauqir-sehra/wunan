<!--
  A short list the member grows one row at a time (what a trade accepts, when a service is offered).
  "Add another" adds a row and moves focus to its first field; "Remove" takes one away and says so
  politely to screen readers. Needs JavaScript (002 research §10); the form says so when it's off.
-->
<script lang="ts" generics="T">
  import { tick, type Snippet } from 'svelte';
  import { Button } from '#lib/components/ui/button/index.ts';

  let {
    rows = $bindable(),
    blank,
    max,
    addLabel = 'Add another',
    itemName,
    row
  }: {
    rows: T[];
    blank: () => T;
    max: number;
    addLabel?: string;
    /** "thing" → "Remove thing 2". */
    itemName: string;
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
  <ol bind:this={list} class="grid gap-3">
    {#each rows as item, index (index)}
      <li class="grid gap-2 rounded-lg border bg-card p-3">
        {@render row(item, index)}
        <div>
          <Button type="button" variant="outline" size="sm" onclick={() => remove(index)}>Remove {itemName} {index + 1}</Button>
        </div>
      </li>
    {/each}
  </ol>
{/if}
<div class="flex flex-wrap items-center gap-3">
  <Button type="button" variant="outline" onclick={add} disabled={rows.length >= max}>{addLabel}</Button>
  {#if rows.length >= max}<span class="text-sm text-muted-foreground">That's the most you can add ({max}).</span>{/if}
</div>
<div class="sr-only" aria-live="polite">{announcement}</div>
