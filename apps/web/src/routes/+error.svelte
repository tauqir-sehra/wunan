<!-- Plain-language error page. No technical details, always a way back home. -->
<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '#lib/components/ui/button/index.ts';

  const notFound = $derived(page.status === 404);
  const notAllowed = $derived(page.status === 403);
</script>

<svelte:head><title>{notFound ? 'Not found' : 'Something went wrong'} · wunan</title></svelte:head>

<section class="grid max-w-xl gap-4">
  {#if notFound}
    <h1 class="text-2xl font-semibold sm:text-3xl">We couldn't find that page</h1>
    <p>It may have been removed, or the link may have a typo.</p>
  {:else if notAllowed}
    <h1 class="text-2xl font-semibold sm:text-3xl">This page isn't available to you</h1>
    <p>If you think it should be, ask the person who shared the link.</p>
  {:else}
    <h1 class="text-2xl font-semibold sm:text-3xl">Sorry, something went wrong</h1>
    <p>It's not something you did. Please try again in a moment.</p>
  {/if}
  <div><Button href="/offerings">Go to offerings</Button></div>
</section>
