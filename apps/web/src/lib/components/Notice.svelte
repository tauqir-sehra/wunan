<!--
  A short message after an action. Success uses role="status" (announced politely); errors use
  role="alert". Meaning is carried by the icon and words, not colour alone (constitution IV).
-->
<script lang="ts">
  import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import InfoIcon from '@lucide/svelte/icons/info';
  import type { Snippet } from 'svelte';

  let { kind = 'success', children }: { kind?: 'success' | 'error' | 'info'; children: Snippet } =
    $props();
</script>

<div
  role={kind === 'error' ? 'alert' : 'status'}
  class="flex gap-3 rounded-xl border px-4 py-3 {kind === 'error'
    ? 'border-destructive bg-card'
    : 'border-transparent bg-accent text-accent-foreground'}"
>
  {#if kind === 'error'}
    <CircleAlertIcon class="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
  {:else if kind === 'success'}
    <CircleCheckIcon class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
  {:else}
    <InfoIcon class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
  {/if}
  <div class="grid gap-1">{@render children()}</div>
</div>
