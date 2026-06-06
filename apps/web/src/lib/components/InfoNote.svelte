<!--
  A short piece of information next to a form field, with a small "i" in a circle in front so it
  reads as a note, not a question or an error. The icon is decorative; the words carry the meaning.
-->
<script lang="ts">
  import InfoIcon from '@lucide/svelte/icons/info';
  import type { Snippet } from 'svelte';

  let { children, id }: { children: Snippet; id?: string } = $props();
</script>

<p {id} class="flex items-start gap-2 text-sm text-muted-foreground">
  <InfoIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
  <span>{@render children()}</span>
</p>
