<script lang="ts">
  import HelpChoices from '#lib/components/HelpChoices.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import { offeringTypeFor } from '@wunan/shared';

  let { data, form } = $props();
  const request = $derived(data.request);
</script>

<svelte:head><title>Help with a request · wunan</title></svelte:head>

<section class="grid max-w-xl gap-5">
  <h1 class="text-2xl font-semibold sm:text-3xl">How would you like to help?</h1>
  <p class="text-muted-foreground">
    With <a href="/requests/{request.id}">{request.asker.displayName}'s request: {request.title}</a
    >. Either way, your offering shows on the request so {request.asker.displayName} can propose on it.
  </p>
  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}
  {#if request.canAnswer}
    <HelpChoices
      requestId={request.id}
      askerName={request.asker.displayName}
      type={offeringTypeFor[request.kind]}
      offerings={data.myOfferings}
    />
  {:else}
    <p>This request can't take new offerings right now.</p>
  {/if}
</section>
