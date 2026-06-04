<script lang="ts">
  let { data } = $props();
  const first = $derived(data.chain[0]);
</script>

<svelte:head><title>Invite chain · wunan</title></svelte:head>

<section class="grid gap-4">
  <h1 class="text-2xl font-semibold">Invite chain for {first?.displayName}</h1>
  <p class="text-muted-foreground">Each person below was invited by the person after them.</p>
  <ol class="grid gap-2">
    {#each data.chain as link, index (link.id)}
      <li class="flex items-baseline gap-3">
        <span class="w-6 text-right text-muted-foreground" aria-hidden="true">{index + 1}.</span>
        <span>
          <a href="/members/{link.id}">{link.displayName}</a>
          {#if link.isFounder}<span class="text-muted-foreground"> — founding member</span>{/if}
        </span>
      </li>
    {/each}
  </ol>
</section>
