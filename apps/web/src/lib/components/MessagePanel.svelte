<!--
  The frame around every conversation (proposal and agreement messages, public messages, requests
  for help): a heading with "check for new", the messages, and the message box.
  On wide screens it's a card beside the page's details. The messages scroll inside it, opening at
  the newest, and the message box stays at its foot, so nothing the person is working on moves when
  a message arrives or something is added to the one being written (constitution V). On narrow
  screens it's simply the last part of the page.
  `children` is the messages (and notes about them); `footer` is the message box or why there
  isn't one.
-->
<script lang="ts">
  import { page } from '$app/state';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import type { Snippet } from 'svelte';

  let {
    id,
    heading,
    refreshLabel,
    children,
    footer
  }: {
    /** Also the `#anchor` that forms in the panel come back to without JavaScript. */
    id: string;
    heading: string;
    /** For example "Check for new messages". */
    refreshLabel: string;
    children: Snippet;
    footer: Snippet;
  } = $props();
</script>

<section {id} class="message-panel" aria-labelledby="{id}-heading">
  <div class="flex items-center gap-1 lg:shrink-0">
    <h2 id="{id}-heading" class="text-xl font-semibold">{heading}</h2>
    <a
      href="{page.url.pathname}#{id}"
      aria-label={refreshLabel}
      title={refreshLabel}
      class="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <RefreshCwIcon class="size-4" aria-hidden="true" />
    </a>
  </div>
  <!-- Reachable with the keyboard, so it can be scrolled with the arrow keys when it scrolls. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="message-scroll rounded-lg" role="group" aria-label={heading} tabindex="0">
    <div class="grid gap-4">{@render children()}</div>
  </div>
  <div class="grid gap-3 lg:shrink-0">{@render footer()}</div>
</section>
