<script lang="ts">
  import { helpTopics } from '#lib/help/index.ts';
</script>

<svelte:head><title>Help · wunan</title></svelte:head>

<section class="grid gap-6">
  <h1 class="text-2xl font-semibold sm:text-3xl">Help</h1>
  <p>Short guides to everything in wunan. Choose a topic.</p>
  <ul class="grid gap-3">
    {#each helpTopics as topic (topic.slug)}
      <li class="surface p-4">
        <a href="/help/{topic.slug}" class="text-lg font-medium">{topic.title}</a>
        <p class="text-muted-foreground">{topic.summary}</p>
      </li>
    {/each}
  </ul>
</section>
