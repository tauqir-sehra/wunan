<!--
  One message, the same everywhere: public threads, proposals, and requests for help. A quiet box
  with "You" (not a link) or the writer's name as a link, the time, the text, and any action
  (Remove, Raise an issue) at the right end. Notes that wunan writes have a dashed border.
-->
<script lang="ts">
  import { when } from '#lib/format.ts';
  import type { Snippet } from 'svelte';

  let {
    mine,
    author,
    createdAt,
    note = false,
    removed = false,
    children,
    actions
  }: {
    mine: boolean;
    /** Null for notes that wunan writes. */
    author: { id: string; displayName: string } | null;
    createdAt: string;
    note?: boolean;
    removed?: boolean;
    children: Snippet;
    actions?: Snippet;
  } = $props();
</script>

<li
  class="flex items-start gap-2 rounded-md border py-2 pr-1 pl-3 {note
    ? 'border-dashed bg-muted/50'
    : 'border-border/60'}"
>
  <div class="grid min-w-0 flex-1 gap-0.5">
    <p class="text-xs text-muted-foreground">
      {#if mine}You{:else if author}<a href="/members/{author.id}">{author.displayName}</a
        >{:else}wunan{/if}
      · <time datetime={createdAt}>{when(createdAt)}</time>
    </p>
    {#if removed}
      <p class="text-muted-foreground italic">Message removed</p>
    {:else}
      {@render children()}
    {/if}
  </div>
  {#if actions && !removed}<div class="shrink-0 text-muted-foreground">
      {@render actions()}
    </div>{/if}
</li>
