<script lang="ts">
  import { helpTopics } from '#lib/help/index.ts';

  let { data } = $props();
  const topic = $derived(helpTopics[data.index]!);
  const next = $derived(helpTopics[data.index + 1]);
</script>

<svelte:head><title>{topic.title} · Help · wunan</title></svelte:head>

<article class="help grid max-w-2xl gap-4">
  <p><a href="/help">All help topics</a></p>
  <h1 class="text-2xl font-semibold sm:text-3xl">{topic.title}</h1>
  <topic.content />
  {#if next}
    <p class="mt-4 border-t pt-4">Next: <a href="/help/{next.slug}">{next.title}</a></p>
  {/if}
</article>

<style>
  .help :global(h2) {
    margin-top: 0.75rem;
    font-size: 1.25rem;
    font-weight: 600;
  }
  .help :global(ul) {
    display: grid;
    gap: 0.5rem;
    padding-left: 1.5rem;
    list-style: disc;
  }
</style>
