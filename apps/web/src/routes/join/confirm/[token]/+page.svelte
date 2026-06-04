<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import Notice from '#lib/components/Notice.svelte';

  let { form } = $props();
</script>

<svelte:head><title>Finish joining · wunan</title></svelte:head>

<section class="mx-auto grid max-w-md gap-5">
  {#if form?.error}
    <h1 class="text-2xl font-semibold">This link has run out</h1>
    <Notice kind="error"><p>{form.error}</p></Notice>
  {:else}
    <h1 class="text-2xl font-semibold">Finish joining</h1>
    <p>Thanks for confirming your email. Press the button to finish joining and sign in.</p>
    <form method="POST" action="?/confirm"><Button type="submit">Finish joining</Button></form>
  {/if}
</section>
