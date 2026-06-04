<!-- Shows where someone is in a multi-step form, in words ("Step 2 of 4: Details"). -->
<script lang="ts">
  let { current, labels }: { current: number; labels: string[] } = $props();
</script>

<nav aria-label="Progress" class="grid gap-2">
  <p class="text-sm font-medium text-muted-foreground">
    Step {current} of {labels.length}: <span class="text-foreground">{labels[current - 1]}</span>
  </p>
  <ol class="flex gap-1.5" aria-hidden="true">
    {#each labels as label, index (label)}
      <li class="h-1.5 flex-1 rounded-full {index < current ? 'bg-primary' : 'bg-muted'}"></li>
    {/each}
  </ol>
</nav>
