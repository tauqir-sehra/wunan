<!--
  One line on Home (007): the thing's name, and under it a short, quieter line saying who and what's
  needed. The whole row is one link, marked by the underlined name and a chevron, not colour alone.
  The pieces of the quiet line are set apart by a dot for the eye and a comma for screen readers.
-->
<script lang="ts">
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import type { HomeLineWords } from '#lib/format.ts';

  let { href, words, id }: { href: string; words: HomeLineWords; id?: string } = $props();
</script>

<li>
  <a
    {id}
    {href}
    class="flex min-h-11 items-center gap-3 px-5 py-3 text-foreground no-underline hover:bg-accent"
  >
    <span class="grid min-w-0 flex-1 gap-0.5">
      <span class="font-medium underline underline-offset-[3px]">{words.title}</span>
      <span class="text-sm text-muted-foreground">
        {#each words.detail as piece, i (i)}{#if i > 0}<span aria-hidden="true" class="mx-1.5"
              >·</span
            ><span class="sr-only">, </span>{/if}{piece}{/each}
      </span>
    </span>
    {#if words.newMessage}<span class="shrink-0 text-sm font-medium">New message</span>{/if}
    <ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
  </a>
</li>
