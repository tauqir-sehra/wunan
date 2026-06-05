<!-- A quiet link to the help page for what's on screen. -->
<script lang="ts">
  import CircleHelpIcon from '@lucide/svelte/icons/circle-help';

  let { topic, label }: { topic: string; label: string } = $props();
</script>

<p class="text-sm">
  <a href="/help/{topic}" class="inline-flex min-h-11 items-center gap-2">
    <CircleHelpIcon class="size-4 shrink-0" aria-hidden="true" />
    {label}
  </a>
</p>
