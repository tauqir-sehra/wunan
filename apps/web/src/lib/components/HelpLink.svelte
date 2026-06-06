<!--
  A small "Help" button beside a page's heading, linking to the help page for what's on screen.
  The visible word stays short; screen readers also hear the full label (e.g. "Help with proposals").
-->
<script lang="ts">
  import CircleHelpIcon from '@lucide/svelte/icons/circle-help';

  let { topic, label }: { topic: string; label: string } = $props();
</script>

<a
  href="/help/{topic}"
  title={label}
  class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground no-underline hover:bg-accent hover:text-foreground"
>
  <CircleHelpIcon class="size-4" aria-hidden="true" />
  Help<span class="sr-only">: {label}</span>
</a>
